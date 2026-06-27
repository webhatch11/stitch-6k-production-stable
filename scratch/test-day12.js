'use strict';

/**
 * Day 12 Refund Integration Tests
 *
 * Pattern: same as scratch/test-day9-5.js. Boot dev server if needed.
 * Use service-role Supabase client for setup/cleanup.
 */

const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE_URL = 'http://localhost:3000';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// Extract project ref from URL
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('ERROR: Missing env vars in .env.local');
  process.exit(1);
}

if (!webhookSecret) {
  console.error('ERROR: RAZORPAY_WEBHOOK_SECRET is not configured in .env.local');
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

// ─────────────────────────────────────────────────────────────────────────────
// Dev-server management
// ─────────────────────────────────────────────────────────────────────────────
let managedServer = null;

async function probeHttp() {
  try {
    const r = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
      method: 'GET',
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
// Action Invoker (HTTP Fallback via Dev-Only test runner)
// ─────────────────────────────────────────────────────────────────────────────
async function invokeAction(cookies, actionName, ...args) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  // Map to the appropriate action namespace required by the dev test-runner
  let prefixedActionName = actionName;
  if (actionName.startsWith('get')) {
    prefixedActionName = 'read:' + actionName;
  } else if (actionName.includes('Product')) {
    prefixedActionName = 'product:' + actionName;
  } else if (actionName.includes('Order') || actionName.includes('Refund')) {
    prefixedActionName = 'order:' + actionName;
  } else if (actionName.includes('Coupon')) {
    prefixedActionName = 'coupon:' + actionName;
  } else if (actionName.includes('Customer')) {
    prefixedActionName = 'customer:' + actionName;
  }

  const res = await fetch(`${BASE_URL}/api/admin/test-runner`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actionName: prefixedActionName, args }),
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
  console.log('║  Day 12 Order Management & Webhook Integration Tests    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Project ref : ${PROJECT_REF}`);
  console.log(`API base    : ${BASE_URL}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 8;

  // Setup test users
  const adminEmail = `admin-day12-${ts}@example.com`;
  const customerEmail = `customer-day12-${ts}@example.com`;
  const password = 'TestPass123!';

  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;
  let customerCookie = null;

  const testProductId = `DAY12TEST-P-${ts}`;
  const testOrderId = `DAY12-ORD-${ts}`;

  try {
    // Setup DB test users
    console.log('\n[SETUP] Creating test users...');
    const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    assert(!adminAuthErr, `Admin creation failed: ${adminAuthErr?.message}`);
    adminUserId = adminAuth.user.id;
    console.log(`  Admin Auth created: ${adminEmail} (ID: ${adminUserId})`);

    const { data: customerAuth, error: customerAuthErr } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password: password,
      email_confirm: true,
    });
    assert(!customerAuthErr, `Customer creation failed: ${customerAuthErr?.message}`);
    customerUserId = customerAuth.user.id;
    console.log(`  Customer Auth created: ${customerEmail} (ID: ${customerUserId})`);

    await sleep(1000); // Wait for auth triggers to insert profiles row

    // Update profile roles and customer balance
    console.log('  Updating profiles in database...');
    const { error: adminProfErr } = await serviceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId);
    assert(!adminProfErr, `Admin profile update failed: ${adminProfErr?.message}`);

    const { error: customerProfErr } = await serviceClient
      .from('profiles')
      .update({ wallet_balance: 500, loyalty_points: 100 })
      .eq('id', customerUserId);
    assert(!customerProfErr, `Customer profile update failed: ${customerProfErr?.message}`);
    console.log('  Profiles configured successfully.');

    // Authenticate users to get cookies
    console.log('  Signing in to obtain cookies...');
    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);

    const { data: customerSignIn, error: customerSignInErr } = await anonClient.auth.signInWithPassword({
      email: customerEmail,
      password,
    });
    assert(!customerSignInErr, `Customer sign-in failed: ${customerSignInErr?.message}`);
    customerCookie = buildAuthCookieHeader(customerSignIn.session);
    console.log('  Cookies obtained.');

    // Create a base product for variants testing
    console.log('  Saving test product...');
    const prodSave = await invokeAction(adminCookie, 'saveProductAction', {
      id: testProductId,
      title: `Test Product Day12 ${ts}`,
      category: 'Cotton',
      basePrice: 1000,
      gstRate: 12,
      discountRate: 0,
      sizeStock: { S: 0, M: 5, L: 0, XL: 0, XXL: 0 },
      variants: [
        { size: "M", color: "Atelier Choice", sku: `${testProductId}-M-AC`, price: 1000, stock: 5 },
      ],
    });
    assert(prodSave.success === true, `Product save failed: ${JSON.stringify(prodSave)}`);
    console.log('  Test product and M/Atelier Choice variant saved.');


    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: issueRefundAction requires admin
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(1, 'issueRefundAction requires admin', async () => {
      // Anonymous caller
      const resAnon = await invokeAction(null, 'issueRefundAction', testOrderId, 'test refund');
      assert(resAnon.success === false, 'Anonymous caller should fail');
      assert(resAnon.error === 'Unauthorized', `Expected Unauthorized, got ${resAnon.error}`);

      // Customer caller
      const resCust = await invokeAction(customerCookie, 'issueRefundAction', testOrderId, 'test refund');
      assert(resCust.success === false, 'Customer caller should fail');
      assert(resCust.error === 'Unauthorized', `Expected Unauthorized, got ${resCust.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: issueRefundAction requires non-empty reason
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(2, 'issueRefundAction requires non-empty reason', async () => {
      const res = await invokeAction(adminCookie, 'issueRefundAction', testOrderId, '');
      assert(res.success === false, 'Empty reason should fail');
      assert(res.error?.includes('reason'), `Expected error to mention reason, got: ${res.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: issueRefundAction on order with no payment_id sets wallet_only status
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(3, 'issueRefundAction sets wallet_only status when no payment_id present', async () => {
      const orderId = `${testOrderId}-T3`;
      // Setup DB Order with razorpay_payment_id = null
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Test Customer T3',
        date: new Date().toLocaleDateString("en-IN"),
        total: 700,
        status: 'Paid',
        original_total: 700,
        gateway_paid: 500,
        wallet_paid: 200,
        razorpay_payment_id: null,
        user_id: customerUserId,
        items: []
      });
      assert(!orderErr, `Failed to setup test order: ${orderErr?.message}`);

      const res = await invokeAction(adminCookie, 'issueRefundAction', orderId, 'test wallet refund');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: dbOrder, error: queryErr } = await serviceClient
        .from('orders')
        .select('refund_status, refund_reason, refund_amount')
        .eq('id', orderId)
        .single();

      assert(!queryErr && dbOrder, 'Failed to query order status');
      assert(dbOrder.refund_status === 'wallet_only', `Expected status "wallet_only", got "${dbOrder.refund_status}"`);
      assert(dbOrder.refund_reason === 'test wallet refund', `Expected reason, got "${dbOrder.refund_reason}"`);
      assert(Number(dbOrder.refund_amount) === 200, `Expected refund amount to match wallet_paid (200), got ${dbOrder.refund_amount}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: issueRefundAction is atomic — concurrent calls don't both refund (Option B)
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(4, 'issueRefundAction is atomic — concurrent calls don\'t both refund', async () => {
      const orderId = `${testOrderId}-T4`;
      // Setup DB Order with razorpay_payment_id = null (wallet_only route takes over)
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Test Customer T4',
        date: new Date().toLocaleDateString("en-IN"),
        total: 700,
        status: 'Paid',
        original_total: 700,
        gateway_paid: 500,
        wallet_paid: 200,
        razorpay_payment_id: null,
        user_id: customerUserId,
        items: [],
        refund_status: null
      });
      assert(!orderErr, `Failed to setup test order T4: ${orderErr?.message}`);

      // Call issueRefundAction twice in parallel
      const [res1, res2] = await Promise.all([
        invokeAction(adminCookie, 'issueRefundAction', orderId, 'concurrent call 1'),
        invokeAction(adminCookie, 'issueRefundAction', orderId, 'concurrent call 2')
      ]);

      const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
      assert(successCount === 1, `Expected exactly 1 success from concurrent calls, got ${successCount}. Res1: ${JSON.stringify(res1)}, Res2: ${JSON.stringify(res2)}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: cancelOrderAndRefundAction restocks variants (not products.stock)
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(5, 'cancelOrderAndRefundAction restocks variants (not products.stock)', async () => {
      const orderId = `${testOrderId}-T5`;
      
      // Setup DB Order with cart_items purchasing 2 variants of M/Atelier Choice
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Test Customer T5',
        date: new Date().toLocaleDateString("en-IN"),
        total: 2000,
        status: 'Paid',
        original_total: 2000,
        gateway_paid: 2000,
        razorpay_payment_id: null,
        user_id: customerUserId,
        cart_items: [
          { productId: testProductId, size: "M", color: "Atelier Choice", quantity: 2 }
        ],
        items: [`Test Product Day12 - M/Atelier Choice`]
      });
      assert(!orderErr, `Failed to setup test order T5: ${orderErr?.message}`);

      // Capture variant stock before cancel (should be 5 since we initialized it to 5)
      const { data: varBefore } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('product_id', testProductId)
        .eq('size', 'M')
        .eq('color', 'Atelier Choice')
        .single();
      assert(varBefore.stock === 5, `Expected initial variant stock to be 5, got ${varBefore.stock}`);

      // Call cancelOrderAndRefundAction
      const res = await invokeAction(adminCookie, 'cancelOrderAndRefundAction', orderId, 'cancel & restock test');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify variant stock is updated to 7 (5 + 2)
      const { data: varAfter } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('product_id', testProductId)
        .eq('size', 'M')
        .eq('color', 'Atelier Choice')
        .single();
      assert(varAfter.stock === 7, `Expected variant stock restored to 7, got ${varAfter.stock}`);

      // Verify products.stock is NOT modified (still 5)
      const { data: prodData } = await serviceClient
        .from('products')
        .select('stock')
        .eq('id', testProductId)
        .single();
      assert(prodData.stock === 5, `Expected products.stock to remain unchanged at 5, got ${prodData.stock}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: cancelOrderAndRefundAction credits loyalty points correctly
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(6, 'cancelOrderAndRefundAction credits loyalty points correctly', async () => {
      const orderId = `${testOrderId}-T6`;

      // Set test customer profiles.loyalty_points = 100
      const { error: profResetErr } = await serviceClient
        .from('profiles')
        .update({ loyalty_points: 100 })
        .eq('id', customerUserId);
      assert(!profResetErr, 'Failed to reset customer loyalty points');

      // Create order with points_earned=20, points_redeemed=30
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Test Customer T6',
        date: new Date().toLocaleDateString("en-IN"),
        total: 1000,
        status: 'Paid',
        original_total: 1000,
        gateway_paid: 1000,
        user_id: customerUserId,
        points_earned: 20,
        points_redeemed: 30,
        items: []
      });
      assert(!orderErr, `Failed to setup test order T6: ${orderErr?.message}`);

      // Call cancelOrderAndRefundAction
      const res = await invokeAction(adminCookie, 'cancelOrderAndRefundAction', orderId, 'cancel & loyalty test');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify profiles.loyalty_points = 100 - 20 + 30 = 110
      const { data: profAfter } = await serviceClient
        .from('profiles')
        .select('loyalty_points')
        .eq('id', customerUserId)
        .single();
      assert(profAfter.loyalty_points === 110, `Expected customer loyalty points to be 110, got ${profAfter.loyalty_points}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Refund webhook updates refund_status to processed
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(7, 'Refund webhook updates refund_status to processed', async () => {
      const orderId = `${testOrderId}-T7`;
      const refundId = `rfnd_test_webhook_${ts}`;

      // Set up order with refund_id and refund_status="initiated"
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Test Customer T7',
        date: new Date().toLocaleDateString("en-IN"),
        total: 1000,
        status: 'Paid',
        original_total: 1000,
        gateway_paid: 1000,
        user_id: customerUserId,
        refund_id: refundId,
        refund_status: 'initiated',
        items: []
      });
      assert(!orderErr, `Failed to setup test order T7: ${orderErr?.message}`);

      // POST signed refund.processed webhook payload
      const webhookPayload = {
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: refundId,
              amount: 100000,
              status: 'processed',
              payment_id: 'pay_test_xyz',
              notes: { order_id: orderId, reason: 'test refund processed' }
            }
          }
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const response = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature
        },
        body: rawBody
      });

      assert(response.status === 200, `Expected webhook status 200, got ${response.status}`);
      const resBody = await response.json();
      assert(resBody.ok === true || resBody.success === true, `Expected webhook response success, got ${JSON.stringify(resBody)}`);

      // Verify DB: refund_status = "processed", refunded_at is updated
      const { data: dbOrder } = await serviceClient
        .from('orders')
        .select('refund_status, refunded_at')
        .eq('id', orderId)
        .single();

      assert(dbOrder.refund_status === 'processed', `Expected status "processed", got "${dbOrder.refund_status}"`);
      assert(dbOrder.refunded_at !== null, 'Expected refunded_at to be populated');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Refund webhook is idempotent
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(8, 'Refund webhook is idempotent', async () => {
      const orderId = `${testOrderId}-T8`;
      const refundId = `rfnd_test_webhook_idem_${ts}`;

      // Set up order with refund_id, refund_status="processed", and a custom refunded_at timestamp
      const originalRefundedAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Test Customer T8',
        date: new Date().toLocaleDateString("en-IN"),
        total: 1000,
        status: 'Paid',
        original_total: 1000,
        gateway_paid: 1000,
        user_id: customerUserId,
        refund_id: refundId,
        refund_status: 'processed',
        refunded_at: originalRefundedAt,
        items: []
      });
      assert(!orderErr, `Failed to setup test order T8: ${orderErr?.message}`);

      // POST same signed refund.processed webhook payload again
      const webhookPayload = {
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: refundId,
              amount: 100000,
              status: 'processed',
              payment_id: 'pay_test_xyz',
              notes: { order_id: orderId, reason: 'test refund processed' }
            }
          }
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const response = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature
        },
        body: rawBody
      });

      assert(response.status === 200, `Expected webhook status 200, got ${response.status}`);
      const resBody = await response.json();
      assert(resBody.ok === true || resBody.success === true, `Expected webhook response success, got ${JSON.stringify(resBody)}`);

      // Verify DB: refund_status is still "processed", refunded_at did NOT change
      const { data: dbOrder } = await serviceClient
        .from('orders')
        .select('refund_status, refunded_at')
        .eq('id', orderId)
        .single();

      assert(dbOrder.refund_status === 'processed', `Expected status to remain "processed", got "${dbOrder.refund_status}"`);
      assert(new Date(dbOrder.refunded_at).getTime() === new Date(originalRefundedAt).getTime(), `Expected refunded_at to remain unchanged (${originalRefundedAt}), got "${dbOrder.refunded_at}"`);
    });
    passed++;

  } catch (err) {
    console.error(`\n!!! TEST PROCESS HALTED: ${err.message}`);
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // ==== CLEANUP ────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test data...');

    // Delete test orders
    try {
      const { error: delOrdersErr } = await serviceClient
        .from('orders')
        .delete()
        .like('id', `${testOrderId}%`);
      if (delOrdersErr) console.warn('  Orders cleanup warning:', delOrdersErr.message);
      else console.log('  Orders cleanup completed.');
    } catch (e) {
      console.warn('  Orders cleanup warning:', e.message);
    }

    // Delete test product and variants
    try {
      await serviceClient.from('product_variants').delete().eq('product_id', testProductId);
      await serviceClient.from('products').delete().eq('id', testProductId);
      console.log('  Product and variant cleanup completed.');
    } catch (e) {
      console.warn('  Product cleanup warning:', e.message);
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

    console.log('[CLEANUP] Done.');
  }

  stopManagedServer();

  // Summary
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
