'use strict';

/**
 * Inventory Hardening Sprint Tests
 * Focuses on six critical P0/P1 items implemented.
 */

const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const IORedis = require('ioredis');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE_URL = 'http://localhost:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('ERROR: Missing env vars in .env.local');
  process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runTest(num, name, fn) {
  const bar = '─'.repeat(60);
  console.log(`\n${bar}`);
  console.log(`TEST ${num}: ${name}`);
  console.log(bar);
  try {
    await fn();
    console.log(`✓ PASS  TEST ${num}`);
    return true;
  } catch (err) {
    console.error(`✗ FAIL  TEST ${num}: ${err.message}`);
    throw err;
  }
}

// Cookie builder
const MAX_CHUNK = 3180;
function buildAuthCookieHeader(session) {
  const key = `sb-${PROJECT_REF}-auth-token`;
  const value = JSON.stringify(session);
  let enc = encodeURIComponent(value);

  if (enc.length <= MAX_CHUNK) {
    return `${key}=${encodeURIComponent(value)}`;
  }

  const parts = [];
  let idx = 0;
  while (enc.length > 0) {
    let head = enc.slice(0, MAX_CHUNK);
    const lastPct = head.lastIndexOf('%');
    if (lastPct > MAX_CHUNK - 3) head = head.slice(0, lastPct);

    let chunk;
    while (head.length > 0) {
      try {
        chunk = decodeURIComponent(head);
        break;
      } catch (e) {
        if (head.length > 3 && head[head.length - 3] === '%') {
          head = head.slice(0, head.length - 3);
        } else throw e;
      }
    }
    parts.push(`${key}.${idx++}=${encodeURIComponent(chunk)}`);
    enc = enc.slice(head.length);
  }
  return parts.join('; ');
}

// Redis Cache Invalidation helper
async function clearCache() {
  const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1 });
  redis.on('error', () => {}); // silence connection errors
  try {
    await redis.del('products:list', 'products:list:all');
    console.log('  [Cache] Invalidated product list caches in Redis.');
  } catch (e) {
    console.warn('  [Cache] Failed to invalidate cache:', e.message);
  } finally {
    redis.disconnect();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev-server management
// ─────────────────────────────────────────────────────────────────────────────
let managedServer = null;

async function probeHttp() {
  try {
    const r = await fetch(`${BASE_URL}/api/admin/test-runner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionName: 'dummy:test' }),
      signal: AbortSignal.timeout(5000),
    });
    return r.status !== 0;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await probeHttp()) {
    console.log(`[SERVER] Already running at ${BASE_URL}`);
    return;
  }
  console.log('[SERVER] Not running — starting Next.js dev server (--webpack)...');
  managedServer = spawn('npm', ['run', 'dev', '--', '--webpack'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  managedServer.stdout.on('data', d => process.stdout.write(`  [dev] ${d}`));
  managedServer.stderr.on('data', d => process.stderr.write(`  [dev] ${d}`));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Dev server did not print "Ready" within 60s')),
      60000
    );
    const onReady = (data) => {
      if (data.toString().includes('Ready')) {
        clearTimeout(timer);
        resolve();
      }
    };
    managedServer.stdout.on('data', onReady);
    managedServer.stderr.on('data', onReady);
    managedServer.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Dev server exited early with code ${code}`));
    });
  });

  await sleep(3000);
  for (let i = 0; i < 10; i++) {
    if (await probeHttp()) {
      console.log(`[SERVER] HTTP confirmed at ${BASE_URL}`);
      return;
    }
    await sleep(1000);
  }
  throw new Error('Dev server started but HTTP not responding after 10s');
}

function stopManagedServer() {
  if (managedServer) {
    managedServer.kill('SIGTERM');
    managedServer = null;
    console.log('[SERVER] Dev server stopped.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Invoker
// ─────────────────────────────────────────────────────────────────────────────
async function invokeAction(cookies, actionName, ...args) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const res = await fetch(`${BASE_URL}/api/admin/test-runner`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actionName, args }),
  });
  if (res.status === 401) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        Inventory Hardening Integration Tests             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Project ref : ${PROJECT_REF}`);
  console.log(`API base    : ${BASE_URL}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 6;

  // Setup test users
  const adminEmail = `admin-hard-${ts}@example.com`;
  const customerEmail = `customer-hard-${ts}@example.com`;
  const password = 'TestPass123!';

  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;

  // Setup test data tracking for cleanup
  const createdProductIds = [];
  const createdOrderIds = [];

  const cleanup = async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    // Delete orders
    if (createdOrderIds.length > 0) {
      try {
        await serviceClient.from('order_status_history').delete().in('order_id', createdOrderIds);
        await serviceClient.from('order_events').delete().in('order_id', createdOrderIds);
        await serviceClient.from('payments').delete().in('order_id', createdOrderIds);
        await serviceClient.from('orders').delete().in('id', createdOrderIds);
        console.log(`  Cleaned up orders: ${createdOrderIds.join(', ')}`);
      } catch (e) {
        console.warn('  Order cleanup warning:', e.message);
      }
    }

    // Delete products and variants
    if (createdProductIds.length > 0) {
      try {
        await serviceClient.from('product_variants').delete().in('product_id', createdProductIds);
        await serviceClient.from('products').delete().in('id', createdProductIds);
        console.log(`  Cleaned up products: ${createdProductIds.join(', ')}`);
      } catch (e) {
        console.warn('  Product cleanup warning:', e.message);
      }
    }

    // Delete test users
    if (customerUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(customerUserId);
        console.log('  Customer user deleted.');
      } catch (e) {
        console.warn('  Customer user deletion warning:', e.message);
      }
    }

    if (adminUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(adminUserId);
        console.log('  Admin user deleted.');
      } catch (e) {
        console.warn('  Admin user deletion warning:', e.message);
      }
    }

    await clearCache();
    console.log('[CLEANUP] Done.');
  };

  try {
    // 1. SETUP test users
    console.log('\n[SETUP] Creating test users...');
    const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    assert(!adminAuthErr, `Admin creation failed: ${adminAuthErr?.message}`);
    adminUserId = adminAuth.user.id;

    const { data: customerAuth, error: customerAuthErr } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password: password,
      email_confirm: true,
    });
    assert(!customerAuthErr, `Customer creation failed: ${customerAuthErr?.message}`);
    customerUserId = customerAuth.user.id;

    await sleep(600);

    // Update profile roles and customer balance
    await serviceClient.from('profiles').update({ role: 'admin' }).eq('id', adminUserId);
    await serviceClient.from('profiles').update({ wallet_balance: 1000, loyalty_points: 0 }).eq('id', customerUserId);

    // Authenticate admin to get cookie
    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);
    console.log('  Cookies and profiles configured.');

    // 2. SETUP test product with variants S/M/L (S has color Black, M has color Red, L has color Blue)
    const pid = `HARD-P-${ts}`;
    createdProductIds.push(pid);

    const { error: pe } = await serviceClient.from('products').insert({
      id:            pid,
      slug:          `hard-product-${ts}`,
      title:         `Hardening Test Product ${ts}`,
      price:         500,
      compare_price: 600,
      category:      'shirts',
      image:         '',
      stock:         15,
      size_stock_s:  5,
      size_stock_m:  5,
      size_stock_l:  5,
    });
    assert(!pe, `Product insert failed: ${pe?.message}`);

    const { error: ve } = await serviceClient.from('product_variants').insert([
      { product_id: pid, size: 'S', color: 'Black', sku: `${pid}-S-BLK`, price: 500, stock: 5 },
      { product_id: pid, size: 'M', color: 'Red', sku: `${pid}-M-RED`, price: 500, stock: 5 },
      { product_id: pid, size: 'L', color: 'Blue', sku: `${pid}-L-BLU`, price: 500, stock: 5 },
    ]);
    assert(!ve, `Product variants insert failed: ${ve?.message}`);
    console.log(`  Product ${pid} with S-Black, M-Red, L-Blue variants created.`);

    // Invalidate Cache after inserting product
    await clearCache();

    // Insert user address
    const addrId = `ADDR-HARD-${ts}`;
    const { error: ae } = await serviceClient.from('user_addresses').insert({
      id:             addrId,
      user_id:        customerUserId,
      name:           'Hardening Customer',
      phone:          '+919876543210',
      address_line_1: '123 Hardening Road',
      city:           'Chennai',
      state:          'Tamil Nadu',
      postal_code:    '600001',
      country:        'India',
      is_default:     true,
    });
    assert(!ae, `Insert address failed: ${ae?.message}`);

    // ══════════════════════════════════════════════════════════════
    // TEST 1 — COD order persists cartItems to DB
    // ══════════════════════════════════════════════════════════════
    await runTest(1, 'COD order persists cartItems to DB', async () => {
      const orderId = `HARD-ORD-COD-${ts}`;
      createdOrderIds.push(orderId);

      const cart = [{
        productId: pid,
        productName: `Hardening Test Product ${ts}`,
        price: 500,
        size: 'S',
        color: 'Black',
        image: '',
        quantity: 1
      }];

      const payload = {
        cart,
        couponCode: '',
        walletDeduction: 0,
        pointsRedeemed: 0,
        loyaltyDiscount: 0,
        baseTotal: 500,
        netTotal: 500,
        customerName: 'Hardening Customer',
        idempotencyKey: orderId,
        addressId: addrId,
        userId: customerUserId,
        pincode: '600001',
      };

      const res = await invokeAction(adminCookie, 'checkout:processCodCheckoutAction', payload);
      assert(res.success === true, `COD Checkout failed: ${res.error || 'unknown error'}`);

      // Verify DB row cart_items
      const { data: order, error: oe } = await serviceClient.from('orders').select('cart_items').eq('id', orderId).single();
      assert(!oe, `Query order failed: ${oe?.message}`);
      assert(order && order.cart_items, 'cart_items is empty/null in DB');
      assert(Array.isArray(order.cart_items), 'cart_items is not an array');
      assert(order.cart_items.length === 1, `cart_items length ${order.cart_items.length} !== 1`);
      assert(order.cart_items[0].size === 'S', 'cart_items size is incorrect');
      assert(order.cart_items[0].color === 'Black', 'cart_items color is incorrect');
      console.log('  Confirmed cart_items correctly saved in DB.');
    });
    passed++;

    // ══════════════════════════════════════════════════════════════
    // TEST 2 — Wallet order persists cartItems to DB
    // ══════════════════════════════════════════════════════════════
    await runTest(2, 'Wallet order persists cartItems to DB', async () => {
      const orderId = `HARD-ORD-WAL-${ts}`;
      createdOrderIds.push(orderId);

      const cart = [{
        productId: pid,
        productName: `Hardening Test Product ${ts}`,
        price: 500,
        size: 'M',
        color: 'Red',
        image: '',
        quantity: 1
      }];

      const payload = {
        cart,
        couponCode: '',
        walletDeduction: 500,
        pointsRedeemed: 0,
        loyaltyDiscount: 0,
        baseTotal: 500,
        netTotal: 500,
        customerName: 'Hardening Customer',
        idempotencyKey: orderId,
        addressId: addrId,
        userId: customerUserId,
      };

      const res = await invokeAction(adminCookie, 'checkout:processWalletPointsCheckoutAction', payload);
      assert(res.success === true, `Wallet Checkout failed: ${res.error || 'unknown error'}`);

      // Verify DB row cart_items
      const { data: order, error: oe } = await serviceClient.from('orders').select('cart_items').eq('id', orderId).single();
      assert(!oe, `Query order failed: ${oe?.message}`);
      assert(order && order.cart_items, 'cart_items is empty/null in DB');
      assert(order.cart_items[0].size === 'M', 'cart_items size is incorrect');
      assert(order.cart_items[0].color === 'Red', 'cart_items color is incorrect');
      console.log('  Confirmed cart_items correctly saved in DB for Wallet checkout.');
    });
    passed++;

    // ══════════════════════════════════════════════════════════════
    // TEST 3 — deductStock returns false when variant doesn't exist
    // ══════════════════════════════════════════════════════════════
    await runTest(3, 'deductStock returns false when variant doesn\'t exist', async () => {
      // Product name that does not exist
      const items = [{
        productName: 'Definitely Non Existent Shirt Product Name XYZ',
        size: 'M',
        color: 'Red',
        quantity: 1
      }];

      const res = await invokeAction(adminCookie, 'db:deductStock', items, `HARD-DED-FAIL-${ts}`);
      assert(res.success === false, `Expected deductStock to return success=false, but got success=${res.success}`);
      console.log('  deductStock correctly returned false for non-existent variant.');
    });
    passed++;

    // ══════════════════════════════════════════════════════════════
    // TEST 4 — validateStock rejects mismatched color (no fallback)
    // ══════════════════════════════════════════════════════════════
    await runTest(4, 'validateStock rejects mismatched color (no fallback)', async () => {
      // Product only has variant M-Red, L-Blue, S-Black. We request M-Blue.
      const items = [{
        productName: `Hardening Test Product ${ts}`,
        size: 'M',
        color: 'Blue', // Mismatched color!
        quantity: 1
      }];

      const res = await invokeAction(adminCookie, 'inventory:validateStock', items);
      assert(res.success === false, `Expected validateStock to fail, but got success=${res.success}`);
      assert(res.errors && res.errors.length > 0, 'Expected validation errors, but errors array is empty');
      assert(res.errors[0].includes('Variant not found'), `Expected "Variant not found" error, got: ${res.errors[0]}`);
      console.log('  validateStock correctly rejected mismatched color variant with Variant not found.');
    });
    passed++;

    // ══════════════════════════════════════════════════════════════
    // TEST 5 — Stock constraint prevents negative
    // ══════════════════════════════════════════════════════════════
    await runTest(5, 'Stock constraint prevents negative', async () => {
      // Fetch variant ID
      const { data: variants } = await serviceClient.from('product_variants').select('id').eq('product_id', pid).limit(1);
      assert(variants && variants.length > 0, 'No variant found to test negative stock constraint');
      const vid = variants[0].id;

      // Attempt update stock to -1
      const { error } = await serviceClient.from('product_variants').update({ stock: -1 }).eq('id', vid);
      assert(error !== null, 'Negative stock update succeeded, constraint did not prevent it!');
      assert(error.message.includes('stock_non_negative') || error.code === '23514', `Expected check constraint violation, got: ${error.message} (code: ${error.code})`);
      console.log('  Stock constraint correctly blocked negative stock.');
    });
    passed++;

    // ══════════════════════════════════════════════════════════════
    // TEST 6 — validateStock excludes soft-deleted product
    // ══════════════════════════════════════════════════════════════
    await runTest(6, 'validateStock excludes soft-deleted product', async () => {
      // Soft delete product
      const { error: sde } = await serviceClient.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', pid);
      assert(!sde, `Failed to soft delete product: ${sde?.message}`);

      // Invalidate cache so server action sees soft deleted product
      await clearCache();

      // Try validateStock
      const items = [{
        productName: `Hardening Test Product ${ts}`,
        size: 'L',
        color: 'Blue',
        quantity: 1
      }];

      const res = await invokeAction(adminCookie, 'inventory:validateStock', items);
      assert(res.success === false, `Expected validateStock to fail for soft-deleted product, but got success=${res.success}`);
      console.log('  validateStock correctly excluded soft-deleted product.');
    });
    passed++;

  } catch (err) {
    console.error(`\n!!! TEST RUN ENCOUNTERED FAILURE: ${err.message}`);
  } finally {
    await cleanup();
    stopManagedServer();
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed                                     ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  stopManagedServer();
  process.exit(1);
});
