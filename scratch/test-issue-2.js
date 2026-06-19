'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE_URL = 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('=== Issue #2 Security Fix — E2E Integration Test ===\n');

  const productId = 'TEST-001';
  const userId = '00000000-0000-0000-0000-000000000002';
  const idempotencyKey = 'test-issue2-' + Date.now();
  let createdOrderId = null;
  let userCreated = false;
  let redis = null;

  try {
    // Connect to Redis and invalidate cache
    console.log('Connecting to Redis...');
    redis = new Redis(process.env.REDIS_URL);
    console.log('Invalidating products list cache in Redis...');
    await redis.del('products:list');

    // 1. Create test user via Auth Admin API (which triggers profile creation)
    console.log('Creating test user in auth.users...');
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      id: userId,
      email: 'test-issue2@example.com',
      password: 'password123',
      email_confirm: true,
      user_metadata: { name: 'Test Customer' }
    });
    
    if (userErr) {
      if (userErr.message.includes('already exists') || userErr.status === 422) {
        console.log('User already exists, continuing...');
      } else {
        throw new Error(`Failed to create auth user: ${userErr.message}`);
      }
    } else {
      userCreated = true;
      console.log('Auth user created successfully.');
    }

    // Set wallet and loyalty points to 0 to match instructions
    console.log('Updating test profile to set balance/points to 0...');
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .update({ wallet_balance: 0, loyalty_points: 0 })
      .eq('id', userId);
      
    if (profileUpdateErr) throw new Error(`Failed to update profile: ${profileUpdateErr.message}`);

    // 2. Insert test product
    console.log('Inserting test product...');
    const { error: prodErr } = await supabase.from('products').insert({
      id: productId,
      slug: 'test-shirt',
      title: 'Test Shirt',
      price: 1000,
      category: 'Cotton',
      image: '/test.webp',
      stock: 10,
      size_stock_m: 10,
    });
    if (prodErr) throw new Error(`Failed to insert product: ${prodErr.message}`);

    // 3. Insert test variant
    console.log('Inserting test variant...');
    const { error: varErr } = await supabase.from('product_variants').insert({
      product_id: productId,
      size: 'M',
      color: 'Atelier Choice',
      sku: 'SKU-TEST-001-M',
      price: 1000,
      stock: 10,
    });
    if (varErr) throw new Error(`Failed to insert variant: ${varErr.message}`);

    // 4. POST to create-order endpoint
    console.log('Sending request to /api/payments/create-order...');
    const res = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [{
          productName: 'Test Shirt',
          price: 1000,
          size: 'M',
          color: 'Atelier Choice',
          image: '/test.webp',
          quantity: 1
        }],
        couponCode: '',
        walletDeduction: 0,
        pointsRedeemed: 0,
        loyaltyDiscount: 0,
        baseTotal: 1000,
        netTotal: 1000,
        customerName: 'Test Customer',
        idempotencyKey: idempotencyKey,
        userId: userId
      })
    });

    const status = res.status;
    const json = await res.json();
    console.log('Response Status:', status);
    console.log('Response Body:', JSON.stringify(json, null, 2));

    // 5. Assertions
    assert(status === 200, `Expected HTTP 200, got ${status}`);
    assert(json.success === true, 'Expected json.success to be true');
    assert(json.checkoutState !== undefined, 'Expected response.checkoutState to be present');
    
    const cs = json.checkoutState;
    assert(cs.netTotal === 1000, `Expected checkoutState.netTotal to be 1000, got ${cs.netTotal}`);
    assert(cs.finalPayable === 1000, `Expected checkoutState.finalPayable to be 1000, got ${cs.finalPayable}`);
    assert(Array.isArray(cs.items) && cs.items.includes('Test Shirt'), 'Expected checkoutState.items to list "Test Shirt"');
    
    // Key assertion: signature should be undefined!
    assert(cs.signature === undefined, 'SECURITY BREACH: checkoutState.signature is present!');
    console.log('✅ PASS: checkoutState.signature is undefined');

    // Razorpay order created
    assert(json.razorpayOrderId !== undefined, 'Expected response.razorpayOrderId to exist');
    console.log('✅ PASS: Razorpay order created successfully with ID:', json.razorpayOrderId);

    createdOrderId = json.orderId;

    console.log('\n=== ALL ASSERTIONS PASSED (PASS) ===');
  } catch (err) {
    console.error('\n❌ FAIL:', err.message);
    process.exitCode = 1;
  } finally {
    // 6. Cleanup
    console.log('\nStarting cleanup...');
    try {
      if (redis) {
        console.log('Invalidating products list cache in Redis again...');
        await redis.del('products:list');
        await redis.quit();
      }
      
      if (createdOrderId) {
        await supabase.from('payment_audit_logs').delete().eq('order_id', createdOrderId);
        await supabase.from('order_events').delete().eq('order_id', createdOrderId);
        await supabase.from('payments').delete().eq('order_id', createdOrderId);
        await supabase.from('orders').delete().eq('id', createdOrderId);
        console.log('Deleted order & associated records.');
      }
      await supabase.from('inventory_reservations').delete().eq('session_id', `idem-${createdOrderId || idempotencyKey}`);
      await supabase.from('product_variants').delete().eq('product_id', productId);
      await supabase.from('products').delete().eq('id', productId);
      
      // Delete user which cascades to profiles
      if (userCreated) {
        const { error: delUserErr } = await supabase.auth.admin.deleteUser(userId);
        if (delUserErr) console.error('Failed to delete auth user:', delUserErr.message);
        else console.log('Auth user and profile deleted.');
      } else {
        await supabase.from('profiles').delete().eq('id', userId);
      }
      
      console.log('Cleanup completed successfully.');
    } catch (cleanErr) {
      console.error('Error during cleanup:', cleanErr.message);
    }
  }
}

main().catch(console.error);
