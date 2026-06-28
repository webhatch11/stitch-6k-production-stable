'use strict';

const path = require('path');
const { spawn, execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Config
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

// Dev-server management
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
    prefixedActionName = 'read:' + actionName; // getBestSellersAction is in read namespace
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

// Compile TypeScript files for importing db adapter
console.log("Compiling database adapter and registry files for test script...");
try {
  execSync('npx -y esbuild lib/db.ts --bundle --platform=node --outfile=scratch/db.js --external:ioredis --external:bullmq --external:@supabase/supabase-js --external:@supabase/ssr --external:zod --external:react --external:react-dom --external:next --external:razorpay', { stdio: 'ignore' });
  console.log("Compilation successful!\n");
} catch (err) {
  console.error("Compilation failed.", err);
  process.exit(1);
}

const { db } = require('./db.js');

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Audit Sprint D - Best Sellers Report Tests              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 4;

  const adminEmail = `admin-audit-d-${ts}@example.com`;
  const customerEmail = `customer-audit-d-${ts}@example.com`;
  const password = 'TestPass123!';
  
  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;
  let customerCookie = null;

  const prodA = `AUDIT-D-PROD-A-${ts}`;
  const prodB = `AUDIT-D-PROD-B-${ts}`;

  try {
    // Setup Admin User
    console.log('\n[SETUP] Creating admin user...');
    const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    assert(!adminAuthErr, `Admin creation failed: ${adminAuthErr?.message}`);
    adminUserId = adminAuth.user.id;

    // Update profile role
    const { error: adminProfErr } = await serviceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId);
    assert(!adminProfErr, `Admin profile update failed: ${adminProfErr?.message}`);

    // Sign in to get admin cookies
    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);
    console.log('  Admin session and cookies set up.');

    // Setup Customer User
    console.log('[SETUP] Creating customer user...');
    const { data: customerAuth, error: customerAuthErr } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password: password,
      email_confirm: true,
    });
    assert(!customerAuthErr, `Customer creation failed: ${customerAuthErr?.message}`);
    customerUserId = customerAuth.user.id;

    // Sign in to get customer cookies
    const { data: customerSignIn, error: customerSignInErr } = await anonClient.auth.signInWithPassword({
      email: customerEmail,
      password,
    });
    assert(!customerSignInErr, `Customer sign-in failed: ${customerSignInErr?.message}`);
    customerCookie = buildAuthCookieHeader(customerSignIn.session);
    console.log('  Customer session and cookies set up.');

    // Save test products
    console.log('[SETUP] Inserting test products...');
    const pA = await db.saveProduct({
      id: prodA,
      title: 'Audit D Product A',
      price: 1000,
      basePrice: 1000,
      variants: [{ size: 'M', color: 'Black', stock: 50 }]
    });
    const pB = await db.saveProduct({
      id: prodB,
      title: 'Audit D Product B',
      price: 2000,
      basePrice: 2000,
      variants: [{ size: 'M', color: 'Black', stock: 50 }]
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: getBestSellersAction requires admin
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(1, 'getBestSellersAction requires admin', async () => {
      // Anonymous
      const anonRes = await invokeAction(null, 'getBestSellersAction', 'all');
      assert(anonRes.success === false, 'Expected anonymous caller to be rejected');
      assert(anonRes.error === 'Unauthorized', `Expected Unauthorized error, got: ${anonRes.error}`);

      // Customer
      const custRes = await invokeAction(customerCookie, 'getBestSellersAction', 'all');
      assert(custRes.success === false, 'Expected customer caller to be rejected');
      assert(custRes.error === 'Unauthorized', `Expected Unauthorized error, got: ${custRes.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Returns sorted array by units desc by default
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(2, 'Returns sorted array by units desc by default', async () => {
      const order1 = `AUDIT-D-ORD-T2-1-${ts}`;
      const order2 = `AUDIT-D-ORD-T2-2-${ts}`;

      const { error: err1 } = await serviceClient.from('orders').insert({
        id: order1,
        customer: `customer-audit-d-${ts}`,
        date: new Date().toLocaleDateString("en-IN"),
        total: 10000,
        original_total: 10000,
        gateway_paid: 10000,
        status: 'Paid',
        cart_items: [{ productId: prodA, quantity: 10, price: 1000 }]
      });
      assert(!err1, `Order 1 creation failed: ${err1?.message}`);

      const { error: err2 } = await serviceClient.from('orders').insert({
        id: order2,
        customer: `customer-audit-d-${ts}`,
        date: new Date().toLocaleDateString("en-IN"),
        total: 40000,
        original_total: 40000,
        gateway_paid: 40000,
        status: 'Paid',
        cart_items: [{ productId: prodB, quantity: 20, price: 2000 }]
      });
      assert(!err2, `Order 2 creation failed: ${err2?.message}`);

      const res = await invokeAction(adminCookie, 'getBestSellersAction', 'all');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.data), 'Expected data to be an array');

      const filtered = res.data.filter(x => x.productId === prodA || x.productId === prodB);
      assert(filtered.length === 2, `Expected 2 test products, got: ${filtered.length}`);

      assert(filtered[0].productId === prodB, `Expected first to be prodB, got: ${filtered[0].productId}`);
      assert(filtered[0].unitsSold === 20, `Expected 20 units sold for prodB, got: ${filtered[0].unitsSold}`);
      assert(filtered[1].productId === prodA, `Expected second to be prodA, got: ${filtered[1].productId}`);
      assert(filtered[1].unitsSold === 10, `Expected 10 units sold for prodA, got: ${filtered[1].unitsSold}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Date range filter works
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(3, 'Date range filter works', async () => {
      const prodC = `AUDIT-D-PROD-C-${ts}`;
      await db.saveProduct({
        id: prodC,
        title: 'Audit D Product C',
        price: 1500,
        basePrice: 1500,
        variants: [{ size: 'M', color: 'Black', stock: 50 }]
      });

      const orderOld = `AUDIT-D-ORD-T3-OLD-${ts}`;
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const { error: errOld } = await serviceClient.from('orders').insert({
        id: orderOld,
        customer: `customer-audit-d-${ts}`,
        date: tenDaysAgo.toLocaleDateString("en-IN"),
        total: 1500,
        original_total: 1500,
        gateway_paid: 1500,
        status: 'Paid',
        cart_items: [{ productId: prodC, quantity: 5, price: 1500 }],
        created_at: tenDaysAgo.toISOString()
      });
      assert(!errOld, `Old order creation failed: ${errOld?.message}`);

      const res7d = await invokeAction(adminCookie, 'getBestSellersAction', '7d');
      assert(res7d.success === true, 'res7d failed');
      const containsC_7d = res7d.data.some(x => x.productId === prodC);
      assert(!containsC_7d, 'Expected Product C to be excluded in 7d range');

      const res30d = await invokeAction(adminCookie, 'getBestSellersAction', '30d');
      assert(res30d.success === true, 'res30d failed');
      const containsC_30d = res30d.data.some(x => x.productId === prodC);
      assert(containsC_30d, 'Expected Product C to be included in 30d range');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Cancelled and fully refunded orders excluded
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(4, 'Cancelled and fully refunded orders excluded', async () => {
      const prodD = `AUDIT-D-PROD-D-${ts}`;
      await db.saveProduct({
        id: prodD,
        title: 'Audit D Product D',
        price: 1500,
        basePrice: 1500,
        variants: [{ size: 'M', color: 'Black', stock: 50 }]
      });

      const orderCancel = `AUDIT-D-ORD-T4-CAN-${ts}`;
      const { error: errCan } = await serviceClient.from('orders').insert({
        id: orderCancel,
        customer: `customer-audit-d-${ts}`,
        date: new Date().toLocaleDateString("en-IN"),
        total: 1500,
        original_total: 1500,
        gateway_paid: 1500,
        status: 'Cancelled',
        cart_items: [{ productId: prodD, quantity: 5, price: 1500 }]
      });
      assert(!errCan, `Cancelled order creation failed: ${errCan?.message}`);

      const orderRefund = `AUDIT-D-ORD-T4-REF-${ts}`;
      const { error: errRef } = await serviceClient.from('orders').insert({
        id: orderRefund,
        customer: `customer-audit-d-${ts}`,
        date: new Date().toLocaleDateString("en-IN"),
        total: 1500,
        original_total: 1500,
        gateway_paid: 1500,
        status: 'Returned',
        refund_status: 'processed',
        cart_items: [{ productId: prodD, quantity: 5, price: 1500 }]
      });
      assert(!errRef, `Refunded order creation failed: ${errRef?.message}`);

      const res = await invokeAction(adminCookie, 'getBestSellersAction', 'all');
      assert(res.success === true, 'getBestSellersAction failed');
      const containsD = res.data.some(x => x.productId === prodD);
      assert(!containsD, 'Expected Product D to be completely excluded from best-sellers report');
    });
    passed++;

  } finally {
    // CLEANUP
    console.log('\n[CLEANUP] Deleting test products, orders, and users...');
    try {
      await serviceClient.from('orders').delete().like('id', 'AUDIT-D-ORD-%');
      console.log('  Test orders deleted.');
    } catch (e) {
      console.warn('  Error cleaning test orders:', e.message);
    }
    try {
      await serviceClient.from('products').delete().like('id', 'AUDIT-D-PROD-%');
      console.log('  Test products deleted.');
    } catch (e) {
      console.warn('  Error cleaning test products:', e.message);
    }

    if (adminUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(adminUserId);
        console.log('  Admin test user deleted.');
      } catch (e) {
        console.warn('  Admin test user deletion warning:', e.message);
      }
    }
    if (customerUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(customerUserId);
        console.log('  Customer test user deleted.');
      } catch (e) {
        console.warn('  Customer test user deletion warning:', e.message);
      }
    }
    console.log('[CLEANUP] Done.');
  }

  stopManagedServer();

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
