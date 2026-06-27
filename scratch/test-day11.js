'use strict';

/**
 * Day 11 Product Variants Integration Tests
 *
 * Pattern: same as scratch/test-day9-5.js. Boot dev server if needed.
 * Use service-role Supabase client for setup/cleanup.
 */

const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { db } = require('./db');

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
  managedServer.stderr.on('data', d => process.stdout.write(`  [dev] ${d}`));

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
  if (!actionName.includes(':')) {
    if (actionName.startsWith('get')) {
      prefixedActionName = 'read:' + actionName;
    } else if (actionName.includes('Product')) {
      prefixedActionName = 'product:' + actionName;
    } else if (actionName.includes('Order')) {
      prefixedActionName = 'order:' + actionName;
    } else if (actionName.includes('Coupon')) {
      prefixedActionName = 'coupon:' + actionName;
    } else if (actionName.includes('Customer')) {
      prefixedActionName = 'customer:' + actionName;
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Day 11 Product Variants Integration Tests               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Project ref : ${PROJECT_REF}`);
  console.log(`API base    : ${BASE_URL}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  await ensureServer();

  const ts = Date.now();
  let passed = 0;
  const total = 9;

  const adminEmail = `admin-day11-${ts}@example.com`;
  const password = 'TestPass123!';
  let adminUserId = null;
  let adminCookie = null;

  const testProductId = `DAY11-VAR-${ts}`;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Setup: Admin user creation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SETUP] Creating test admin user...');
    const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    assert(!adminAuthErr, `Admin creation failed: ${adminAuthErr?.message}`);
    adminUserId = adminAuth.user.id;
    console.log(`  Admin Auth created: ${adminEmail} (ID: ${adminUserId})`);

    await sleep(1000); // wait for trigger/sync

    // Update profile role to admin
    const { error: adminProfErr } = await serviceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId);
    assert(!adminProfErr, `Admin profile role update failed: ${adminProfErr?.message}`);
    console.log('  Admin role granted in profiles.');

    // Authenticate
    const { data: adminSignIn, error: adminSignInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert(!adminSignInErr, `Admin sign-in failed: ${adminSignInErr?.message}`);
    adminCookie = buildAuthCookieHeader(adminSignIn.session);
    console.log('  Admin cookies captured.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: getProductsAction returns products WITH variants attached
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(1, 'getProductsAction returns products WITH variants attached', async () => {
      const res = await invokeAction(adminCookie, 'getProductsAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);
      assert(Array.isArray(res.products), 'Expected res.products to be an array');
      
      // Assert that at least one product has a variants array
      const productWithVariants = res.products.find(p => Array.isArray(p.variants) && p.variants.length > 0);
      assert(productWithVariants !== undefined, 'Expected at least one product to have variants attached');
      
      // Assert fields on variants
      for (const variant of productWithVariants.variants) {
        assert(typeof variant.size === 'string', 'Variant size must be string');
        assert(typeof variant.color === 'string', 'Variant color must be string');
        assert(typeof variant.sku === 'string', 'Variant sku must be string');
        assert(typeof variant.price === 'number', 'Variant price must be number');
        assert(typeof variant.stock === 'number', 'Variant stock must be number');
      }
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: saveProductAction creates a product with variants
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(2, 'saveProductAction creates a product with variants', async () => {
      const payload = {
        id: testProductId,
        title: 'Test Day 11 Product',
        category: 'Cotton',
        basePrice: 1000,
        gstRate: 12,
        discountRate: 0,
        variants: [
          { size: 'S', color: 'Red', sku: 'DAY11-S-RED', price: 1000, stock: 5 },
          { size: 'M', color: 'Red', sku: 'DAY11-M-RED', price: 1000, stock: 10 },
          { size: 'L', color: 'Blue', sku: 'DAY11-L-BLU', price: 1000, stock: 3 },
        ],
      };
      
      const res = await invokeAction(adminCookie, 'saveProductAction', payload);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB direct query (bypassing cache)
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      
      assert(!error, `Failed to query product_variants from DB: ${error?.message}`);
      assert(variants.length === 3, `Expected exactly 3 variants, got ${variants.length}`);

      const sRed = variants.find(v => v.size === 'S' && v.color === 'Red');
      const mRed = variants.find(v => v.size === 'M' && v.color === 'Red');
      const lBlu = variants.find(v => v.size === 'L' && v.color === 'Blue');

      assert(sRed && sRed.sku === 'DAY11-S-RED' && Number(sRed.price) === 1000 && sRed.stock === 5, 'S/Red mismatch');
      assert(mRed && mRed.sku === 'DAY11-M-RED' && Number(mRed.price) === 1000 && mRed.stock === 10, 'M/Red mismatch');
      assert(lBlu && lBlu.sku === 'DAY11-L-BLU' && Number(lBlu.price) === 1000 && lBlu.stock === 3, 'L/Blue mismatch');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Updating product with fewer variants deletes removed ones
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(3, 'Updating product with fewer variants deletes removed ones', async () => {
      const payload = {
        id: testProductId,
        title: 'Test Day 11 Product',
        category: 'Cotton',
        basePrice: 1000,
        gstRate: 12,
        discountRate: 0,
        variants: [
          { size: 'S', color: 'Red', sku: 'DAY11-S-RED', price: 1000, stock: 5 },
          { size: 'M', color: 'Red', sku: 'DAY11-M-RED', price: 1000, stock: 10 },
        ],
      };
      
      const res = await invokeAction(adminCookie, 'saveProductAction', payload);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB direct query
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      
      assert(!error, `Failed to query product_variants from DB: ${error?.message}`);
      assert(variants.length === 2, `Expected exactly 2 variants, got ${variants.length}`);

      const lBlu = variants.find(v => v.size === 'L' && v.color === 'Blue');
      assert(!lBlu, 'Expected L/Blue variant to be deleted');
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: UNIQUE constraint enforced — can't create duplicate (size, color)
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(4, 'UNIQUE constraint enforced — collapses duplicate combos', async () => {
      const payload = {
        id: testProductId,
        title: 'Test Day 11 Product',
        category: 'Cotton',
        basePrice: 1000,
        gstRate: 12,
        discountRate: 0,
        variants: [
          { size: 'S', color: 'Red', sku: 'DAY11-S-RED', price: 1000, stock: 5 },
          { size: 'S', color: 'Red', sku: 'DAY11-S-RED-DUP', price: 1000, stock: 8 },
          { size: 'M', color: 'Red', sku: 'DAY11-M-RED', price: 1000, stock: 10 },
        ],
      };
      
      const res = await invokeAction(adminCookie, 'saveProductAction', payload);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB direct query
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      
      assert(!error, `Failed to query product_variants from DB: ${error?.message}`);
      
      // It should have collapsed the S/Red variants into 1 row, leaving exactly 2 rows
      assert(variants.length === 2, `Expected exactly 2 variants in DB, got ${variants.length}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: restockProductAction adds to ALL variants
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(5, 'restockProductAction adds to ALL variants', async () => {
      // S/Red and M/Red exist. Restock with addPerSize=3.
      const res = await invokeAction(adminCookie, 'restockProductAction', testProductId, 3);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      
      assert(!error, `Failed to query product_variants from DB: ${error?.message}`);
      
      const sRed = variants.find(v => v.size === 'S' && v.color === 'Red');
      const mRed = variants.find(v => v.size === 'M' && v.color === 'Red');

      // Previous stock: S/Red was 8 (collapsed from 5 then 8 in test 4), M/Red was 10.
      // S/Red becomes 8 + 3 = 11. M/Red becomes 10 + 3 = 13.
      assert(sRed && sRed.stock === 11, `Expected S/Red stock to be 11, got ${sRed?.stock}`);
      assert(mRed && mRed.stock === 13, `Expected M/Red stock to be 13, got ${mRed?.stock}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: adjustProductSizeAction adjusts only the matching size variants
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(6, 'adjustProductSizeAction adjusts only the matching size variants', async () => {
      const res = await invokeAction(adminCookie, 'adjustProductSizeAction', testProductId, 'S', -2);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      
      assert(!error, `Failed to query product_variants from DB: ${error?.message}`);
      
      const sRed = variants.find(v => v.size === 'S' && v.color === 'Red');
      const mRed = variants.find(v => v.size === 'M' && v.color === 'Red');

      // S/Red stock should go from 11 to 9. M/Red should remain 13.
      assert(sRed && sRed.stock === 9, `Expected S/Red stock to be 9, got ${sRed?.stock}`);
      assert(mRed && mRed.stock === 13, `Expected M/Red stock to be 13, got ${mRed?.stock}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: adjustProductSizeAction clamps to zero on underflow
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(7, 'adjustProductSizeAction clamps to zero on underflow', async () => {
      const res = await invokeAction(adminCookie, 'adjustProductSizeAction', testProductId, 'S', -9999);
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      // Verify DB
      const { data: variants, error } = await serviceClient
        .from('product_variants')
        .select('*')
        .eq('product_id', testProductId);
      
      assert(!error, `Failed to query product_variants from DB: ${error?.message}`);
      
      const sRed = variants.find(v => v.size === 'S' && v.color === 'Red');
      assert(sRed && sRed.stock === 0, `Expected S/Red stock to be 0, got ${sRed?.stock}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Storefront getProducts (anonymous) returns derived sizeStock
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(8, 'Storefront getProducts (anonymous) returns derived sizeStock', async () => {
      // Query products table directly to make sure we bypass actions
      const { data: directProds, error: directErr } = await anonClient
        .from('products')
        .select('*')
        .eq('id', testProductId)
        .single();
      assert(!directErr && directProds, 'Could not query products table directly');

      // Call db.getProducts() using the imported db module
      const products = await db.getProducts();
      
      const testProd = products.find(p => p.id === testProductId);
      assert(testProd !== undefined, `Product ${testProductId} not found via db.getProducts()`);
      
      // Assert sizeStock keys S, M, L, XL, XXL exist
      assert(testProd.sizeStock && typeof testProd.sizeStock === 'object', 'Expected sizeStock object');
      assert('S' in testProd.sizeStock, 'S missing in sizeStock');
      assert('M' in testProd.sizeStock, 'M missing in sizeStock');
      assert('L' in testProd.sizeStock, 'L missing in sizeStock');
      assert('XL' in testProd.sizeStock, 'XL missing in sizeStock');
      assert('XXL' in testProd.sizeStock, 'XXL missing in sizeStock');

      // Current stock in variants: S/Red = 0 (after test 7 clamp), M/Red = 13.
      assert(testProd.sizeStock.S === 0, `Expected sizeStock.S to be 0, got ${testProd.sizeStock.S}`);
      assert(testProd.sizeStock.M === 13, `Expected sizeStock.M to be 13, got ${testProd.sizeStock.M}`);
    });
    passed++;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Variant changes propagate to product detail
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(9, 'Variant changes propagate to product detail', async () => {
      const res = await invokeAction(adminCookie, 'getProductsAction');
      assert(res.success === true, `Expected success=true, got: ${JSON.stringify(res)}`);

      const testProd = res.products.find(p => p.id === testProductId);
      assert(testProd !== undefined, `Product ${testProductId} not found in getProductsAction`);

      // Calculate sum from variants
      let sumS = 0;
      let sumM = 0;
      let totalStock = 0;
      for (const v of testProd.variants) {
        if (v.size === 'S') sumS += v.stock;
        if (v.size === 'M') sumM += v.stock;
        totalStock += v.stock;
      }

      assert(testProd.sizeStock.S === sumS, `sizeStock.S (${testProd.sizeStock.S}) should match variants sum (${sumS})`);
      assert(testProd.sizeStock.M === sumM, `sizeStock.M (${testProd.sizeStock.M}) should match variants sum (${sumM})`);
      assert(testProd.stock === totalStock, `stock (${testProd.stock}) should match variants total (${totalStock})`);
    });
    passed++;

  } catch (err) {
    console.error(`\n!!! TEST PROCESS HALTED: ${err.message}`);
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test data...');

    // Delete test product (cascades to variants)
    try {
      await serviceClient.from('products').delete().eq('id', testProductId);
      console.log('  Product cleanup completed.');
    } catch (e) {
      console.warn('  Product cleanup warning:', e.message);
    }

    // Delete test admin user
    if (adminUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(adminUserId);
        console.log('  Admin user deleted.');
      } catch (e) {
        console.warn('  Admin user deletion warning:', e.message);
      }
    }

    console.log('[CLEANUP] Done.');
  }

  stopManagedServer();

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed                                     ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  stopManagedServer();
  process.exit(1);
});
