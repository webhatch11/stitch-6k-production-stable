'use strict';

/**
 * Day 9.5 Server Action Wrappers Integration Tests
 *
 * Pattern: same as scratch/test-day8.js. Boot dev server if needed.
 * Use service-role Supabase client for setup/cleanup.
 */

const path = require('path');
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

// Extract project ref from URL
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
  } else if (actionName.includes('Order')) {
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
  console.log('║  Day 9.5 Server Action Wrappers Integration Tests        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Project ref : ${PROJECT_REF}`);
  console.log(`API base    : ${BASE_URL}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 29;

  // Setup test users
  const adminEmail = `admin-day9-5-${ts}@example.com`;
  const customerEmail = `customer-day9-5-${ts}@example.com`;
  const password = 'TestPass123!';

  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;
  let customerCookie = null;

  const testProductId = `DAY95TEST-A-${ts}`;
  const testOrderId = `DAY95-ORD-${ts}`;
  let testCouponId = null;
  const testCouponCode = `DAY95-TEST-${ts}`.toUpperCase();

  try {
    // 1. Explain direct import limitation (as requested)
    console.log('\n[DIRECT IMPORT VERIFICATION]');
    console.log('  Direct imports of server actions into Node.js fail because standalone Node');
    console.log('  cannot resolve Next.js config/aliases (@/*), next/headers async storage,');
    console.log('  and lack Next.js compiler transpilation.');
    console.log('  -> SKIP direct action imports: fallback to HTTP dev-server runner route.');

    // 2. Setup DB test users
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

    // ─────────────────────────────────────────────────────────────────────────
    // ==== READ ACTIONS ====
    // ─────────────────────────────────────────────────────────────────────────

    // TEST 1: getProductsAction returns products array as admin
    await runTest(1, 'getProductsAction returns products array as admin', async () => {
      const res = await invokeAction(adminCookie, 'getProductsAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.products), 'Expected res.products to be an array');
    });
    passed++;

    // TEST 2: getOrdersAction works
    await runTest(2, 'getOrdersAction works', async () => {
      const res = await invokeAction(adminCookie, 'getOrdersAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.orders), 'Expected res.orders to be an array');
    });
    passed++;

    // TEST 3: getCustomersAction works
    await runTest(3, 'getCustomersAction works', async () => {
      const res = await invokeAction(adminCookie, 'getCustomersAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.customers), 'Expected res.customers to be an array');
    });
    passed++;

    // TEST 4: getCouponsAction works
    await runTest(4, 'getCouponsAction works', async () => {
      const res = await invokeAction(adminCookie, 'getCouponsAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.coupons), 'Expected res.coupons to be an array');
    });
    passed++;

    // TEST 5: getDashboardMetricsAction works
    await runTest(5, 'getDashboardMetricsAction works', async () => {
      const res = await invokeAction(adminCookie, 'getDashboardMetricsAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(res.metrics, 'Expected res.metrics to exist');
    });
    passed++;

    // TEST 6: All read actions reject when called without admin auth
    await runTest(6, 'All read actions reject when called without admin auth', async () => {
      const actions = [
        'getProductsAction',
        'getOrdersAction',
        'getCustomersAction',
        'getCouponsAction',
        'getDashboardMetricsAction'
      ];
      for (const act of actions) {
        const res = await invokeAction(customerCookie, act);
        assert(res.success === false || res.error?.includes('Unauthorized'), `Action ${act} should reject customer, got: ${JSON.stringify(res)}`);
      }
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // ==== MUTATION: PRODUCTS ====
    // ─────────────────────────────────────────────────────────────────────────

    // TEST 7: saveProductAction creates a product
    await runTest(7, 'saveProductAction creates a product', async () => {
      const res = await invokeAction(adminCookie, 'saveProductAction', {
        id: testProductId,
        title: 'Test A',
        category: 'Cotton',
        basePrice: 1000,
        gstRate: 12,
        discountRate: 0,
        sizeStock: { S: 5, M: 5, L: 5, XL: 0, XXL: 0 },
        variants: [
          { size: "S", color: "Default", sku: `${testProductId}-S-DEF`, price: 1000, stock: 5 },
          { size: "M", color: "Default", sku: `${testProductId}-M-DEF`, price: 1000, stock: 5 },
          { size: "L", color: "Default", sku: `${testProductId}-L-DEF`, price: 1000, stock: 5 },
          { size: "XL", color: "Default", sku: `${testProductId}-XL-DEF`, price: 1000, stock: 0 },
          { size: "XXL", color: "Default", sku: `${testProductId}-XXL-DEF`, price: 1000, stock: 0 },
        ],
      });
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify in DB
      const { data: dbProd, error } = await serviceClient
        .from('products')
        .select('*')
        .eq('id', testProductId)
        .single();
      assert(!error && dbProd, `Product ${testProductId} not found in DB`);
      assert(dbProd.price === 1120, `Expected price to be 1120 (1000 * 1.12), got ${dbProd.price}`);

      // Verify variants
      const { data: variants, error: varErr } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      assert(!varErr && variants, 'Failed to query product_variants');
      assert(variants.length === 5, `Expected exactly 5 variants, got ${variants.length}`);

      const sVar = variants.find(v => v.size === 'S');
      const mVar = variants.find(v => v.size === 'M');
      const lVar = variants.find(v => v.size === 'L');
      const xlVar = variants.find(v => v.size === 'XL');
      const xxlVar = variants.find(v => v.size === 'XXL');

      assert(sVar && sVar.stock === 5, 'S variant stock expected 5');
      assert(mVar && mVar.stock === 5, 'M variant stock expected 5');
      assert(lVar && lVar.stock === 5, 'L variant stock expected 5');
      assert(xlVar && xlVar.stock === 0, 'XL variant stock expected 0');
      assert(xxlVar && xxlVar.stock === 0, 'XXL variant stock expected 0');
    });
    passed++;

    // TEST 8: saveProductAction rejects bad input (Zod validation)
    await runTest(8, 'saveProductAction rejects bad input (Zod validation)', async () => {
      const res = await invokeAction(adminCookie, 'saveProductAction', {
        title: '',
        basePrice: -10,
        category: 'Cotton'
      });
      assert(res.success === false, 'Expected success=false');
      assert(res.error?.includes('Validation failed'), `Expected validation error, got: ${res.error}`);
    });
    passed++;

    // TEST 9: restockProductAction increments all sizes
    await runTest(9, 'restockProductAction increments all sizes', async () => {
      const res = await invokeAction(adminCookie, 'restockProductAction', testProductId, 3);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('size, stock')
        .eq('product_id', testProductId);
      assert(!error && variants, 'Failed to query product_variants');

      const sVar = variants.find(v => v.size === 'S');
      const mVar = variants.find(v => v.size === 'M');
      const lVar = variants.find(v => v.size === 'L');
      const xlVar = variants.find(v => v.size === 'XL');
      const xxlVar = variants.find(v => v.size === 'XXL');

      assert(sVar && sVar.stock === 8, `S stock expected 8, got ${sVar?.stock}`);
      assert(mVar && mVar.stock === 8, `M stock expected 8, got ${mVar?.stock}`);
      assert(lVar && lVar.stock === 8, `L stock expected 8, got ${lVar?.stock}`);
      assert(xlVar && xlVar.stock === 3, `XL stock expected 3, got ${xlVar?.stock}`);
      assert(xxlVar && xxlVar.stock === 3, `XXL stock expected 3, got ${xxlVar?.stock}`);
    });
    passed++;

    // TEST 10: restockProductAction rejects non-positive amount
    await runTest(10, 'restockProductAction rejects non-positive amount', async () => {
      const res0 = await invokeAction(adminCookie, 'restockProductAction', testProductId, 0);
      assert(res0.success === false, 'Expected success=false for amount=0');

      const resNeg = await invokeAction(adminCookie, 'restockProductAction', testProductId, -5);
      assert(resNeg.success === false, 'Expected success=false for negative amount');

      const resFloat = await invokeAction(adminCookie, 'restockProductAction', testProductId, 1.5);
      assert(resFloat.success === false, 'Expected success=false for float amount');
    });
    passed++;

    // TEST 11: adjustProductSizeAction increments single size
    await runTest(11, 'adjustProductSizeAction increments single size', async () => {
      const res = await invokeAction(adminCookie, 'adjustProductSizeAction', testProductId, 'M', 2);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: mVariant, error } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('product_id', testProductId)
        .eq('size', 'M')
        .maybeSingle();
      assert(!error && mVariant, 'Failed to query M variant');
      assert(mVariant.stock === 10, `Expected M stock to be 10, got ${mVariant.stock}`);

      // Confirm other sizes unchanged (S was 8, L was 8, XL was 3, XXL was 3)
      const { data: variants, error: varErr } = await serviceClient
        .from('product_variants')
        .select('size, stock')
        .eq('product_id', testProductId);
      assert(!varErr && variants, 'Failed to query all variants');

      const sVar = variants.find(v => v.size === 'S');
      const lVar = variants.find(v => v.size === 'L');
      const xlVar = variants.find(v => v.size === 'XL');
      const xxlVar = variants.find(v => v.size === 'XXL');

      assert(sVar && sVar.stock === 8, `Expected S stock unchanged (8), got ${sVar?.stock}`);
      assert(lVar && lVar.stock === 8, `Expected L stock unchanged (8), got ${lVar?.stock}`);
      assert(xlVar && xlVar.stock === 3, `Expected XL stock unchanged (3), got ${xlVar?.stock}`);
      assert(xxlVar && xxlVar.stock === 3, `Expected XXL stock unchanged (3), got ${xxlVar?.stock}`);
    });
    passed++;

    // TEST 12: adjustProductSizeAction clamps to 0 on underflow
    await runTest(12, 'adjustProductSizeAction clamps to 0 on underflow', async () => {
      const res = await invokeAction(adminCookie, 'adjustProductSizeAction', testProductId, 'XL', -100);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: xlVariant, error } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('product_id', testProductId)
        .eq('size', 'XL')
        .maybeSingle();
      assert(!error && xlVariant, 'Failed to query XL variant');
      assert(xlVariant.stock === 0, `Expected XL stock clamped to 0, got ${xlVariant.stock}`);
    });
    passed++;

    // TEST 13: deleteProductAction soft-deletes a product
    await runTest(13, 'deleteProductAction soft-deletes a product', async () => {
      const res = await invokeAction(adminCookie, 'deleteProductAction', testProductId);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: dbProd, error } = await serviceClient
        .from('products')
        .select('*')
        .eq('id', testProductId)
        .single();
      assert(!error && dbProd, 'Product not found in DB');
      assert(dbProd.deleted_at !== null, 'Product deleted_at should not be null');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // ==== MUTATION: ORDERS ====
    // ─────────────────────────────────────────────────────────────────────────

    // TEST 14: bulkUpdateOrderStatusAction with valid status
    await runTest(14, 'bulkUpdateOrderStatusAction with valid status', async () => {
      // Insert test order
      const { error: orderInsErr } = await serviceClient.from('orders').insert({
        id: testOrderId,
        customer: 'Test Customer',
        date: new Date().toLocaleDateString("en-IN"),
        total: 100,
        status: 'Paid',
        original_total: 100,
        items: []
      });
      assert(!orderInsErr, `Insert test order failed: ${orderInsErr?.message}`);

      const res = await invokeAction(adminCookie, 'bulkUpdateOrderStatusAction', [testOrderId], 'Shipped');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(res.count === 1, `Expected updated count 1, got ${res.count}`);

      // Verify DB
      const { data: dbOrder } = await serviceClient
        .from('orders')
        .select('status')
        .eq('id', testOrderId)
        .single();
      assert(dbOrder.status === 'Shipped', `Expected order status Shipped, got ${dbOrder.status}`);
    });
    passed++;

    // TEST 15: bulkUpdateOrderStatusAction REJECTS unknown status (CRITICAL)
    await runTest(15, 'bulkUpdateOrderStatusAction REJECTS unknown status (CRITICAL)', async () => {
      const res = await invokeAction(adminCookie, 'bulkUpdateOrderStatusAction', [testOrderId], 'Hacked Status');
      assert(res.success === false, 'Expected success=false');
      assert(res.error?.includes('not permitted'), `Expected error to mention "not permitted", got: ${res.error}`);
    });
    passed++;

    // TEST 16: bulkUpdateOrderStatusAction rejects empty orderIds
    await runTest(16, 'bulkUpdateOrderStatusAction rejects empty orderIds', async () => {
      const res = await invokeAction(adminCookie, 'bulkUpdateOrderStatusAction', [], 'Shipped');
      assert(res.success === false, 'Expected success=false for empty order IDs');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // ==== MUTATION: COUPONS ====
    // ─────────────────────────────────────────────────────────────────────────

    // TEST 17: saveCouponAction with valid percent coupon
    await runTest(17, 'saveCouponAction with valid percent coupon', async () => {
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code: testCouponCode,
        type: 'percent',
        discount: 25,
        active: true
      });
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: dbCoupon, error } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('code', testCouponCode)
        .single();
      assert(!error && dbCoupon, 'Coupon not found in DB');
      assert(dbCoupon.discount === 25, `Expected discount 25, got ${dbCoupon.discount}`);
      assert(dbCoupon.type === 'percent', `Expected type percent, got ${dbCoupon.type}`);
      testCouponId = dbCoupon.id;
    });
    passed++;

    // TEST 18: saveCouponAction REJECTS percent > 100 (CRITICAL — Zod refine)
    await runTest(18, 'saveCouponAction REJECTS percent > 100 (CRITICAL)', async () => {
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code: 'BADCOUPON',
        type: 'percent',
        discount: 150,
        active: true
      });
      assert(res.success === false, 'Expected success=false for percent > 100');
      assert(res.error?.includes('Validation failed'), `Expected Zod validation error, got: ${res.error}`);
    });
    passed++;

    // TEST 19: saveCouponAction accepts flat coupon with discount > 100
    await runTest(19, 'saveCouponAction accepts flat coupon with discount > 100', async () => {
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code: 'FLAT500',
        type: 'flat',
        discount: 500,
        active: true
      });
      assert(res.success === true, `Expected success=true for flat coupon, got: ${JSON.stringify(res)}`);

      // Verify in DB
      const { data: dbCoupon } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('code', 'FLAT500')
        .single();
      assert(dbCoupon, 'Flat coupon FLAT500 not found in DB');
    });
    passed++;

    // TEST 20: deleteCouponAction removes the coupon
    await runTest(20, 'deleteCouponAction removes the coupon', async () => {
      assert(testCouponId, 'Expected testCouponId from TEST 17');
      const res = await invokeAction(adminCookie, 'deleteCouponAction', testCouponId);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: dbCoupon } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('id', testCouponId)
        .maybeSingle();
      assert(!dbCoupon, 'Coupon should be deleted from DB');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // ==== MUTATION: CUSTOMER BALANCE ====
    // ─────────────────────────────────────────────────────────────────────────

    // TEST 21: adjustCustomerBalanceAction wallet credit succeeds
    await runTest(21, 'adjustCustomerBalanceAction wallet credit succeeds', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'wallet', 100, 'test credit');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: prof } = await serviceClient
        .from('profiles')
        .select('wallet_balance')
        .eq('email', customerEmail)
        .single();
      assert(prof.wallet_balance === 600, `Expected wallet balance 600, got ${prof.wallet_balance}`);
    });
    passed++;

    // TEST 22: adjustCustomerBalanceAction wallet debit within balance
    await runTest(22, 'adjustCustomerBalanceAction wallet debit within balance', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'wallet', -200, 'test debit');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: prof } = await serviceClient
        .from('profiles')
        .select('wallet_balance')
        .eq('email', customerEmail)
        .single();
      assert(prof.wallet_balance === 400, `Expected wallet balance 400, got ${prof.wallet_balance}`);
    });
    passed++;

    // TEST 23: adjustCustomerBalanceAction wallet underflow REJECTED (CRITICAL)
    await runTest(23, 'adjustCustomerBalanceAction wallet underflow REJECTED (CRITICAL)', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'wallet', -999999, 'exploit attempt');
      assert(res.success === false, 'Expected success=false for extreme underflow');
      assert(res.error?.includes('Insufficient wallet credits'), `Expected insufficient credits error, got: ${res.error}`);

      // Verify DB unchanged
      const { data: prof } = await serviceClient
        .from('profiles')
        .select('wallet_balance')
        .eq('email', customerEmail)
        .single();
      assert(prof.wallet_balance === 400, `Expected wallet balance unchanged at 400, got ${prof.wallet_balance}`);
    });
    passed++;

    // TEST 24: adjustCustomerBalanceAction loyalty underflow REJECTED
    await runTest(24, 'adjustCustomerBalanceAction loyalty underflow REJECTED', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'loyalty', -500, 'exploit');
      assert(res.success === false, 'Expected success=false for loyalty underflow');
      assert(res.error?.includes('Insufficient loyalty points'), `Expected insufficient points error, got: ${res.error}`);

      // Verify DB unchanged
      const { data: prof } = await serviceClient
        .from('profiles')
        .select('loyalty_points')
        .eq('email', customerEmail)
        .single();
      assert(prof.loyalty_points === 100, `Expected loyalty points unchanged at 100, got ${prof.loyalty_points}`);
    });
    passed++;

    // TEST 25: adjustCustomerBalanceAction rejects zero amount
    await runTest(25, 'adjustCustomerBalanceAction rejects zero amount', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'wallet', 0, 'zero test');
      assert(res.success === false, 'Expected success=false for zero amount');
    });
    passed++;

    // TEST 26: adjustCustomerBalanceAction rejects invalid type
    await runTest(26, 'adjustCustomerBalanceAction rejects invalid type', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'bonus', 100, 'invalid type test');
      assert(res.success === false, 'Expected success=false for invalid type');
      assert(res.error?.includes('wallet') || res.error?.includes('loyalty'), `Expected error mentioning wallet or loyalty, got: ${res.error}`);
    });
    passed++;

    // TEST 27: adjustCustomerBalanceAction rejects missing reason
    await runTest(27, 'adjustCustomerBalanceAction rejects missing reason', async () => {
      const res = await invokeAction(adminCookie, 'adjustCustomerBalanceAction', customerEmail, 'wallet', 100, '');
      assert(res.success === false, 'Expected success=false for empty reason');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // ==== AUTH ENFORCEMENT ====
    // ─────────────────────────────────────────────────────────────────────────

    const mutationActions = [
      { name: 'saveProductAction', args: [{ id: testProductId, title: 'Auth check product', category: 'Cotton', basePrice: 100, gstRate: 12, discountRate: 0 }] },
      { name: 'restockProductAction', args: [testProductId, 5] },
      { name: 'adjustProductSizeAction', args: [testProductId, 'M', 2] },
      { name: 'deleteProductAction', args: [testProductId] },
      { name: 'bulkUpdateOrderStatusAction', args: [[testOrderId], 'Shipped'] },
      { name: 'saveCouponAction', args: [{ code: 'TESTCPN', type: 'percent', discount: 10 }] },
      { name: 'deleteCouponAction', args: ['dummy-id'] },
      { name: 'adjustCustomerBalanceAction', args: [customerEmail, 'wallet', 10, 'auth test'] },
    ];

    // TEST 28: Every mutation action rejects unauthenticated callers
    await runTest(28, 'Every mutation action rejects unauthenticated callers', async () => {
      for (const action of mutationActions) {
        const res = await invokeAction(null, action.name, ...action.args);
        assert(res.success === false, `Expected success=false for ${action.name} with no cookies`);
        assert(res.error?.includes('Unauthorized'), `Expected Unauthorized error for ${action.name}, got: ${res.error}`);
      }
    });
    passed++;

    // TEST 29: Every mutation action rejects customer (non-admin) callers
    await runTest(29, 'Every mutation action rejects customer (non-admin) callers', async () => {
      for (const action of mutationActions) {
        const res = await invokeAction(customerCookie, action.name, ...action.args);
        assert(res.success === false, `Expected success=false for ${action.name} with customer cookies`);
        assert(res.error?.includes('Unauthorized'), `Expected Unauthorized error for ${action.name}, got: ${res.error}`);
      }
    });
    passed++;

  } catch (err) {
    console.error(`\n!!! TEST PROCESS HALTED: ${err.message}`);
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // ==== CLEANUP ────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test data...');

    // Delete test product
    try {
      await serviceClient.from('product_variants').delete().eq('product_id', testProductId);
      await serviceClient.from('products').delete().eq('id', testProductId);
      console.log('  Product cleanup completed.');
    } catch (e) {
      console.warn('  Product cleanup warning:', e.message);
    }

    // Delete test order
    try {
      await serviceClient.from('orders').delete().eq('id', testOrderId);
      console.log('  Order cleanup completed.');
    } catch (e) {
      console.warn('  Order cleanup warning:', e.message);
    }

    // Delete test coupons
    try {
      await serviceClient.from('coupons').delete().eq('code', testCouponCode);
      await serviceClient.from('coupons').delete().eq('code', 'FLAT500');
      await serviceClient.from('coupons').delete().eq('code', 'BADCOUPON');
      console.log('  Coupon cleanup completed.');
    } catch (e) {
      console.warn('  Coupon cleanup warning:', e.message);
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
  console.log(`║  Results: ${passed}/${total} passed                                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  stopManagedServer();
  process.exit(1);
});
