'use strict';

/**
 * Issue #8 Integration Tests — address_snapshot end-to-end flow
 *
 * TEST 1 — Happy path: snapshot captured at checkout, persisted to DB
 * TEST 2 — Address ownership: cannot snapshot another user's address
 * TEST 3 — Dispatch rejects an order with address_snapshot = NULL
 * TEST 4 — Dispatch succeeds when snapshot is present (Shiprocket mock mode)
 *
 * Requires: Next.js dev server on http://localhost:3000
 *           (auto-started if not already running)
 */

const path   = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const rawUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE_URL     = 'http://localhost:3000';

// Extract project ref from URL  (e.g. "rzjsylcmnxpnebfghtap")
const PROJECT_REF  = new URL(SUPABASE_URL).hostname.split('.')[0];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('ERROR: Missing env vars in .env.local');
  process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
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
  await fn();
  console.log(`✓ PASS  TEST ${num}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie builder — mirrors @supabase/ssr createChunks + cookie encoding
//
// @supabase/ssr stores the session as JSON.stringify(session) in a cookie
// named sb-{projectRef}-auth-token.  If encodeURIComponent(json) > 3180 chars
// it chunks into sb-{ref}-auth-token.0, .1, ...
// ─────────────────────────────────────────────────────────────────────────────
const MAX_CHUNK = 3180;

function buildAuthCookieHeader(session) {
  const key   = `sb-${PROJECT_REF}-auth-token`;
  const value = JSON.stringify(session);
  let enc     = encodeURIComponent(value);

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
      try { chunk = decodeURIComponent(head); break; }
      catch (e) {
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
    // Probe a simple API route — compiles much faster than the React home page
    const r = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    // 400 (no body) or 405 (method not allowed) both mean the server is serving
    return r.status !== 0;
  } catch { return false; }
}

async function ensureServer() {
  if (await probeHttp()) {
    console.log(`[SERVER] Already running at ${BASE_URL}`);
    return;
  }
  // Pass --webpack to match the project's webpack config and avoid the
  // Turbopack error that Next.js 16 emits when it sees a webpack config
  // without an explicit turbopack config.
  console.log('[SERVER] Not running — starting Next.js dev server (--webpack)...');
  managedServer = spawn('npm', ['run', 'dev', '--', '--webpack'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Stream dev server output to terminal with prefix
  managedServer.stdout.on('data', d => process.stdout.write(`  [dev] ${d}`));
  managedServer.stderr.on('data', d => process.stderr.write(`  [dev] ${d}`));

  // Wait for "Ready" line in dev server output, then give routes time to compile
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

  // Small buffer: wait for the API route bundle to be ready for our first probe
  await sleep(3000);
  // Confirm HTTP is actually serving
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
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Issue #8 Integration Tests — address_snapshot flow      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Project ref : ${PROJECT_REF}`);
  console.log(`API base    : ${BASE_URL}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  await ensureServer();

  const ts = Date.now();
  let passed = 0;

  // ──────────────────────────────────────────────────────────────
  // GLOBAL SETUP: admin user for Tests 3 & 4
  // ──────────────────────────────────────────────────────────────
  const adminEmail = `admin-t8-${ts}@example.com`;
  let adminUserId  = null;
  let adminCookie  = null;

  console.log('\n[GLOBAL SETUP] Creating admin user...');
  {
    const { data: au, error: aue } = await serviceClient.auth.admin.createUser({
      email: adminEmail, password: 'Admin8Test!', email_confirm: true,
    });
    if (aue) { console.error('FATAL — create admin:', aue.message); process.exit(1); }
    adminUserId = au.user.id;
    await sleep(600);

    const { error: rpe } = await serviceClient
      .from('profiles').update({ role: 'admin' }).eq('id', adminUserId);
    if (rpe) { console.error('FATAL — set role:', rpe.message); process.exit(1); }

    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: sd, error: se } = await anon.auth.signInWithPassword({
      email: adminEmail, password: 'Admin8Test!',
    });
    if (se || !sd?.session) { console.error('FATAL — admin sign-in:', se?.message); process.exit(1); }

    adminCookie = buildAuthCookieHeader(sd.session);
    console.log(`[GLOBAL SETUP] Admin ready: ${adminEmail} (${adminUserId})`);
    console.log(`[GLOBAL SETUP] Cookie header length: ${adminCookie.length} chars`);
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 1 — Happy path
  // ══════════════════════════════════════════════════════════════
  let t1UserId    = null;
  let t1ProductId = null;
  const t1Email   = `alice-t8-${ts}@example.com`;

  try {
    await runTest(1, 'Happy path: snapshot captured at checkout, persisted to DB', async () => {
      // ── SETUP ──────────────────────────────────────────────────
      const { data: ud, error: ue } = await serviceClient.auth.admin.createUser({
        email: t1Email, password: 'Alice8Test!', email_confirm: true,
      });
      assert(!ue, `Create alice: ${ue?.message}`);
      t1UserId = ud.user.id;
      console.log(`  [SETUP] alice user: ${t1UserId}`);
      await sleep(600);

      // Ensure profile email is correct (trigger should set it; update is a safety net)
      await serviceClient.from('profiles').update({ email: t1Email }).eq('id', t1UserId);

      const addrId = `ADDR-T1-${ts}`;
      const { error: ae } = await serviceClient.from('user_addresses').insert({
        id:             addrId,
        user_id:        t1UserId,
        name:           'Alice Test',
        phone:          '+919876543210',
        address_line_1: '42 Test Street',
        address_line_2: 'Floor 2',
        city:           'Chennai',
        state:          'Tamil Nadu',
        postal_code:    '600001',
        country:        'India',
        is_default:     true,
      });
      assert(!ae, `Insert address: ${ae?.message}`);
      console.log(`  [SETUP] Address: ${addrId}`);

      t1ProductId = `TEST-P8-${ts}`;
      const { error: pe } = await serviceClient.from('products').insert({
        id:            t1ProductId,
        slug:          `test-shirt-8-${ts}`,
        title:         'Test Integration Shirt',
        price:         999,
        compare_price: 1299,
        category:      'shirts',
        image:         '',
        stock:         10,
        size_stock_s:  5,
        size_stock_m:  5,
        size_stock_l:  5,
        size_stock_xl: 5,
        size_stock_xxl: 5,
      });
      assert(!pe, `Insert product: ${pe?.message}`);
      await serviceClient.from('product_variants').insert({
        product_id: t1ProductId,
        size:  'M',
        color: 'Black',
        sku:   `${t1ProductId}-M-BLK`,
        price: 999,
        stock: 5,
      });
      console.log(`  [SETUP] Product: ${t1ProductId}`);

      // ── STEP A — call /api/payments/create-order ───────────────
      const iKey = `IK-T1-${ts}`;
      console.log('  [STEP A] POST /api/payments/create-order ...');
      const res = await fetch(`${BASE_URL}/api/payments/create-order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: [{
            productId:   t1ProductId,
            productName: 'Test Integration Shirt',
            price:       999,
            size:        'M',
            image:       '',
            color:       'Black',
          }],
          couponCode:    '',
          walletDeduction: 0,
          pointsRedeemed:  0,
          loyaltyDiscount: 0,
          baseTotal:    999,
          netTotal:     999,
          customerName: 'Alice Test',
          idempotencyKey: iKey,
          addressId: addrId,
          userId:    t1UserId,
        }),
      });

      const body = await res.json();
      console.log(`  HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
      assert(res.status === 200,       `Expected 200, got ${res.status}: ${body.error || ''}`);
      assert(body.success === true,    `success=false: ${body.error}`);
      assert(body.orderId,             'No orderId in response');
      const orderId = body.orderId;
      console.log(`  Order created: ${orderId}`);

      // ── STEP B — verify address_snapshot in DB ─────────────────
      console.log('  [STEP B] Querying orders.address_snapshot ...');
      const { data: row, error: re } = await serviceClient
        .from('orders')
        .select('address_snapshot')
        .eq('id', orderId)
        .single();
      assert(!re,  `Query order: ${re?.message}`);
      assert(row,  'No order row returned');
      assert(row.address_snapshot !== null, 'address_snapshot is NULL in DB');

      const snap = row.address_snapshot;
      console.log('  Snapshot:', JSON.stringify(snap, null, 2));

      assert(snap.name           === 'Alice Test',     `name="${snap.name}"`);
      assert(snap.address_line_1 === '42 Test Street', `address_line_1="${snap.address_line_1}"`);
      assert(snap.city           === 'Chennai',         `city="${snap.city}"`);
      assert(snap.postal_code    === '600001',          `postal_code="${snap.postal_code}"`);
      assert(snap.email          === t1Email,           `email="${snap.email}" want "${t1Email}"`);
    });
    passed++;
  } catch (err) {
    console.error(`\n!!! TEST 1 FAILED: ${err.message}`);
    console.error('STOPPING — fix the failure before proceeding to subsequent tests.');
    await cleanup({ adminUserId, t1UserId, t1ProductId });
    stopManagedServer();
    process.exit(1);
  } finally {
    // Per-test cleanup
    if (t1UserId)    { await serviceClient.auth.admin.deleteUser(t1UserId).catch(() => {}); t1UserId = null; }
    if (t1ProductId) {
      await serviceClient.from('product_variants').delete().eq('product_id', t1ProductId);
      await serviceClient.from('products').delete().eq('id', t1ProductId);
      t1ProductId = null;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 2 — Address ownership
  // ══════════════════════════════════════════════════════════════
  let t2AliceId = null;
  let t2BobId   = null;

  try {
    await runTest(2, "Address ownership: cannot snapshot another user's address", async () => {
      // ── SETUP ──────────────────────────────────────────────────
      const aliceEmail = `alice2-t8-${ts}@example.com`;
      const bobEmail   = `bob2-t8-${ts}@example.com`;

      const { data: aud, error: aue } = await serviceClient.auth.admin.createUser({
        email: aliceEmail, password: 'Alice8!', email_confirm: true,
      });
      const { data: bud, error: bue } = await serviceClient.auth.admin.createUser({
        email: bobEmail, password: 'Bob8!', email_confirm: true,
      });
      assert(!aue, `Create alice2: ${aue?.message}`);
      assert(!bue, `Create bob2: ${bue?.message}`);
      t2AliceId = aud.user.id;
      t2BobId   = bud.user.id;
      console.log(`  [SETUP] alice2: ${t2AliceId}`);
      console.log(`  [SETUP] bob2:   ${t2BobId}`);

      const bobAddrId = `ADDR-BOB-${ts}`;
      const { error: bae } = await serviceClient.from('user_addresses').insert({
        id:             bobAddrId,
        user_id:        t2BobId,
        name:           'Bob Test',
        phone:          '+910000000000',
        address_line_1: '99 Bob Lane',
        address_line_2: '',
        city:           'Mumbai',
        state:          'Maharashtra',
        postal_code:    '400001',
        country:        'India',
        is_default:     true,
      });
      assert(!bae, `Insert bob address: ${bae?.message}`);
      console.log(`  [SETUP] Bob's address: ${bobAddrId}`);

      // ── STEP A — call as alice with bob's addressId ────────────
      const iKey = `IK-T2-${ts}`;
      console.log("  [STEP A] POST /api/payments/create-order as alice with bob's addressId ...");
      const res = await fetch(`${BASE_URL}/api/payments/create-order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: [{
            productName: 'Placeholder Shirt',
            price:       999,
            size:        'M',
            image:       '',
          }],
          couponCode:    '',
          walletDeduction: 0,
          pointsRedeemed:  0,
          loyaltyDiscount: 0,
          baseTotal:    999,
          netTotal:     999,
          customerName: 'Alice Test2',
          idempotencyKey: iKey,
          addressId: bobAddrId,  // ← Bob's address
          userId:    t2AliceId,  // ← Alice's userId
        }),
      });

      const body = await res.json();
      console.log(`  HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(body.success === false, 'Expected success=false');
      assert(
        body.error && body.error.includes('Invalid or unauthorized delivery address'),
        `Expected ownership rejection, got: "${body.error}"`
      );
      console.log(`  Correctly rejected: "${body.error}"`);

      // ── STEP B — verify no order was written ───────────────────
      console.log('  [STEP B] Checking no order row exists for idempotencyKey ...');
      const { data: orderRow } = await serviceClient
        .from('orders')
        .select('id')
        .eq('idempotency_key', iKey)
        .maybeSingle();
      assert(!orderRow, `Order was written to DB despite rejection! id=${orderRow?.id}`);
      console.log('  No order row found — correct.');
    });
    passed++;
  } catch (err) {
    console.error(`\n!!! TEST 2 FAILED: ${err.message}`);
    console.error('STOPPING.');
    await cleanup({ adminUserId, t2AliceId, t2BobId });
    stopManagedServer();
    process.exit(1);
  } finally {
    if (t2AliceId) { await serviceClient.auth.admin.deleteUser(t2AliceId).catch(() => {}); t2AliceId = null; }
    if (t2BobId)   { await serviceClient.auth.admin.deleteUser(t2BobId).catch(() => {});   t2BobId   = null; }
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 3 — Dispatch fails cleanly when snapshot is NULL
  // ══════════════════════════════════════════════════════════════
  const t3OrderId = `ORD-T3-${ts}`;
  let   t3Created = false;

  try {
    await runTest(3, 'Dispatch fails cleanly when address_snapshot is NULL (legacy order)', async () => {
      // ── SETUP ──────────────────────────────────────────────────
      const { error: oe } = await serviceClient.from('orders').insert({
        id:             t3OrderId,
        customer:       'Legacy Customer',
        date:           new Date().toLocaleDateString('en-IN'),
        total:          1999,
        original_total: 1999,
        status:         'Paid',
        items:          ['Heritage Shirt'],
        idempotency_key: `IK-T3-${ts}`,
        address_snapshot: null,   // ← the bug we're guarding against
      });
      assert(!oe, `Insert T3 order: ${oe?.message}`);
      t3Created = true;
      console.log(`  [SETUP] Inserted order ${t3OrderId} with address_snapshot=NULL`);

      // ── STEP A — dispatch as admin ─────────────────────────────
      console.log('  [STEP A] POST /api/logistics/dispatch-order as admin ...');
      const res = await fetch(`${BASE_URL}/api/logistics/dispatch-order`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({ orderId: t3OrderId }),
      });

      const body = await res.json();
      console.log(`  HTTP ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);

      assert(
        res.status === 422 || res.status === 400 || res.status === 500,
        `Expected 4xx/5xx (no snapshot), got ${res.status}`
      );
      assert(body.success === false, 'Expected success=false');
      const errLow = (body.error || '').toLowerCase();
      assert(
        errLow.includes('address_snapshot') || errLow.includes('address') || errLow.includes('snapshot'),
        `Expected snapshot-related error, got: "${body.error}"`
      );
      console.log(`  Dispatch blocked at HTTP ${res.status}: "${body.error}"`);

      // Verify order status was NOT flipped to Shipped
      const { data: row } = await serviceClient
        .from('orders').select('status').eq('id', t3OrderId).single();
      assert(row.status !== 'Shipped', `Order status changed to Shipped despite missing snapshot!`);
      console.log(`  Order status unchanged: "${row.status}" ✓`);
    });
    passed++;
  } catch (err) {
    console.error(`\n!!! TEST 3 FAILED: ${err.message}`);
    console.error('STOPPING.');
    if (t3Created) await serviceClient.from('orders').delete().eq('id', t3OrderId);
    await cleanup({ adminUserId });
    stopManagedServer();
    process.exit(1);
  } finally {
    if (t3Created) {
      await serviceClient.from('orders').delete().eq('id', t3OrderId);
      t3Created = false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 4 — Dispatch succeeds with valid snapshot (mock mode)
  // ══════════════════════════════════════════════════════════════
  const t4OrderId = `ORD-T4-${ts}`;
  let   t4Created = false;

  try {
    await runTest(4, 'Dispatch succeeds with valid snapshot (Shiprocket mock mode)', async () => {
      // ── SETUP ──────────────────────────────────────────────────
      const validSnap = {
        id:             `ADDR-SNAP-${ts}`,
        user_id:        adminUserId,
        name:           'Verified Customer',
        phone:          '+919999999999',
        address_line_1: '10 Verified Road',
        address_line_2: 'Suite 5',
        city:           'Bengaluru',
        state:          'Karnataka',
        postal_code:    '560001',
        country:        'India',
        is_default:     false,
        email:          adminEmail,
      };

      const { error: oe } = await serviceClient.from('orders').insert({
        id:             t4OrderId,
        customer:       'Verified Customer',
        date:           new Date().toLocaleDateString('en-IN'),
        total:          1999,
        original_total: 1999,
        status:         'Paid',
        items:          ['Heritage Shirt'],
        idempotency_key:  `IK-T4-${ts}`,
        address_snapshot: validSnap,
      });
      assert(!oe, `Insert T4 order: ${oe?.message}`);
      t4Created = true;
      console.log(`  [SETUP] Inserted order ${t4OrderId} with valid snapshot`);

      // ── STEP A — dispatch as admin ─────────────────────────────
      console.log('  [STEP A] POST /api/logistics/dispatch-order as admin ...');
      const res = await fetch(`${BASE_URL}/api/logistics/dispatch-order`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({ orderId: t4OrderId }),
      });

      const body = await res.json();
      console.log(`  HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);

      assert(res.status === 200,       `Expected 200, got ${res.status}: ${body.error || ''}`);
      assert(body.success === true,    `Expected success=true: ${body.error}`);
      assert(body.isMock  === true,    `Expected isMock=true (SHIPROCKET_EMAIL is empty, mock mode required)`);
      console.log(`  Dispatch success — isMock=${body.isMock}, awbCode=${body.awbCode}`);
    });
    passed++;
  } catch (err) {
    console.error(`\n!!! TEST 4 FAILED: ${err.message}`);
    console.error('STOPPING.');
    if (t4Created) await serviceClient.from('orders').delete().eq('id', t4OrderId);
    await cleanup({ adminUserId });
    stopManagedServer();
    process.exit(1);
  } finally {
    if (t4Created) {
      await serviceClient.from('orders').delete().eq('id', t4OrderId);
      t4Created = false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // GLOBAL CLEANUP
  // ──────────────────────────────────────────────────────────────
  console.log('\n[GLOBAL CLEANUP] Deleting admin user...');
  await serviceClient.auth.admin.deleteUser(adminUserId).catch(e =>
    console.warn('  Admin cleanup warning:', e.message)
  );
  console.log('[GLOBAL CLEANUP] Done.');

  stopManagedServer();

  // ──────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────
  const total = 4;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed                                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  if (passed === total) {
    console.log('All Issue #8 integration tests PASSED ✓');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency cleanup (called on unexpected failure)
// ─────────────────────────────────────────────────────────────────────────────
async function cleanup({ adminUserId, t1UserId, t1ProductId, t2AliceId, t2BobId } = {}) {
  console.log('\n[EMERGENCY CLEANUP]');
  if (adminUserId)   await serviceClient.auth.admin.deleteUser(adminUserId).catch(() => {});
  if (t1UserId)      await serviceClient.auth.admin.deleteUser(t1UserId).catch(() => {});
  if (t1ProductId) {
    await serviceClient.from('product_variants').delete().eq('product_id', t1ProductId);
    await serviceClient.from('products').delete().eq('id', t1ProductId);
  }
  if (t2AliceId)  await serviceClient.auth.admin.deleteUser(t2AliceId).catch(() => {});
  if (t2BobId)    await serviceClient.auth.admin.deleteUser(t2BobId).catch(() => {});
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  stopManagedServer();
  process.exit(1);
});
