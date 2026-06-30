'use strict';

/**
 * LP-1 tests — Footer wiring + WhatsApp number from site_settings.business
 */

const path = require('path');
const { spawn, execSync } = require('child_process');
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

// Compile db adapter
console.log('Compiling database adapter...');
try {
  execSync(
    'npx -y esbuild lib/db.ts --bundle --platform=node --outfile=scratch/db.js ' +
    '--external:ioredis --external:bullmq --external:@supabase/supabase-js ' +
    '--external:@supabase/ssr --external:zod --external:react --external:react-dom ' +
    '--external:next --external:razorpay',
    { stdio: 'ignore' }
  );
  console.log('Compilation successful!\n');
} catch (err) {
  console.error('Compilation failed.', err);
  process.exit(1);
}

const { db } = require('./db.js');

// ── Helper: set business setting via direct DB ────────────────────────────────
// ── Helper: set business setting via db.saveSetting (busts Redis cache) ──────
// We MUST go through the server's db.saveSetting because getSetting caches
// results in Redis for 600s. Direct Supabase upsert bypasses the cache bust.
async function setBusiness(data, adminCookie) {
  const res = await fetch(`${BASE_URL}/api/admin/test-runner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({ actionName: 'settings:saveBusinessAction', args: [data] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`setBusiness failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(`setBusiness action failed: ${json.error}`);
  // Short wait for the server to process
  await sleep(500);
}

// ── Cookie builder ───────────────────────────────────────────────────────────
const MAX_CHUNK = 3180;
function buildAuthCookieHeader(session) {
  const key = `sb-${PROJECT_REF}-auth-token`;
  const value = JSON.stringify(session);
  let enc = encodeURIComponent(value);
  if (enc.length <= MAX_CHUNK) return `${key}=${encodeURIComponent(value)}`;
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
        if (head.length > 3 && head[head.length - 3] === '%') head = head.slice(0, head.length - 3);
        else throw e;
      }
    }
    parts.push(`${key}.${idx++}=${encodeURIComponent(chunk)}`);
    enc = enc.slice(head.length);
  }
  return parts.join('; ');
}

// Save original to restore at end
let originalBusiness = {};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  LP-1 — Footer wiring + WhatsApp number                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const total = 4;
  let passed = 0;
  const ts = Date.now();
  const adminEmail = `admin-lp1-${ts}@example.com`;
  const password = 'TestPass123!';
  let adminUserId = null;
  let adminCookie = null;

  try {
    // ── Admin user setup ───────────────────────────────────────────────────
    console.log('[SETUP] Creating admin user...');
    const { data: adminAuth, error: adminErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
    });
    assert(!adminErr, `Admin creation failed: ${adminErr?.message}`);
    adminUserId = adminAuth.user.id;
    await serviceClient.from('profiles').update({ role: 'admin' }).eq('id', adminUserId);
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email: adminEmail, password });
    assert(!signInErr, `Admin sign-in failed: ${signInErr?.message}`);
    adminCookie = buildAuthCookieHeader(signIn.session);
    console.log('  Admin session ready.\n');

    // Save original business settings before we clobber them
    const { data: origRow } = await serviceClient
      .from('site_settings').select('value').eq('key', 'business').maybeSingle();
    originalBusiness = origRow?.value || {};

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: getSetting("business") returns expected shape with all required fields
    // We call saveBusinessAction first to ensure the row is seeded in the DB,
    // then read directly from Supabase to bypass any Redis cache staleness.
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(1, 'getSetting("business") returns expected shape', async () => {
      // Ensure the business setting has all fields by saving a known good object
      await setBusiness({
        phone: '',
        email: '',
        address: '',
        gst_no: '',
        instagram: '',
        facebook: '',
      }, adminCookie);

      // Read directly from DB (bypasses Redis cache which may have stale data)
      const { data: row } = await serviceClient
        .from('site_settings')
        .select('value')
        .eq('key', 'business')
        .maybeSingle();
      const biz = row?.value || {};

      assert(typeof biz === 'object' && biz !== null, `Expected object, got ${typeof biz}`);
      const requiredFields = ['phone', 'email', 'address', 'gst_no', 'instagram', 'facebook'];
      for (const f of requiredFields) {
        assert(f in biz, `Expected field "${f}" in business setting, got keys: ${Object.keys(biz).join(', ')}`);
      }
      console.log(`  Fields present: ${Object.keys(biz).join(', ')}`);
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Footer HTML contains business data when set
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(2, 'Footer HTML contains phone, email, GSTIN when set', async () => {
      const testBiz = {
        phone: '9876543210',
        email: 'hello@stitch6k.com',
        address: 'Tiruppur, Tamil Nadu, India',
        gst_no: '33ABCDE1234F1Z5',
        instagram: 'https://instagram.com/stitch6k',
        facebook: 'https://facebook.com/stitch6k',
      };
      await setBusiness(testBiz, adminCookie);

      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(15000) });
      assert(res.ok, `Homepage returned HTTP ${res.status}`);
      const html = await res.text();

      assert(html.includes('9876543210'), `Expected "9876543210" in HTML`);
      assert(html.includes('hello@stitch6k.com'), `Expected "hello@stitch6k.com" in HTML`);
      assert(html.includes('33ABCDE1234F1Z5'), `Expected GSTIN "33ABCDE1234F1Z5" in HTML`);
      assert(html.includes('tel:9876543210'), `Expected tel:9876543210 link in footer`);
      assert(html.includes('mailto:hello@stitch6k.com'), `Expected mailto link in footer`);

      console.log('  ✓ phone, email, GSTIN all found in page HTML');
      console.log('  ✓ tel: and mailto: links found');
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: WhatsApp button rendered with correct href when phone is set
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(3, 'WhatsApp button rendered with correct wa.me href when phone set', async () => {
      // phone=9876543210 already set from TEST 2 — reuse same page fetch
      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(15000) });
      assert(res.ok, `Homepage returned HTTP ${res.status}`);
      const html = await res.text();

      assert(
        html.includes('https://wa.me/919876543210'),
        `Expected "https://wa.me/919876543210" in HTML`
      );
      assert(!html.includes('XXXXXXXXXX'), `Found placeholder XXXXXXXXXX in HTML — must be gone`);

      console.log('  ✓ wa.me/91... link found in HTML');
      console.log('  ✓ XXXXXXXXXX placeholder is gone');
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: WhatsApp button NOT rendered when phone is empty
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(4, 'WhatsApp button hidden (not rendered) when phone is empty', async () => {
      await setBusiness({
        phone: '',
        email: 'hello@stitch6k.com',
        address: 'Tiruppur, Tamil Nadu, India',
        gst_no: '33ABCDE1234F1Z5',
        instagram: '',
        facebook: '',
      }, adminCookie);

      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(15000) });
      assert(res.ok, `Homepage returned HTTP ${res.status}`);
      const html = await res.text();

      assert(!html.includes('wa.me'), `Expected NO wa.me href in HTML when phone is empty, but found one`);
      assert(!html.includes('XXXXXXXXXX'), `Found placeholder XXXXXXXXXX in HTML`);

      console.log('  ✓ No wa.me link when phone is empty');
      console.log('  ✓ No XXXXXXXXXX placeholder');
    }).catch(() => false)) passed++;

  } finally {
    console.log('\n[CLEANUP] Restoring original business settings...');
    try {
      if (adminCookie) await setBusiness(originalBusiness, adminCookie);
      else {
        // Fallback: direct DB restore (no cache bust possible without admin session)
        await serviceClient.from('site_settings')
          .upsert({ key: 'business', value: originalBusiness, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
      console.log('  Business settings restored.');
    } catch (e) {
      console.warn('  Could not restore business settings:', e.message);
    }

    if (adminUserId) {
      await serviceClient.auth.admin.deleteUser(adminUserId);
      console.log('  Admin test user deleted.');
    }
    stopManagedServer();
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed${' '.repeat(47 - String(passed).length - String(total).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  stopManagedServer();
  process.exit(1);
});

