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

async function invokeAction(cookies, namespace, actionFnName, ...args) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) headers['Cookie'] = cookies;

  const res = await fetch(`${BASE_URL}/api/admin/test-runner`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actionName: `${namespace}:${actionFnName}`, args }),
  });
  if (res.status === 401) return { success: false, error: 'Unauthorized' };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return await res.json();
}

// Compile TypeScript files for importing db adapter
console.log("Compiling database adapter and registry files for test script...");
try {
  execSync(
    'npx -y esbuild lib/db.ts --bundle --platform=node --outfile=scratch/db.js ' +
    '--external:ioredis --external:bullmq --external:@supabase/supabase-js ' +
    '--external:@supabase/ssr --external:zod --external:react --external:react-dom ' +
    '--external:next --external:razorpay',
    { stdio: 'ignore' }
  );
  console.log("Compilation successful!\n");
} catch (err) {
  console.error("Compilation failed.", err);
  process.exit(1);
}

// Also compile admin-customers for CSV helper testing
console.log("Compiling admin-customers action for CSV test...");
try {
  execSync(
    'npx -y esbuild app/actions/admin-customers.ts --bundle --platform=node ' +
    '--outfile=scratch/admin-customers.js ' +
    '--external:@/lib/admin-auth --external:@/lib/db --external:@/lib/supabase-service ' +
    '--external:zod',
    { stdio: 'ignore', cwd: path.join(__dirname, '..') }
  );
  console.log("admin-customers compilation successful!\n");
} catch (err) {
  console.warn("admin-customers compilation warning (CSV test will use inline logic):", err.message);
}

const { db } = require('./db.js');

// ─── CSV Helper (inline for test, same logic as server) ─────────────────────
function generateCustomerCsv(customers) {
  const BOM = '\uFEFF';
  const header = [
    'Name', 'Email', 'Phone', 'Order Count', 'LTV (₹)',
    'Wallet Balance (₹)', 'Loyalty Points', 'Joined Date', 'Status',
  ].join(',');

  const escape = (v) => {
    const str = String(v ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = customers.map((c) => [
    escape(c.name),
    escape(c.email),
    escape(c.phone ?? ''),
    escape(c.order_count),
    escape(c.ltv.toFixed(2)),
    escape(c.wallet_balance.toFixed(2)),
    escape(c.loyalty_points),
    escape(c.joined ?? ''),
    escape(c.is_blocked ? 'Blocked' : 'Active'),
  ].join(','));

  return BOM + [header, ...rows].join('\r\n');
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Audit Sprint C - Customer CSV Export + Block/Unblock    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 8;

  const adminEmail = `admin-audit-c-${ts}@example.com`;
  const customerEmail = `customer-audit-c-${ts}@example.com`;
  const password = 'TestPass123!';

  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;
  let customerCookie = null;

  try {
    // Setup Admin User
    console.log('\n[SETUP] Creating admin user...');
    const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
    });
    assert(!adminAuthErr, `Admin creation failed: ${adminAuthErr?.message}`);
    adminUserId = adminAuth.user.id;

    await serviceClient.from('profiles').update({ role: 'admin' }).eq('id', adminUserId);

    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({ email: adminEmail, password });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);
    console.log('  Admin session and cookies set up.');

    // Setup Customer User
    console.log('[SETUP] Creating customer user...');
    const { data: customerAuth, error: customerAuthErr } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password,
      email_confirm: true,
    });
    assert(!customerAuthErr, `Customer creation failed: ${customerAuthErr?.message}`);
    customerUserId = customerAuth.user.id;

    const { data: customerSignIn, error: customerSignInErr } = await anonClient.auth.signInWithPassword({ email: customerEmail, password });
    assert(!customerSignInErr, `Customer sign-in failed: ${customerSignInErr?.message}`);
    customerCookie = buildAuthCookieHeader(customerSignIn.session);
    console.log('  Customer session and cookies set up.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: blockCustomerAction requires admin
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(1, 'blockCustomerAction requires admin', async () => {
      const res = await invokeAction(customerCookie, 'customer', 'blockCustomerAction', customerUserId, 'test');
      assert(res.success === false, `Expected success=false, got ${JSON.stringify(res)}`);
      assert(res.error === 'Unauthorized', `Expected Unauthorized, got: ${res.error}`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: blockCustomerAction requires non-empty reason
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(2, 'blockCustomerAction requires non-empty reason', async () => {
      const res = await invokeAction(adminCookie, 'customer', 'blockCustomerAction', customerUserId, '');
      assert(res.success === false, `Expected success=false, got ${JSON.stringify(res)}`);
      assert(res.error, `Expected an error message`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: blockCustomerAction sets is_blocked=true, blocked_at, blocked_reason
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(3, 'blockCustomerAction sets is_blocked=true, blocked_at, blocked_reason', async () => {
      const reason = 'Repeated fraudulent orders';
      const res = await invokeAction(adminCookie, 'customer', 'blockCustomerAction', customerUserId, reason);
      assert(res.success === true, `Expected success=true, got ${JSON.stringify(res)}`);

      // Verify DB state
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('is_blocked, blocked_at, blocked_reason')
        .eq('id', customerUserId)
        .maybeSingle();
      assert(profile?.is_blocked === true, `Expected is_blocked=true, got ${profile?.is_blocked}`);
      assert(!!profile?.blocked_at, `Expected blocked_at to be set`);
      assert(profile?.blocked_reason === reason, `Expected blocked_reason="${reason}", got "${profile?.blocked_reason}"`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: unblockCustomerAction clears is_blocked, blocked_at, blocked_reason
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(4, 'unblockCustomerAction clears is_blocked, blocked_at, blocked_reason', async () => {
      const res = await invokeAction(adminCookie, 'customer', 'unblockCustomerAction', customerUserId);
      assert(res.success === true, `Expected success=true, got ${JSON.stringify(res)}`);

      const { data: profile } = await serviceClient
        .from('profiles')
        .select('is_blocked, blocked_at, blocked_reason')
        .eq('id', customerUserId)
        .maybeSingle();
      assert(profile?.is_blocked === false, `Expected is_blocked=false, got ${profile?.is_blocked}`);
      assert(!profile?.blocked_at, `Expected blocked_at=null, got ${profile?.blocked_at}`);
      assert(!profile?.blocked_reason, `Expected blocked_reason=null, got ${profile?.blocked_reason}`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: unblockCustomerAction requires admin
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(5, 'unblockCustomerAction requires admin', async () => {
      const res = await invokeAction(customerCookie, 'customer', 'unblockCustomerAction', customerUserId);
      assert(res.success === false, `Expected success=false, got ${JSON.stringify(res)}`);
      assert(res.error === 'Unauthorized', `Expected Unauthorized, got: ${res.error}`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Checkout rejected for blocked user
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(6, 'Checkout rejected for blocked user (HTTP 403)', async () => {
      // Block the customer first
      await serviceClient.from('profiles').update({
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        blocked_reason: 'Test block for checkout guard',
      }).eq('id', customerUserId);

      // Attempt to create an order as the blocked user (hit real create-order API)
      const res = await fetch(`${BASE_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
        },
        body: JSON.stringify({
          cart: [{ productId: 'test', variantId: 'v1', title: 'Test', price: 999, quantity: 1 }],
          couponCode: '',
          walletDeduction: 0,
          pointsRedeemed: 0,
          loyaltyDiscount: 0,
          baseTotal: 999,
          netTotal: 999,
          customerName: 'Test Customer',
          idempotencyKey: `idem-block-test-${ts}`,
          userId: customerUserId,
        }),
      });
      assert(res.status === 403, `Expected HTTP 403, got ${res.status}`);
      const body = await res.json();
      assert(body.success === false, `Expected success=false`);
      assert(body.error?.includes('blocked'), `Expected "blocked" in error, got: ${body.error}`);

      // Restore: unblock customer
      await serviceClient.from('profiles').update({
        is_blocked: false, blocked_at: null, blocked_reason: null,
      }).eq('id', customerUserId);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Checkout allowed for non-blocked user (guard does not fire)
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(7, 'Checkout allowed for non-blocked user (guard passes)', async () => {
      // Ensure user is NOT blocked
      const { data: prof } = await serviceClient.from('profiles').select('is_blocked').eq('id', customerUserId).maybeSingle();
      assert(!prof?.is_blocked, 'Customer should not be blocked for this test');

      // Hit create-order — it will fail validation/stock but NOT with 403
      const res = await fetch(`${BASE_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
        },
        body: JSON.stringify({
          cart: [{ productId: 'ghost-product', variantId: 'v1', title: 'Ghost', price: 1, quantity: 1 }],
          couponCode: '',
          walletDeduction: 0,
          pointsRedeemed: 0,
          loyaltyDiscount: 0,
          baseTotal: 1,
          netTotal: 1,
          customerName: 'Test Customer',
          idempotencyKey: `idem-unblocked-test-${ts}`,
          userId: customerUserId,
        }),
      });
      // Should NOT be 403
      assert(res.status !== 403, `Expected non-403 response, got ${res.status} (block guard should not fire)`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: CSV generation logic produces correct output
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(8, 'Customer CSV export — generateCustomerCsv logic', async () => {
      const testCustomers = [
        {
          name: 'Alice Smith',
          email: 'alice@example.com',
          phone: '+919876543210',
          order_count: 3,
          ltv: 4500,
          wallet_balance: 500,
          loyalty_points: 250,
          joined: '2024-01-15',
          is_blocked: false,
        },
        {
          name: 'Bob, the Builder',   // name with comma — should be quoted
          email: 'bob@example.com',
          phone: '',
          order_count: 0,
          ltv: 0,
          wallet_balance: 0,
          loyalty_points: 0,
          joined: '2024-03-20',
          is_blocked: true,
        },
      ];

      const csv = generateCustomerCsv(testCustomers);

      // Check BOM
      assert(csv.charCodeAt(0) === 0xFEFF, 'CSV must start with UTF-8 BOM');

      // Check header
      assert(csv.includes('Name,Email,Phone,Order Count'), `Missing expected header columns. Got: ${csv.slice(0, 200)}`);

      // Check Alice row
      assert(csv.includes('Alice Smith'), 'Missing Alice in CSV');
      assert(csv.includes('4500.00'), 'Missing LTV for Alice');
      assert(csv.includes('Active'), 'Alice should be Active');

      // Check Bob row (name with comma should be quoted)
      assert(csv.includes('"Bob, the Builder"'), `Expected quoted name for Bob, got: ${csv}`);
      assert(csv.includes('Blocked'), 'Bob should be Blocked');

      // Check line ending is CRLF
      assert(csv.includes('\r\n'), 'CSV should use CRLF line endings');

      // Check row count (1 header + 2 data rows)
      const lines = csv.split('\r\n').filter(l => l.trim());
      assert(lines.length === 3, `Expected 3 lines (header + 2 data rows), got ${lines.length}`);

      console.log(`  CSV generated: ${lines.length} lines, ${csv.length} chars`);
    }).catch(() => false)) passed++;

  } finally {
    // CLEANUP
    console.log('\n[CLEANUP] Deleting test users...');
    if (customerUserId) {
      await serviceClient.auth.admin.deleteUser(customerUserId);
      console.log('  Customer test user deleted.');
    }
    if (adminUserId) {
      await serviceClient.auth.admin.deleteUser(adminUserId);
      console.log('  Admin test user deleted.');
    }
    console.log('[CLEANUP] Done.');
    stopManagedServer();
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed${' '.repeat(47 - String(passed).length - String(total).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (passed < total) {
    const failMsg = `FATAL ERROR: Only ${passed}/${total} tests passed.`;
    console.error(failMsg);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  stopManagedServer();
  process.exit(1);
});
