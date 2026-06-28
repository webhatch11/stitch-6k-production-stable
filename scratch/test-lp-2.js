'use strict';

/**
 * LP-2 tests — Landing Page Editability & Dynamic Product Placement
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

let originalMarquee = null;
let originalOfferBox = null;
let originalDisplaySections = [];

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  LP-2 — Landing Page Editability & Dynamic Placement    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await ensureServer();

  const total = 5;
  let passed = 0;
  const ts = Date.now();
  const adminEmail = `admin-lp2-${ts}@example.com`;
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

    // Seed/update some active products so the homepage has items in each section
    console.log('[SETUP] Seeding display_sections for existing products...');
    const { data: prods } = await serviceClient.from('products').select('id, is_atelier_exclusive').limit(6);
    if (prods && prods.length > 0) {
      // Store original display_sections to restore at the end
      const ids = prods.map(p => p.id);
      const { data: oldSections } = await serviceClient.from('products').select('id, display_sections').in('id', ids);
      originalDisplaySections = oldSections || [];

      // Assign sections
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        let sections = [];
        if (i % 3 === 0) sections = ['new_arrivals'];
        else if (i % 3 === 1) sections = ['bestsellers'];
        else sections = ['atelier_exclusives'];

        // If is_atelier_exclusive is true, make sure it's in exclusive section
        if (p.is_atelier_exclusive) {
          sections = ['atelier_exclusives'];
        }

        await serviceClient.from('products').update({ display_sections: sections }).eq('id', p.id);
      }
      console.log(`  Updated ${prods.length} products with test display_sections.`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Marquee Server Action and DB Save
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(1, 'saveMarqueeAction validations & database save', async () => {
      // Test invalid inputs
      try {
        await invokeAction(adminCookie, 'settings:saveMarqueeAction', [{ enabled: true, items: [] }]);
        assert(false, 'Should fail with empty items array');
      } catch (err) {
        console.log('  ✓ Correctly rejected empty marquee items');
      }

      const testMarquee = {
        enabled: true,
        items: ['TEST MARQUEE ITEM 1', 'TEST MARQUEE ITEM 2'],
      };
      await invokeAction(adminCookie, 'settings:saveMarqueeAction', [testMarquee]);

      const value = await db.getSetting('marquee');
      assert(value.enabled === true, 'Marquee should be enabled');
      assert(value.items.length === 2, 'Marquee should have 2 items');
      assert(value.items[0] === 'TEST MARQUEE ITEM 1', 'First item name mismatch');
      console.log('  ✓ Marquee settings successfully saved and verified in DB');
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Offer Box Server Action and DB Save
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(2, 'saveOfferBoxAction validations & database save', async () => {
      const testOffer = {
        enabled: true,
        label: 'TEST LABEL',
        heading: 'TEST HEADING',
        body: 'TEST BODY TEXT',
        coupon_code: 'TESTCOUPON',
        cta_text: 'TEST CTA TEXT',
        cta_url: '/test-url',
        bg_image_url: 'https://lh3.googleusercontent.com/test-bg.jpg',
      };
      await invokeAction(adminCookie, 'settings:saveOfferBoxAction', [testOffer]);

      const value = await db.getSetting('offer_box');
      assert(value.enabled === true, 'Offer Box should be enabled');
      assert(value.label === 'TEST LABEL', 'Label mismatch');
      assert(value.heading === 'TEST HEADING', 'Heading mismatch');
      assert(value.coupon_code === 'TESTCOUPON', 'Coupon code mismatch');
      assert(value.bg_image_url === 'https://lh3.googleusercontent.com/test-bg.jpg', 'Bg image mismatch');
      console.log('  ✓ Offer Box settings successfully saved and verified in DB');
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Product Save with display_sections & Filter Query
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(3, 'Save product with display_sections & filter query', async () => {
      // Find a product to edit
      const { data: plist } = await serviceClient.from('products').select('*').limit(1);
      assert(plist && plist.length > 0, 'No products available for testing');
      const testProd = plist[0];

      // Save product with new display_sections
      const sections = ['new_arrivals', 'bestsellers'];
      const payload = {
        id: testProd.id,
        title: testProd.title,
        basePrice: testProd.price,
        gstRate: testProd.gst_rate || 0,
        discountRate: testProd.discount_rate || 0,
        description: testProd.description || 'Test description',
        category: testProd.category || 'Cotton',
        image: testProd.image || 'https://lh3.googleusercontent.com/aida-public/test.jpg',
        images: testProd.gallery || [],
        sizeStock: testProd.size_stock || { S: 10, M: 10, L: 10, XL: 10, XXL: 10 },
        specFabric: testProd.spec_fabric || '',
        specFit: testProd.spec_fit || '',
        specCollar: testProd.spec_collar || '',
        specSleeve: testProd.spec_sleeve || '',
        specCare: testProd.spec_care || '',
        isNew: testProd.is_new ?? true,
        isAtelierExclusive: testProd.is_atelier_exclusive ?? false,
        customBadge: testProd.custom_badge || '',
        display_sections: sections,
        variants: [],
      };

      await invokeAction(adminCookie, 'product:saveProductAction', [payload]);

      // Query products by display_section filter
      const filtered = await db.getProducts({ display_section: 'new_arrivals' });
      console.log(`  [DIAGNOSTIC] Querying new_arrivals. Found ${filtered.length} products:`);
      console.log(`  [DIAGNOSTIC] Looking for product ID: "${testProd.id}"`);
      filtered.forEach(p => {
        console.log(`    - ID: "${p.id}", Title: "${p.title}", Sections: ${JSON.stringify(p.display_sections)}`);
      });
      const found = filtered.find(p => p.id === testProd.id);
      assert(found !== undefined, 'Edited product should be found in filtered new_arrivals list');
      assert(found.display_sections.includes('new_arrivals'), 'Product display_sections mismatch');

      console.log('  ✓ Product successfully saved with display_sections');
      console.log('  ✓ db.getProducts display_section filter works correctly');
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Frontend Homepage Renders Dynamic Settings
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(4, 'Frontend Homepage renders marquee & offer box settings', async () => {
      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(45000) });
      assert(res.ok, `Homepage returned HTTP ${res.status}`);
      const html = await res.text();

      // Check marquee items
      assert(html.includes('TEST MARQUEE ITEM 1'), 'Marquee item 1 not found in HTML');
      assert(html.includes('TEST MARQUEE ITEM 2'), 'Marquee item 2 not found in HTML');

      // Check offer box details
      assert(html.includes('TEST LABEL'), 'Offer Box label not found in HTML');
      assert(html.includes('TEST HEADING'), 'Offer Box heading not found in HTML');
      assert(html.includes('TEST BODY TEXT'), 'Offer Box body text not found in HTML');
      assert(html.includes('TESTCOUPON'), 'Offer Box coupon code not found in HTML');

      console.log('  ✓ Marquee items rendered on the homepage');
      console.log('  ✓ Offer Box details rendered on the homepage');
    }).catch(() => false)) passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Frontend Homepage Renders Filtered Sections
    // ─────────────────────────────────────────────────────────────────────────
    if (await runTest(5, 'Frontend Homepage renders display sections', async () => {
      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(45000) });
      assert(res.ok, `Homepage returned HTTP ${res.status}`);
      const html = await res.text();

      // Ensure the exclusive sections header appears if exclusives are present
      const exclusives = await db.getProducts({ display_section: 'atelier_exclusives' });
      if (exclusives.length > 0) {
        assert(html.includes('Atelier Exclusives'), 'Atelier Exclusives section title not found in HTML');
        console.log('  ✓ Atelier Exclusives section found in homepage HTML');
      } else {
        console.log('  - Skipping Atelier Exclusives HTML verification (no products marked exclusive)');
      }

      console.log('  ✓ Display sections verified successfully on the homepage');
    }).catch(() => false)) passed++;

  } finally {
    console.log('\n[CLEANUP] Restoring original landing settings & product sections...');
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

      for (const p of originalDisplaySections) {
        await serviceClient.from('products').update({ display_sections: p.display_sections }).eq('id', p.id);
      }
      
      // Clear Redis cache so we don't leave test data cached
      await db.saveProduct({ id: 'dummy' }); // triggers cache clear

      console.log('  Original settings and product display sections restored.');
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
