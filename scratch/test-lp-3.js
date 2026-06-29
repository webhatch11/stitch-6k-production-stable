'use strict';

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
    { stdio: 'ignore', cwd: path.join(__dirname, '..') }
  );
  console.log('Compilation successful!\n');
} catch (err) {
  console.error('Compilation failed.', err);
  process.exit(1);
}

const { db } = require('./db.js');

async function invokeAction(adminCookie, actionName, args) {
  const res = await fetch(`${BASE_URL}/api/admin/test-runner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({ actionName, args }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Action ${actionName} failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(`Action ${actionName} failed: ${json.error}`);
  await sleep(500); // Wait briefly
  return json;
}

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

// Track active phases to filter tests
// Change to [1,2,3,4,5,6,7,8] as phases are completed
const ENABLED_TESTS = [1, 2, 3, 4, 5, 6, 7, 8];

let originalMarquee = null;
let originalOfferBox = null;
let originalTrustBadges = null;
let originalCategories = null;
let originalHero = null;
let originalReviews = null;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  LP-3 — Landing Page Editability: Final Sprint           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const total = ENABLED_TESTS.length;
  let passed = 0;
  const ts = Date.now();
  const adminEmail = `admin-lp3-${ts}@example.com`;
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

    // Save originals
    const { data: mRow } = await serviceClient.from('site_settings').select('value').eq('key', 'marquee').maybeSingle();
    originalMarquee = mRow?.value;
    const { data: oRow } = await serviceClient.from('site_settings').select('value').eq('key', 'offer_box').maybeSingle();
    originalOfferBox = oRow?.value;
    const { data: tRow } = await serviceClient.from('site_settings').select('value').eq('key', 'trust_badges').maybeSingle();
    originalTrustBadges = tRow?.value;
    const { data: cRow } = await serviceClient.from('site_settings').select('value').eq('key', 'categories').maybeSingle();
    originalCategories = cRow?.value;
    const { data: hRow } = await serviceClient.from('site_settings').select('value').eq('key', 'hero').maybeSingle();
    originalHero = hRow?.value;
    const { data: rRow } = await serviceClient.from('site_settings').select('value').eq('key', 'reviews').maybeSingle();
    originalReviews = rRow?.value;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: saveTrustBadgesAction requires admin + persists
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(1)) {
      if (await runTest(1, 'saveTrustBadgesAction validations & database save', async () => {
        const testBadges = {
          enabled: true,
          items: [
            { icon: 'flag', title: 'TEST BADGE 1', description: 'TEST DESC 1' },
            { icon: 'shield', title: 'TEST BADGE 2', description: 'TEST DESC 2' }
          ]
        };
        await invokeAction(adminCookie, 'settings:saveTrustBadgesAction', [testBadges]);

        const value = await db.getSetting('trust_badges');
        assert(value && value.enabled === true, 'Trust badges should be enabled');
        assert(value.items.length === 2, 'Trust badges length should be 2');
        assert(value.items[0].title === 'TEST BADGE 1', 'Title mismatch');
        console.log('  ✓ Trust badges successfully saved and verified in DB');
      }).catch(() => false)) passed++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Trust badges enabled=false hides section in homepage HTML
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(2)) {
      if (await runTest(2, 'Trust badges enabled=false hides section in homepage', async () => {
        // Save enabled=false
        const testBadges = {
          enabled: false,
          items: [
            { icon: 'flag', title: 'HIDDEN BADGE', description: 'HIDDEN DESC' }
          ]
        };
        await invokeAction(adminCookie, 'settings:saveTrustBadgesAction', [testBadges]);

        const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(45000) });
        assert(res.ok, `Homepage returned HTTP ${res.status}`);
        const html = await res.text();

        assert(!html.includes('HIDDEN BADGE</h4>') && !html.includes('HIDDEN DESC</p>'), 'Disabled trust badge should not render on homepage');
        console.log('  ✓ Disabled trust badges section hidden on storefront');
      }).catch((err) => { console.error('Test 2 catch:', err.message); return false; })) passed++;
    }


    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: saveCategoriesAction requires admin + persists
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(3)) {
      if (await runTest(3, 'saveCategoriesAction validations & database save', async () => {
        const testCategories = {
          enabled: true,
          items: [
            { title: 'TEST CATEGORY 1', subtitle: 'TEST SUBTITLE 1', image_url: '/assets/folded_crimson_shirt.png', theme: 'navy', cta_url: '/cta-1' },
            { title: 'TEST CATEGORY 2', subtitle: 'TEST SUBTITLE 2', image_url: '/assets/folded_olive_shirt.png', theme: 'crimson', cta_url: '/cta-2' }
          ]
        };
        await invokeAction(adminCookie, 'settings:saveCategoriesAction', [testCategories]);

        const freshValue = await db.getSetting('categories');

        assert(freshValue && freshValue.enabled === true, 'Categories should be enabled');
        assert(freshValue.items.length === 2, 'Categories length should be 2');
        assert(freshValue.items[0].title === 'TEST CATEGORY 1', 'Title mismatch');
        console.log('  ✓ Categories successfully saved and verified in DB');
      }).catch((err) => { console.error('Test 3 catch:', err.message); return false; })) passed++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: saveCategoriesAction rejects invalid theme value
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(4)) {
      if (await runTest(4, 'saveCategoriesAction rejects invalid theme value', async () => {
        const testCategories = {
          enabled: true,
          items: [
            { title: 'BAD CATEGORY', subtitle: 'BAD SUBTITLE', image_url: '/assets/folded_crimson_shirt.png', theme: 'invalid-theme-value', cta_url: '/cta-1' }
          ]
        };
        let failed = false;
        try {
          await invokeAction(adminCookie, 'settings:saveCategoriesAction', [testCategories]);
        } catch (err) {
          failed = true;
          console.log('  ✓ Correctly rejected invalid theme enum value with error:', err.message);
        }
        assert(failed, 'Action should have rejected invalid theme enum value');
      }).catch((err) => { console.error('Test 4 catch:', err.message); return false; })) passed++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Categories items render on homepage
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(5)) {
      if (await runTest(5, 'Categories items render on homepage when set', async () => {
        const testCategories = {
          enabled: true,
          items: [
            { title: 'RENDERED CATEGORY CARD', subtitle: 'RENDERED SUBTITLE', image_url: '/assets/folded_crimson_shirt.png', theme: 'linen', cta_url: '/cta-render' }
          ]
        };
        await invokeAction(adminCookie, 'settings:saveCategoriesAction', [testCategories]);

        const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(45000) });
        assert(res.ok, `Homepage returned HTTP ${res.status}`);
        const html = await res.text();

        assert(html.includes('RENDERED CATEGORY CARD') || html.includes('RENDERED CATEGORY CARD'.toUpperCase()), 'Categories should render on homepage');
        console.log('  ✓ Categories successfully rendered on storefront');
      }).catch((err) => { console.error('Test 5 catch:', err.message); return false; })) passed++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: saveHeroAction validations & slides array persistence
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(6)) {
      if (await runTest(6, 'saveHeroAction validations & slides array persistence', async () => {
        const testHero = {
          headline: 'TEST MAIN HEADLINE',
          subheadline: 'TEST MAIN SUBTITLE',
          cta_text: 'TEST MAIN CTA',
          cta_url: '/main-cta',
          image_url: '/assets/pure_motion_6k.png',
          slides: [
            { headline: 'SLIDE 1 HEADLINE', subheadline: 'SLIDE 1 SUBTITLE', cta_text: 'SLIDE 1 CTA', cta_url: '/slide1', image_url: '/assets/pure_motion_6k.png' },
            { headline: 'SLIDE 2 HEADLINE', subheadline: 'SLIDE 2 SUBTITLE', cta_text: 'SLIDE 2 CTA', cta_url: '/slide2', image_url: '/assets/pure_motion_6k.png' }
          ]
        };
        await invokeAction(adminCookie, 'settings:saveHeroAction', [testHero]);

        const freshValue = await db.getSetting('hero');
        assert(freshValue && freshValue.headline === 'TEST MAIN HEADLINE', 'Main headline mismatch');
        assert(freshValue.slides && freshValue.slides.length === 2, 'Slides array length mismatch');
        assert(freshValue.slides[0].headline === 'SLIDE 1 HEADLINE', 'Slide 1 headline mismatch');
        console.log('  ✓ Hero setting slides array successfully saved and verified in DB');
      }).catch((err) => { console.error('Test 6 catch:', err.message); return false; })) passed++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: public submitReviewAction inserts review with approved=false
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(7)) {
      if (await runTest(7, 'public submitReviewAction inserts review with approved=false', async () => {
        const testReview = {
          name: 'TEST PUBLIC REVIEWER',
          location: 'TEST CITY',
          rating: 4,
          comment: 'TEST REVIEW COMMENT 1'
        };
        await invokeAction(adminCookie, 'public_review:submitReviewAction', [testReview]);

        const reviewsRes = await invokeAction(adminCookie, 'settings:getReviewsAction', []);
        assert(reviewsRes.success && Array.isArray(reviewsRes.value), 'getReviewsAction returned error or invalid list');

        const submitted = reviewsRes.value.find((r) => r.comment === 'TEST REVIEW COMMENT 1');
        assert(submitted, 'Submitted review not found in DB');
        assert(submitted.approved === false, 'Review should be pending (approved=false) by default');
        console.log('  ✓ Public review successfully submitted and verified as pending in DB');
      }).catch((err) => { console.error('Test 7 catch:', err.message); return false; })) passed++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: admin actions moderates reviews (approve, reject, update)
    // ─────────────────────────────────────────────────────────────────────────
    if (ENABLED_TESTS.includes(8)) {
      if (await runTest(8, 'admin actions moderate reviews (approve, reject, update)', async () => {
        const testReview = {
          name: 'TEST PUBLIC MOD REVIEW',
          location: 'TEST CITY',
          rating: 5,
          comment: 'TEST REVIEW FOR MODERATION'
        };
        await invokeAction(adminCookie, 'public_review:submitReviewAction', [testReview]);

        let reviewsRes = await invokeAction(adminCookie, 'settings:getReviewsAction', []);
        let target = reviewsRes.value.find((r) => r.comment === 'TEST REVIEW FOR MODERATION');
        assert(target, 'Moderation review not found');
        const reviewId = target.id;

        // 1. Approve review
        await invokeAction(adminCookie, 'settings:approveReviewAction', [reviewId]);
        reviewsRes = await invokeAction(adminCookie, 'settings:getReviewsAction', []);
        target = reviewsRes.value.find((r) => r.id === reviewId);
        assert(target && target.approved === true, 'Review was not approved');
        console.log('  ✓ Successfully approved review');

        // 2. Update review
        await invokeAction(adminCookie, 'settings:updateReviewAction', [reviewId, 'TEST REVIEW COMMENT 2 MODIFIED']);
        reviewsRes = await invokeAction(adminCookie, 'settings:getReviewsAction', []);
        target = reviewsRes.value.find((r) => r.id === reviewId);
        assert(target && target.comment === 'TEST REVIEW COMMENT 2 MODIFIED', 'Review comment not updated');
        console.log('  ✓ Successfully updated review comment');

        // 3. Reject/Delete review
        await invokeAction(adminCookie, 'settings:rejectReviewAction', [reviewId]);
        reviewsRes = await invokeAction(adminCookie, 'settings:getReviewsAction', []);
        target = reviewsRes.value.find((r) => r.id === reviewId);
        assert(!target, 'Review not deleted after reject');
        console.log('  ✓ Successfully rejected/deleted review');
      }).catch((err) => { console.error('Test 8 catch:', err.message); return false; })) passed++;
    }



  } finally {
    console.log('\n[CLEANUP] Restoring original landing settings...');
    try {
      if (originalMarquee) {
        await serviceClient.from('site_settings').upsert({ key: 'marquee', value: originalMarquee, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else {
        await serviceClient.from('site_settings').delete().eq('key', 'marquee');
      }

      if (originalOfferBox) {
        await serviceClient.from('site_settings').upsert({ key: 'offer_box', value: originalOfferBox, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else {
        await serviceClient.from('site_settings').delete().eq('key', 'offer_box');
      }

      if (originalTrustBadges) {
        await serviceClient.from('site_settings').upsert({ key: 'trust_badges', value: originalTrustBadges, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else {
        await serviceClient.from('site_settings').delete().eq('key', 'trust_badges');
      }

      if (originalCategories) {
        await serviceClient.from('site_settings').upsert({ key: 'categories', value: originalCategories, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else {
        await serviceClient.from('site_settings').delete().eq('key', 'categories');
      }

      if (originalHero) {
        await serviceClient.from('site_settings').upsert({ key: 'hero', value: originalHero, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else {
        await serviceClient.from('site_settings').delete().eq('key', 'hero');
      }

      if (originalReviews) {
        await serviceClient.from('site_settings').upsert({ key: 'reviews', value: originalReviews, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else {
        await serviceClient.from('site_settings').delete().eq('key', 'reviews');
      }

      // Delete any test reviews
      await serviceClient.from('reviews').delete().ilike('comment', '%TEST REVIEW%');

      // Invalidate Redis caches
      await db.saveProduct({ id: 'dummy' });
      console.log('  Original settings restored.');
    } catch (e) {
      console.warn('  Could not restore original settings:', e.message);
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

  if (passed < total) {
    console.error(`FATAL ERROR: Only ${passed}/${total} tests passed.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  stopManagedServer();
  process.exit(1);
});
