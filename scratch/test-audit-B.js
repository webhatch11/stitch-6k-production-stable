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
    prefixedActionName = 'order:' + actionName; // getOrderEventsAction is in order namespace
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
  console.log('║  Audit Sprint B - Order Activity Timeline Tests          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 4;

  const adminEmail = `admin-audit-b-${ts}@example.com`;
  const customerEmail = `customer-audit-b-${ts}@example.com`;
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

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: getOrderEventsAction requires admin
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(1, 'getOrderEventsAction requires admin', async () => {
      // Anonymous
      const anonRes = await invokeAction(null, 'getOrderEventsAction', 'dummy-order');
      assert(anonRes.success === false, 'Expected anonymous caller to be rejected');
      assert(anonRes.error === 'Unauthorized', `Expected Unauthorized error, got: ${anonRes.error}`);

      // Customer
      const custRes = await invokeAction(customerCookie, 'getOrderEventsAction', 'dummy-order');
      assert(custRes.success === false, 'Expected customer caller to be rejected');
      assert(custRes.error === 'Unauthorized', `Expected Unauthorized error, got: ${custRes.error}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: getOrderEventsAction returns events array for valid orderId
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(2, 'getOrderEventsAction returns events array for valid orderId', async () => {
      const orderId = `AUDIT-B-ORD-T2-${ts}`;
      
      // Setup DB Order
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: `customer-audit-b-t2-${ts}`,
        date: new Date().toLocaleDateString("en-IN"),
        total: 1000,
        original_total: 1000,
        gateway_paid: 1000,
        wallet_paid: 0,
        items: [],
        status: 'Paid'
      });
      assert(!orderErr, `Failed to setup test order: ${orderErr?.message}`);

      // Create status history entry
      await db.addOrderStatusHistory(orderId, 'Paid', 'admin', { note: 'Status history test' });
      // Create order event entry
      await db.createOrderEvent(orderId, 'Payment Captured');

      const res = await invokeAction(adminCookie, 'getOrderEventsAction', orderId);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.events), 'Expected events to be an array');
      assert(res.events.length >= 2, `Expected at least 2 events, got: ${res.events.length}`);

      // Assert each event has required fields
      for (const ev of res.events) {
        assert(ev.id !== undefined, 'Event missing id');
        assert(ev.type !== undefined, 'Event missing type');
        assert(ev.description !== undefined, 'Event missing description');
        assert(ev.created_at !== undefined, 'Event missing created_at');
      }
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: getOrderEventsAction returns empty for non-existent orderId
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(3, 'getOrderEventsAction returns empty for non-existent orderId', async () => {
      const res = await invokeAction(adminCookie, 'getOrderEventsAction', 'DOES-NOT-EXIST');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.events), 'Expected events to be an array');
      assert(res.events.length === 0, `Expected 0 events, got: ${res.events.length}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: getOrderEvents merges sources correctly
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(4, 'getOrderEvents merges sources correctly', async () => {
      const orderId = `AUDIT-B-ORD-T4-${ts}`;
      
      // Setup DB Order
      const { error: orderErr } = await serviceClient.from('orders').insert({
        id: orderId,
        customer: `customer-audit-b-t4-${ts}`,
        date: new Date().toLocaleDateString("en-IN"),
        total: 1000,
        original_total: 1000,
        gateway_paid: 1000,
        wallet_paid: 0,
        items: [],
        status: 'Paid'
      });
      assert(!orderErr, `Failed to setup test order: ${orderErr?.message}`);

      // Create history entries with different timestamps (sleep in between to guarantee difference)
      await db.addOrderStatusHistory(orderId, 'Paid', 'admin', { note: 'Status history test' });
      await sleep(500);
      await db.createOrderEvent(orderId, 'Shipment Manifested');
      await sleep(500);
      await db.addOrderStatusHistory(orderId, 'Shipped', 'admin', { note: 'Shipped status change' });

      const events = await db.getOrderEvents(orderId);
      assert(Array.isArray(events), 'Expected events to be an array');
      assert(events.length === 3, `Expected exactly 3 events, got: ${events.length}`);

      // Check sorting DESC by timestamp
      const timestamps = events.map(e => new Date(e.created_at).getTime());
      assert(timestamps[0] >= timestamps[1], 'Events not sorted in DESC order (0 >= 1)');
      assert(timestamps[1] >= timestamps[2], 'Events not sorted in DESC order (1 >= 2)');

      // Verify descriptions and types
      assert(events[0].description.includes('Shipped'), 'Expected first event to be Shipped status change');
      assert(events[0].type === 'status_change', 'Expected status change event type');
      
      assert(events[1].description.includes('Shipment Manifested'), 'Expected second event to be Shipment Manifested');
      assert(events[1].type === 'shipment', 'Expected event type to be shipment');

      assert(events[2].description.includes('Paid'), 'Expected third event to be Paid status change');
    });
    passed++;

  } finally {
    // CLEANUP
    console.log('\n[CLEANUP] Deleting test orders and users...');
    try {
      const { error: delErr } = await serviceClient
        .from('orders')
        .delete()
        .like('id', 'AUDIT-B-ORD-%');
      if (delErr) console.warn('  Error deleting test orders:', delErr.message);
      else console.log('  Test orders deleted.');
    } catch (e) {
      console.warn('  Exception during orders cleanup:', e.message);
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
