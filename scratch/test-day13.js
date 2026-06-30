'use strict';

/**
 * Day 13 settings, hero editor, coupon edit, and COD toggle tests
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
  } catch (e) {
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

  let prefixedActionName = actionName;
  if (
    actionName.includes('Setting') ||
    actionName.includes('Hero') ||
    actionName.includes('Business') ||
    actionName.includes('Flags')
  ) {
    prefixedActionName = 'settings:' + actionName;
  } else if (actionName.startsWith('get')) {
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
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errText}`);
  }
  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Day 13 Site Settings & Hero Editor Integration Tests   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  let adminEmail = `admin-day13-${Date.now()}@example.com`;
  let customerEmail = `customer-day13-${Date.now()}@example.com`;
  let password = 'TestPassword123!';
  let adminUserId = null;
  let customerUserId = null;
  let adminCookie = null;
  let customerCookie = null;

  try {
    console.log('[SETUP] Creating test users...');
    
    // Create customer user
    const { data: customerData, error: customerErr } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password: password,
      email_confirm: true,
    });
    assert(!customerErr, `Create customer failed: ${customerErr?.message}`);
    customerUserId = customerData.user.id;
    console.log(`  Customer created: ${customerEmail} (ID: ${customerUserId})`);

    // Create admin user
    const { data: adminData, error: adminErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    assert(!adminErr, `Create admin failed: ${adminErr?.message}`);
    adminUserId = adminData.user.id;
    console.log(`  Admin created: ${adminEmail} (ID: ${adminUserId})`);

    // Grant admin role
    const { error: roleErr } = await serviceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId);
    assert(!roleErr, `Grant admin role failed: ${roleErr?.message}`);
    console.log('  Admin role updated in profiles.');

    // Capture cookies
    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: password,
    });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);

    const { data: customerSignIn, error: customerSignInErr } = await anonClient.auth.signInWithPassword({
      email: customerEmail,
      password: password,
    });
    assert(!customerSignInErr, `Customer sign-in failed: ${customerSignInErr?.message}`);
    customerCookie = buildAuthCookieHeader(customerSignIn.session);

    let passed = 0;

    // ────────────────────────────────────────────────────────────
    // TEST 1: getSettingAction returns hero with seed defaults
    // ────────────────────────────────────────────────────────────
    await runTest(1, 'getSettingAction returns hero with seed defaults', async () => {
      const res = await invokeAction(adminCookie, 'getSettingAction', 'hero');
      assert(res.success === true, 'Expected getSettingAction to succeed');
      assert(res.value, 'Expected hero settings value to be returned');
      assert(res.value.headline === 'PREDEFINING LUXURY', `Expected seed headline, got: ${res.value.headline}`);
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 2: saveHeroAction requires admin
    // ────────────────────────────────────────────────────────────
    await runTest(2, 'saveHeroAction requires admin', async () => {
      // Anonymous
      const resAnon = await invokeAction(null, 'saveHeroAction', {
        headline: 'ANONYMOUS TITLE',
        cta_text: 'CTA',
        cta_url: '/',
      });
      assert(resAnon.success === false, 'Expected anon to be rejected');
      assert(resAnon.error === 'Unauthorized', `Expected Unauthorized, got ${resAnon.error}`);

      // Customer
      const resCust = await invokeAction(customerCookie, 'saveHeroAction', {
        headline: 'CUSTOMER TITLE',
        cta_text: 'CTA',
        cta_url: '/',
      });
      assert(resCust.success === false, 'Expected customer to be rejected');
      assert(resCust.error === 'Unauthorized', `Expected Unauthorized, got ${resCust.error}`);
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 3: saveHeroAction validation limits
    // ────────────────────────────────────────────────────────────
    await runTest(3, 'saveHeroAction rejects bad input', async () => {
      // Empty headline
      const resEmpty = await invokeAction(adminCookie, 'saveHeroAction', {
        headline: '',
        cta_text: 'CTA',
        cta_url: '/',
      });
      assert(resEmpty.success === false, 'Expected empty headline to fail validation');

      // Headline too long (>120 chars)
      const resLong = await invokeAction(adminCookie, 'saveHeroAction', {
        headline: 'A'.repeat(121),
        cta_text: 'CTA',
        cta_url: '/',
      });
      assert(resLong.success === false, 'Expected 121 character headline to fail validation');
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 4: saveHeroAction saves successfully
    // ────────────────────────────────────────────────────────────
    const testHeadline = 'TESTING CUSTOM HERO TITLE';
    await runTest(4, 'saveHeroAction saves successfully', async () => {
      const res = await invokeAction(adminCookie, 'saveHeroAction', {
        headline: testHeadline,
        cta_text: 'Shop Test',
        cta_url: '/shopallshirts',
      });
      assert(res.success === true, `Expected save to succeed, got error: ${res.error}`);

      // Read back
      const readRes = await invokeAction(adminCookie, 'getSettingAction', 'hero');
      assert(readRes.success === true, 'Expected getSettingAction to succeed');
      assert(readRes.value.headline === testHeadline, `Expected read headline to equal "${testHeadline}"`);
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 5: saveBusinessAction works end-to-end
    // ────────────────────────────────────────────────────────────
    await runTest(5, 'saveBusinessAction works end-to-end', async () => {
      const bizPayload = {
        phone: '1234567890',
        email: 'info@day13.com',
        address: '123 Test Ave',
        gst_no: 'GST12345',
        instagram: 'https://insta',
        facebook: 'https://fb',
      };
      const res = await invokeAction(adminCookie, 'saveBusinessAction', bizPayload);
      assert(res.success === true, `Expected save to succeed, got: ${res.error}`);

      // Read back
      const readRes = await invokeAction(adminCookie, 'getSettingAction', 'business');
      assert(readRes.success === true, 'Expected read to succeed');
      assert(readRes.value.email === 'info@day13.com', 'Expected email to match');
      assert(readRes.value.phone === '1234567890', 'Expected phone to match');
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 6: saveFlagsAction saves cod_enabled=false
    // ────────────────────────────────────────────────────────────
    await runTest(6, 'saveFlagsAction saves cod_enabled=false', async () => {
      const res = await invokeAction(adminCookie, 'saveFlagsAction', {
        cod_enabled: false,
        returns_window_days: 14,
      });
      assert(res.success === true, `Expected save to succeed, got: ${res.error}`);

      // Read back
      const readRes = await invokeAction(adminCookie, 'getSettingAction', 'flags');
      assert(readRes.success === true, 'Expected read to succeed');
      assert(readRes.value.cod_enabled === false, 'Expected cod_enabled to be false');
      assert(readRes.value.returns_window_days === 14, 'Expected returns window to be 14');
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 7: Homepage contains the saved headline
    // ────────────────────────────────────────────────────────────
    await runTest(7, 'Storefront homepage HTML contains the saved headline', async () => {
      const res = await fetch(BASE_URL);
      assert(res.ok, `Expected page to load, got status ${res.status}`);
      const html = await res.text();
      assert(html.includes(testHeadline), `Expected HTML to contain headline "${testHeadline}"`);
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 8: Cache invalidation works
    // ────────────────────────────────────────────────────────────
    await runTest(8, 'Cache invalidation works', async () => {
      // 1. Change title
      const newTitle = 'CACHED TITLE 2';
      const res1 = await invokeAction(adminCookie, 'saveHeroAction', {
        headline: newTitle,
        cta_text: 'Shop',
        cta_url: '/',
      });
      assert(res1.success === true, 'Save failed');

      // 2. Fetch setting immediately (should invalid cached value and fetch new)
      const res2 = await invokeAction(adminCookie, 'getSettingAction', 'hero');
      assert(res2.value.headline === newTitle, 'Cache invalidation did not refresh settings value');
    });
    passed++;

    // ────────────────────────────────────────────────────────────
    // TEST 9: Checkout hides COD payment option when cod_enabled=false
    // ────────────────────────────────────────────────────────────
    await runTest(9, 'Checkout hides COD payment option when cod_enabled=false', async () => {
      // 1. Ensure COD flag is disabled in DB
      const resFlags = await invokeAction(adminCookie, 'saveFlagsAction', {
        cod_enabled: false,
        returns_window_days: 7,
      });
      assert(resFlags.success === true, 'Setting COD flag to false failed');

      // 2. Fetch checkout page HTML with customer cookie
      const resPage = await fetch(`${BASE_URL}/checkout`, {
        headers: {
          Cookie: customerCookie,
        },
      });
      assert(resPage.ok, `Checkout page failed to load: ${resPage.status}`);
      const html = await resPage.text();
      
      // 3. Confirm option is hidden/disabled in SSR HTML output
      assert(
        !html.includes('Cash on Delivery (COD)'),
        'Expected COD selector to be completely hidden in checkout page HTML when cod_enabled=false'
      );
    });
    passed++;

    console.log('\n[CLEANUP] Restoring default settings...');
    // Restore Hero default seed
    await invokeAction(adminCookie, 'saveHeroAction', {
      image_url: '',
      headline: 'PREDEFINING LUXURY',
      subheadline: 'Heritage craftsmanship meets Gen-Z streetwear.',
      cta_text: 'Shop Collection',
      cta_url: '/shopallshirts',
    });
    // Restore Flags default seed
    await invokeAction(adminCookie, 'saveFlagsAction', {
      cod_enabled: true,
      returns_window_days: 7,
    });
    console.log('  Settings restored to seed values.');

    console.log('[CLEANUP] Deleting test users...');
    await serviceClient.auth.admin.deleteUser(adminUserId);
    await serviceClient.auth.admin.deleteUser(customerUserId);
    console.log('  Test users deleted.');

    console.log('[CLEANUP] Done.');
    stopManagedServer();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log(`║  Results: ${passed}/9 passed                                     ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    process.exit(passed === 9 ? 0 : 1);
  } catch (err) {
    console.error('\nTest failed with error:', err);
    if (adminUserId) await serviceClient.auth.admin.deleteUser(adminUserId).catch(() => {});
    if (customerUserId) await serviceClient.auth.admin.deleteUser(customerUserId).catch(() => {});
    stopManagedServer();
    process.exit(1);
  }
}

main();
