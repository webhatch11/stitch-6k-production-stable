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
  if (actionName === 'getCouponDiscountTotalAction') {
    prefixedActionName = 'coupon:' + actionName;
  } else if (actionName.startsWith('get')) {
    prefixedActionName = 'read:' + actionName;
  } else if (actionName.includes('Coupon')) {
    prefixedActionName = 'coupon:' + actionName;
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
  console.log('║  Audit Sprint A - Coupon Validation & Constraints Tests  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 7;

  const adminEmail = `admin-audit-a-${ts}@example.com`;
  const password = 'TestPass123!';
  let adminUserId = null;
  let adminCookie = null;

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

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: saveCouponAction with min_cart_value=500, max_usage=10, expiry_date='2026-12-31' saves all three fields correctly
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(1, 'saveCouponAction saves constraints correctly', async () => {
      const code = `AUDIT-A-T1-${ts}`.toUpperCase();
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code,
        type: 'percent',
        discount: 10,
        active: true,
        min_cart_value: 500,
        max_usage: 10,
        expiry_date: '2026-12-31'
      });
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify directly in DB
      const { data: dbCoupon, error } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('code', code)
        .single();
      assert(!error && dbCoupon, 'Coupon not found in DB');
      assert(dbCoupon.min_cart_value === 500, `Expected min_cart_value 500, got ${dbCoupon.min_cart_value}`);
      assert(dbCoupon.max_usage === 10, `Expected max_usage 10, got ${dbCoupon.max_usage}`);
      assert(dbCoupon.expiry_date && dbCoupon.expiry_date.startsWith('2026-12-31'), `Expected expiry_date 2026-12-31, got ${dbCoupon.expiry_date}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: saveCouponAction with missing optional fields uses defaults
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(2, 'saveCouponAction uses defaults for optional fields', async () => {
      const code = `AUDIT-A-T2-${ts}`.toUpperCase();
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code,
        type: 'flat',
        discount: 100,
        active: true
      });
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify directly in DB
      const { data: dbCoupon, error } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('code', code)
        .single();
      assert(!error && dbCoupon, 'Coupon not found in DB');
      assert(dbCoupon.min_cart_value === 0, `Expected min_cart_value default 0, got ${dbCoupon.min_cart_value}`);
      assert(dbCoupon.max_usage === null, `Expected max_usage default null, got ${dbCoupon.max_usage}`);
      assert(dbCoupon.expiry_date === null, `Expected expiry_date default null, got ${dbCoupon.expiry_date}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: saveCouponAction rejects negative min_cart_value
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(3, 'saveCouponAction rejects negative min_cart_value', async () => {
      const code = `AUDIT-A-T3-${ts}`.toUpperCase();
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code,
        type: 'percent',
        discount: 10,
        active: true,
        min_cart_value: -100
      });
      assert(res.success === false, 'Expected saveCouponAction to fail for negative min_cart_value');
      assert(res.error?.includes('Validation failed'), `Expected validation error, got: ${res.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: validateCoupon enforces min_cart_value at checkout
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(4, 'validateCoupon enforces min_cart_value', async () => {
      const code = `AUDIT-A-T4-${ts}`.toUpperCase();
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code,
        type: 'percent',
        discount: 15,
        active: true,
        min_cart_value: 1000
      });
      assert(res.success === true, 'Failed to create coupon for TEST 4');

      // Call validateCoupon directly via local db object
      const rejectRes = await db.validateCoupon(code, 500);
      assert(rejectRes.valid === false, 'Expected coupon to be rejected for cart total 500');
      assert(rejectRes.error?.includes('Minimum cart value'), `Expected min cart error message, got: ${rejectRes.error}`);

      const acceptRes = await db.validateCoupon(code, 1500);
      assert(acceptRes.valid === true, `Expected coupon to be accepted for cart total 1500, got error: ${acceptRes.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: validateCoupon enforces max_usage
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(5, 'validateCoupon enforces max_usage limit', async () => {
      const code = `AUDIT-A-T5-${ts}`.toUpperCase();
      const res = await invokeAction(adminCookie, 'saveCouponAction', {
        code,
        type: 'percent',
        discount: 5,
        active: true,
        max_usage: 1
      });
      assert(res.success === true, 'Failed to create coupon for TEST 5');

      // Update usage_count directly in Supabase
      const { error: updateErr } = await serviceClient
        .from('coupons')
        .update({ usage_count: 1 })
        .eq('code', code);
      assert(!updateErr, `Failed to update usage count: ${updateErr?.message}`);

      // Call validateCoupon directly
      const rejectRes = await db.validateCoupon(code, 100);
      assert(rejectRes.valid === false, 'Expected coupon to be rejected due to usage limit');
      assert(rejectRes.error?.includes('limit has been reached'), `Expected limit error message, got: ${rejectRes.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: getCouponsAction returns usage_count field
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(6, 'getCouponsAction returns usage_count field', async () => {
      const res = await invokeAction(adminCookie, 'getCouponsAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.coupons), 'Expected coupons to be an array');
      
      // Check that entries have a usage_count field (or usageCount)
      for (const c of res.coupons) {
        assert(c.usageCount !== undefined || c.usage_count !== undefined, `Coupon ${c.code} is missing usageCount / usage_count`);
      }
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: getCouponDiscountTotalAction aggregates coupon discounts correctly
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(7, 'getCouponDiscountTotalAction aggregates coupon discounts', async () => {
      const testCode = `AUDIT-A-T7-CODE-${ts}`.toUpperCase();
      const orderId = `AUDIT-A-ORD-${ts}`;
      
      // Insert a dummy order with coupon discount directly
      const { data: order, error: orderErr } = await serviceClient
        .from('orders')
        .insert({
          id: orderId,
          customer: `customer-audit-a-t7-${ts}`,
          date: new Date().toLocaleDateString("en-IN"),
          total: 1000,
          original_total: 1000,
          gateway_paid: 1000,
          wallet_paid: 0,
          items: [],
          status: 'Paid',
          coupon_code: testCode,
          coupon_discount: 250
        })
        .select()
        .single();
      assert(!orderErr && order, `Failed to create dummy order: ${orderErr?.message}`);
      
      try {
        const res = await invokeAction(adminCookie, 'getCouponDiscountTotalAction');
        assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
        assert(res.total >= 250, `Expected total discount to be at least 250, got: ${res.total}`);
        assert(res.perCoupon[testCode] === 250, `Expected perCoupon[${testCode}] to be 250, got: ${res.perCoupon[testCode]}`);
      } finally {
        // Delete dummy order
        const { error: delOrderErr } = await serviceClient
          .from('orders')
          .delete()
          .eq('id', order.id);
        if (delOrderErr) console.warn('  Error deleting dummy order:', delOrderErr.message);
      }
    });
    passed++;

  } finally {
    // CLEANUP
    console.log('\n[CLEANUP] Deleting test coupons and admin user...');
    try {
      const { error: delErr } = await serviceClient
        .from('coupons')
        .delete()
        .like('code', 'AUDIT-A-T%');
      if (delErr) console.warn('  Error deleting test coupons:', delErr.message);
      else console.log('  Test coupons deleted.');
    } catch (e) {
      console.warn('  Exception during coupons cleanup:', e.message);
    }

    if (adminUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(adminUserId);
        console.log('  Admin test user deleted.');
      } catch (e) {
        console.warn('  Admin test user deletion warning:', e.message);
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
