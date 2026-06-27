'use strict';

/**
 * Day 9 Cloudinary & Product Actions Integration Tests
 *
 * TEST 1 — /api/admin/cloudinary-sign rejects anonymous
 * TEST 2 — /api/admin/cloudinary-sign rejects customer
 * TEST 3 — /api/admin/cloudinary-sign accepts admin
 * TEST 4 — /api/admin/cloudinary-sign rejects missing paramsToSign
 * TEST 5 — saveProductAction Zod validation rejects bad input
 * TEST 6 — saveProductAction with valid input creates product
 *
 * Requires: Next.js dev server on http://localhost:3000
 *           (auto-started if not already running)
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

// Extract project ref from URL (e.g. "rzjsylcmnxpnebfghtap")
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
  await fn();
  console.log(`✓ PASS  TEST ${num}`);
}

// Cookie builder — mirrors @supabase/ssr createChunks + cookie encoding
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

  // Stream dev server output to terminal with prefix
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
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Day 9 Cloudinary & Product Actions Integration Tests    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Project ref : ${PROJECT_REF}`);
  console.log(`API base    : ${BASE_URL}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  await ensureServer();

  const ts = Date.now();
  let passed = 0;

  // ── SETUP ──────────────────────────────────────────────────
  const customerEmail = `customer-day9-${ts}@example.com`;
  const adminEmail = `admin-day9-${ts}@example.com`;
  const password = 'Day9TestPass123!';

  let customerUserId = null;
  let adminUserId = null;
  let customerCookie = null;
  let adminCookie = null;

  const testProductId = `DAY9TEST-${ts}`;

  try {
    console.log('\n[SETUP] Creating customer and admin test users...');
    
    // Create customer user
    const { data: customerData, error: customerErr } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password: password,
      email_confirm: true,
    });
    assert(!customerErr, `Create customer failed: ${customerErr?.message}`);
    customerUserId = customerData.user.id;
    console.log(`  Customer created: ${customerEmail} (${customerUserId})`);

    // Create admin user
    const { data: adminData, error: adminErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    assert(!adminErr, `Create admin failed: ${adminErr?.message}`);
    adminUserId = adminData.user.id;
    console.log(`  Admin user created: ${adminEmail} (${adminUserId})`);

    // Update admin user profile role to 'admin'
    await sleep(600); // Give trigger time to create profiles row
    const { error: roleErr } = await serviceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId);
    assert(!roleErr, `Setting role to admin failed: ${roleErr?.message}`);
    console.log(`  Admin profile role updated to 'admin'`);

    // Sign in customer
    const { data: custSignIn, error: custSignInErr } = await anonClient.auth.signInWithPassword({
      email: customerEmail,
      password: password,
    });
    assert(!custSignInErr, `Customer sign-in failed: ${custSignInErr?.message}`);
    customerCookie = buildAuthCookieHeader(custSignIn.session);
    console.log(`  Customer signed in. Cookie header ready.`);

    // Sign in admin
    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: password,
    });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);
    console.log(`  Admin signed in. Cookie header ready.`);

    // ── TEST 1 ────────────────────────────────────────────────
    await runTest(1, '/api/admin/cloudinary-sign rejects anonymous', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/cloudinary-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paramsToSign: { timestamp: 1234567890 }
        }),
      });
      console.log(`  HTTP status: ${res.status}`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      
      const body = await res.json();
      assert(body.error, `Expected response body to have "error" key`);
      console.log(`  Error message: "${body.error}"`);
    });
    passed++;

    // ── TEST 2 ────────────────────────────────────────────────
    await runTest(2, '/api/admin/cloudinary-sign rejects customer', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/cloudinary-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': customerCookie,
        },
        body: JSON.stringify({
          paramsToSign: { timestamp: 1234567890 }
        }),
      });
      console.log(`  HTTP status: ${res.status}`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      
      const body = await res.json();
      assert(body.error, `Expected response body to have "error" key`);
    });
    passed++;

    // ── TEST 3 ────────────────────────────────────────────────
    await runTest(3, '/api/admin/cloudinary-sign accepts admin', async () => {
      const unixNow = Math.floor(Date.now() / 1000);
      const res = await fetch(`${BASE_URL}/api/admin/cloudinary-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({
          paramsToSign: { timestamp: unixNow, folder: 'products' }
        }),
      });
      console.log(`  HTTP status: ${res.status}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      
      const body = await res.json();
      console.log(`  Signature returned: ${body.signature}`);
      assert(body.signature, 'No signature in response');
      assert(typeof body.signature === 'string', 'signature is not a string');
      assert(body.signature.length >= 40, `Expected signature length >= 40, got ${body.signature.length}`);
    });
    passed++;

    // ── TEST 4 ────────────────────────────────────────────────
    await runTest(4, '/api/admin/cloudinary-sign rejects missing paramsToSign', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/cloudinary-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({}),
      });
      console.log(`  HTTP status: ${res.status}`);
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      
      const body = await res.json();
      assert(body.error && body.error.includes('Missing paramsToSign'), `Expected error to contain "Missing paramsToSign", got "${body.error}"`);
      console.log(`  Error: "${body.error}"`);
    });
    passed++;

    // ── TEST 5 ────────────────────────────────────────────────
    await runTest(5, 'saveProductAction Zod validation rejects bad input', async () => {
      // Call saveProductAction with empty input ({})
      console.log('  [Sub-test A] Calling with empty body {} ...');
      const resA = await fetch(`${BASE_URL}/api/admin/test-runner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({
          actionName: 'product:saveProductAction',
          args: [{}],
        }),
      });
      const bodyA = await resA.json();
      console.log(`  Response: ${JSON.stringify(bodyA)}`);
      assert(bodyA.success === false, 'Expected success=false for empty input');
      assert(bodyA.error === 'Validation failed', `Expected error "Validation failed", got "${bodyA.error}"`);

      // Call saveProductAction with bad inputs (empty title, negative basePrice)
      console.log('  [Sub-test B] Calling with bad values (empty title, negative price) ...');
      const resB = await fetch(`${BASE_URL}/api/admin/test-runner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({
          actionName: 'product:saveProductAction',
          args: [{
            title: '',
            basePrice: -10,
            gstRate: 12,
            discountRate: 0,
            category: 'Test',
          }],
        }),
      });
      const bodyB = await resB.json();
      console.log(`  Response: ${JSON.stringify(bodyB)}`);
      assert(bodyB.success === false, 'Expected success=false for bad parameters');
      assert(bodyB.error === 'Validation failed', `Expected error "Validation failed", got "${bodyB.error}"`);
    });
    passed++;

    // ── TEST 6 ────────────────────────────────────────────────
    await runTest(6, 'saveProductAction with valid input creates product', async () => {
      const validProduct = {
        id: testProductId,
        title: 'Day 9 Test Product',
        category: 'Cotton',
        basePrice: 1000,
        gstRate: 12,
        discountRate: 0,
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
        sizeStock: {
          S: 5,
          M: 5,
          L: 5,
          XL: 0,
          XXL: 0,
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/test-runner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie,
        },
        body: JSON.stringify({
          actionName: 'product:saveProductAction',
          args: [validProduct],
        }),
      });

      const body = await res.json();
      console.log(`  Save response: ${JSON.stringify(body)}`);
      assert(body.success === true, `Expected success=true, got error: "${body.error}"`);

      // Query Database to confirm product exists with correct calculated properties
      console.log(`  Querying database for product id "${testProductId}"...`);
      const { data: dbProd, error: dbErr } = await serviceClient
        .from('products')
        .select('*')
        .eq('id', testProductId)
        .single();
      
      assert(!dbErr, `Database query failed: ${dbErr?.message}`);
      assert(dbProd, 'Product not found in database');
      console.log(`  Database product: price=${dbProd.price}, stock=${dbProd.stock}, image=${dbProd.image}`);

      // Calculations:
      // Price: 1000 * 1.12 = 1120 (since gstRate is 12 and discountRate is 0)
      assert(dbProd.price === 1120, `Expected price 1120, got ${dbProd.price}`);
      // Stock: 5+5+5+0+0 = 15
      assert(dbProd.stock === 15, `Expected stock 15, got ${dbProd.stock}`);
      assert(dbProd.image === validProduct.image, `Expected image "${validProduct.image}", got "${dbProd.image}"`);
    });
    passed++;

  } catch (err) {
    console.error(`\n!!! TEST FAILED: ${err.message}`);
  } finally {
    // ── CLEANUP ──────────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test data...');
    
    // Delete test product
    try {
      // First delete variants
      await serviceClient.from('product_variants').delete().eq('product_id', testProductId);
      const { error: pDelErr } = await serviceClient.from('products').delete().eq('id', testProductId);
      if (pDelErr) console.warn('  Product deletion warning:', pDelErr.message);
      else console.log('  Test product deleted.');
    } catch (e) {
      console.warn('  Test product deletion failed:', e.message);
    }

    // Delete test users
    if (customerUserId) {
      await serviceClient.auth.admin.deleteUser(customerUserId)
        .then(() => console.log('  Customer deleted.'))
        .catch(e => console.warn('  Customer deletion failed:', e.message));
    }
    if (adminUserId) {
      await serviceClient.auth.admin.deleteUser(adminUserId)
        .then(() => console.log('  Admin deleted.'))
        .catch(e => console.warn('  Admin deletion failed:', e.message));
    }
    console.log('[CLEANUP] Done.');
  }

  stopManagedServer();

  // Summary
  const total = 6;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed                                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  stopManagedServer();
  process.exit(1);
});
