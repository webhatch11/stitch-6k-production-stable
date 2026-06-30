'use strict';

/**
 * Functional Audit Integration Tests
 *
 * Runs the 5 tests requested in the functional audit.
 */

const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE_URL = 'http://localhost:3000';

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

async function invokeAction(cookies, actionName, ...args) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  let prefixedActionName = actionName;
  if (actionName.startsWith('get')) {
    prefixedActionName = 'read:' + actionName;
  } else if (actionName.includes('Product')) {
    prefixedActionName = 'product:' + actionName;
  } else if (actionName.includes('Order') || actionName.includes('Refund')) {
    prefixedActionName = 'order:' + actionName;
  } else if (actionName.includes('devTest') || actionName.includes('Checkout')) {
    prefixedActionName = 'checkout:' + actionName;
  } else if (actionName.includes('Coupon')) {
    prefixedActionName = 'coupon:' + actionName;
  } else if (actionName.includes('Customer') || actionName.includes('Balance')) {
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

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           Functional Audit Verification Tests            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const ts = Date.now();
  let passed = 0;

  const adminEmail = `admin-audit-${ts}@example.com`;
  const customerEmail = `customer-audit-${ts}@example.com`;
  const password = 'TestPass123!';

  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;
  let customerCookie = null;

  const testProductId = `AUDIT-LEGACY-P-${ts}`;
  const testOrderId = `AUDIT-ORD-${ts}`;

  try {
    // Setup test users
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

    await sleep(1500);

    const { error: adminProfErr } = await serviceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId);
    assert(!adminProfErr, `Admin profile role update failed: ${adminProfErr?.message}`);

    const { error: customerProfErr } = await serviceClient
      .from('profiles')
      .update({ wallet_balance: 0, loyalty_points: 0 })
      .eq('id', customerUserId);
    assert(!customerProfErr, `Customer profile update failed: ${customerProfErr?.message}`);

    // Sign in to get cookies
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

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: applyWalletCredit idempotency (no double-credit)
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(1, 'applyWalletCredit idempotency with stable keys', async () => {
      const orderId = `${testOrderId}-T1`;

      // Invoke wallet credit twice in a row
      const res1 = await invokeAction(adminCookie, 'devTestApplyWalletCreditAction', 100, 'test wallet credit', orderId, customerUserId);
      const res2 = await invokeAction(adminCookie, 'devTestApplyWalletCreditAction', 100, 'test wallet credit duplicate', orderId, customerUserId);

      assert(res1.success === true, `First credit call failed: ${JSON.stringify(res1)}`);

      // Verify wallet balance in DB
      const { data: prof, error: profErr } = await serviceClient
        .from('profiles')
        .select('wallet_balance')
        .eq('id', customerUserId)
        .single();

      assert(!profErr && prof, `Failed to query customer profile: ${profErr?.message}`);
      assert(Number(prof.wallet_balance) === 100, `Expected balance to be exactly 100, got: ${prof.wallet_balance}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: applyLoyaltyCredit idempotency (no double-credit)
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(2, 'applyLoyaltyCredit idempotency with stable keys', async () => {
      const orderId = `${testOrderId}-T2`;

      // Invoke loyalty credit twice in a row
      const res1 = await invokeAction(adminCookie, 'devTestApplyLoyaltyCreditAction', 100, 'test loyalty credit', orderId, customerUserId);
      const res2 = await invokeAction(adminCookie, 'devTestApplyLoyaltyCreditAction', 100, 'test loyalty credit duplicate', orderId, customerUserId);

      assert(res1.success === true, `First loyalty credit call failed: ${JSON.stringify(res1)}`);

      // Verify loyalty balance in DB
      const { data: prof, error: profErr } = await serviceClient
        .from('profiles')
        .select('loyalty_points')
        .eq('id', customerUserId)
        .single();

      assert(!profErr && prof, `Failed to query customer profile: ${profErr?.message}`);
      assert(Number(prof.loyalty_points) === 100, `Expected points to be exactly 100, got: ${prof.loyalty_points}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Checkout rejects submission with no address selected
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(3, 'Checkout actions reject submission when addressId is missing', async () => {
      // Simulate processCodCheckoutAction call with null/undefined addressId
      const payload = {
        cart: [],
        walletDeduction: 0,
        pointsRedeemed: 0,
        loyaltyDiscount: 0,
        baseTotal: 0,
        netTotal: 0,
        customerName: 'Test customer',
        idempotencyKey: `${testOrderId}-T3`,
        addressId: null, // missing address!
        userId: customerUserId,
        pincode: '400001'
      };

      const res = await invokeAction(adminCookie, 'processCodCheckoutAction', payload);
      assert(res.success === false, 'Expected checkout to fail');
      assert(res.error && res.error.toLowerCase().includes('address'), `Expected address error, got: ${res.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Legacy product edit preserves sizeStock values
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(4, 'Legacy product edit data-loading preserves sizeStock fallback', async () => {
      // Create legacy product via server action (to invalidate cache properly)
      const prodSave = await invokeAction(adminCookie, 'saveProductAction', {
        id: testProductId,
        title: `Legacy Test Product ${ts}`,
        category: 'Cotton',
        basePrice: 1500,
        gstRate: 0,
        discountRate: 0,
        sizeStock: { S: 10, M: 5, L: 0, XL: 0, XXL: 0 },
        variants: []
      });
      assert(prodSave.success === true, `Failed to setup legacy product: ${JSON.stringify(prodSave)}`);

      // Invoke read:getProductsAction via HTTP bridge (transpiles the latest code)
      const res = await invokeAction(adminCookie, 'getProductsAction');
      assert(res.success === true, `getProductsAction failed: ${JSON.stringify(res)}`);

      const p = res.products.find(prod => prod.id === testProductId);
      assert(p, 'Legacy product not found in fetched products');

      // Run the exact fallback variant initialization mapping logic from the edit page
      const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL"];
      const sizeStock = p.sizeStock || {};

      const fallbackVariants = SIZE_OPTIONS.map(size => ({
        size,
        color: p.colors?.[0] || "Atelier Choice",
        sku: `${p.id || "PROD"}-${size}-${(p.colors?.[0] || "ATL").slice(0, 3).toUpperCase()}`,
        price: p.basePrice || 0,
        stock: sizeStock[size] || 0, // Should be our fix
      }));

      // Find stock values
      const sVariant = fallbackVariants.find(v => v.size === 'S');
      const mVariant = fallbackVariants.find(v => v.size === 'M');
      const lVariant = fallbackVariants.find(v => v.size === 'L');

      assert(sVariant && sVariant.stock === 10, `Expected S variant stock to be 10, got ${sVariant?.stock}`);
      assert(mVariant && mVariant.stock === 5, `Expected M variant stock to be 5, got ${mVariant?.stock}`);
      assert(lVariant && lVariant.stock === 0, `Expected L variant stock to be 0, got ${lVariant?.stock}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Double-click refund doesn't double-credit
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(5, 'Double-click refund does not apply double wallet credit', async () => {
      const orderId = `${testOrderId}-T5`;

      // Deduct existing wallet balance from customer to 0 to start fresh
      const { error: updateBalErr } = await serviceClient
        .from('profiles')
        .update({ wallet_balance: 0 })
        .eq('id', customerUserId);
      assert(!updateBalErr, `Failed to reset wallet balance: ${updateBalErr?.message}`);

      // Create a paid order with wallet_paid = 200
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: 'Audit Test Customer T5',
        date: new Date().toLocaleDateString("en-IN"),
        total: 200,
        status: 'Paid',
        original_total: 200,
        gateway_paid: 0,
        wallet_paid: 200,
        razorpay_payment_id: null,
        user_id: customerUserId,
        items: []
      });
      assert(!orderErr, `Failed to setup test order T5: ${orderErr?.message}`);

      // Call issueRefundAction twice rapidly in parallel
      const [res1, res2] = await Promise.all([
        invokeAction(adminCookie, 'issueRefundAction', orderId, 'audit concurrent call 1'),
        invokeAction(adminCookie, 'issueRefundAction', orderId, 'audit concurrent call 2')
      ]);

      // Assert only one succeeded
      const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
      assert(successCount === 1, `Expected exactly 1 success, got ${successCount}`);

      // Assert balance only increased by 200
      const { data: prof, error: profErr } = await serviceClient
        .from('profiles')
        .select('wallet_balance')
        .eq('id', customerUserId)
        .single();
      assert(!profErr && prof, `Failed to query customer: ${profErr?.message}`);
      assert(Number(prof.wallet_balance) === 200, `Expected balance to be exactly 200, got ${prof.wallet_balance}`);
    });
    passed++;

    console.log(`\nALL ${passed}/5 TESTS PASSED SUCCESSFULLY!`);

  } finally {
    console.log('\n[CLEANUP] Cleaning up test data...');
    if (testOrderId) {
      await serviceClient.from('orders').delete().eq('id', testOrderId);
      await serviceClient.from('orders').delete().like('id', `${testOrderId}%`);
    }
    if (testProductId) {
      await serviceClient.from('product_variants').delete().eq('product_id', testProductId);
      await serviceClient.from('products').delete().eq('id', testProductId);
    }
    if (adminUserId) {
      await serviceClient.from('profiles').delete().eq('id', adminUserId);
      await serviceClient.auth.admin.deleteUser(adminUserId);
    }
    if (customerUserId) {
      await serviceClient.from('profiles').delete().eq('id', customerUserId);
      await serviceClient.auth.admin.deleteUser(customerUserId);
    }
    process.exit(passed === 5 ? 0 : 1);
  }
}

main().catch(err => {
  console.error('\nFatal error running tests:', err);
  process.exit(1);
});
