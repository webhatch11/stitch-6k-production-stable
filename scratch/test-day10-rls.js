'use strict';

/**
 * Day 10 Phase 2 RLS Soft-Delete Verification Test
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
const total = 8;

async function runTest(num, name, fn) {
  const bar = '─'.repeat(60);
  console.log(`\n${bar}`);
  console.log(`TEST ${num}: ${name}`);
  console.log(bar);
  try {
    await fn();
    console.log(`✓ PASS  TEST ${num}`);
    passed++;
  } catch (err) {
    console.error(`✗ FAIL  TEST ${num}: ${err.message}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Day 10 RLS Soft-Delete Verification                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  let testId = 'DAY10-RLS-TEST';
  let testSlug = 'day10-rls-test';
  let testTitle = 'RLS Test Product';
  let isCreated = false;

  try {
    console.log('\n[SETUP] Finding or creating test product...');
    const { data: existingProducts, error: findErr } = await serviceClient
      .from('products')
      .select('id, title, deleted_at, slug')
      .or('id.ilike.DAY%,id.ilike.TEST%,id.eq.dcsdc,id.eq.3eeeddc')
      .is('deleted_at', null)
      .limit(1);

    if (findErr) {
      console.warn(`  Warning finding existing test product: ${findErr.message}`);
    }

    if (existingProducts && existingProducts.length > 0) {
      testId = existingProducts[0].id;
      testSlug = existingProducts[0].slug;
      testTitle = existingProducts[0].title;
      console.log(`  Found existing test product: ${testTitle} (${testId})`);
    } else {
      console.log(`  No existing test product found. Creating one...`);
      const { error: insErr } = await serviceClient.from('products').insert({
        id: testId,
        title: testTitle,
        slug: testSlug,
        price: 100,
        base_price: 100,
        category: 'Cotton',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
        deleted_at: null
      });
      if (insErr) {
        throw new Error(`Failed to create test product: ${insErr.message}`);
      }
      isCreated = true;
      console.log(`  Created test product: ${testTitle} (${testId})`);
    }

    // TEST 1: Anonymous client sees the product when deleted_at IS NULL
    await runTest(1, 'Anonymous client sees the product when deleted_at IS NULL', async () => {
      const { data, error } = await anonClient
        .from('products')
        .select('id')
        .eq('id', testId)
        .maybeSingle();

      assert(!error, `Query error: ${error?.message}`);
      assert(data !== null, 'Expected data to not be null');
      assert(data.id === testId, `Expected product ID ${testId}, got ${data.id}`);
    });

    // TEST 2: Soft-delete the product via service role
    await runTest(2, 'Soft-delete the product via service role', async () => {
      const { error } = await serviceClient
        .from('products')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', testId);

      assert(!error, `Update error: ${error?.message}`);
    });

    // TEST 3: Anonymous client CANNOT see the soft-deleted product
    await runTest(3, 'Anonymous client CANNOT see the soft-deleted product', async () => {
      const { data, error } = await anonClient
        .from('products')
        .select('id')
        .eq('id', testId)
        .maybeSingle();

      assert(!error, `Query error: ${error?.message}`);
      assert(data === null, `Expected data to be null (hidden by RLS), got: ${JSON.stringify(data)}`);
    });

    // TEST 4: Anonymous list query excludes soft-deleted product
    await runTest(4, 'Anonymous list query excludes soft-deleted product', async () => {
      const { data, error } = await anonClient
        .from('products')
        .select('id')
        .limit(100);

      assert(!error, `Query error: ${error?.message}`);
      assert(Array.isArray(data), 'Expected results to be an array');
      const containsId = data.some(p => p.id === testId);
      assert(!containsId, `Expected result list to exclude ${testId}, but it was found`);
    });

    // TEST 5: Service role still sees the soft-deleted product
    await runTest(5, 'Service role still sees the soft-deleted product', async () => {
      const { data, error } = await serviceClient
        .from('products')
        .select('id, deleted_at')
        .eq('id', testId)
        .maybeSingle();

      assert(!error, `Query error: ${error?.message}`);
      assert(data !== null, 'Expected service client to see soft-deleted product');
      assert(data.deleted_at !== null, 'Expected deleted_at to not be null');
    });

    // TEST 6: Restore the product (deleted_at = NULL)
    await runTest(6, 'Restore the product (deleted_at = NULL)', async () => {
      const { error } = await serviceClient
        .from('products')
        .update({ deleted_at: null })
        .eq('id', testId);

      assert(!error, `Update error: ${error?.message}`);
    });

    // TEST 7: Anonymous client sees the restored product again
    await runTest(7, 'Anonymous client sees the restored product again', async () => {
      const { data, error } = await anonClient
        .from('products')
        .select('id')
        .eq('id', testId)
        .maybeSingle();

      assert(!error, `Query error: ${error?.message}`);
      assert(data !== null, 'Expected data to not be null');
      assert(data.id === testId, `Expected product ID ${testId}, got ${data.id}`);
    });

    // TEST 8: Direct product page query via slug works after restore
    await runTest(8, 'Direct product page query via slug works after restore', async () => {
      const { data, error } = await anonClient
        .from('products')
        .select('*')
        .eq('slug', testSlug)
        .maybeSingle();

      assert(!error, `Query error: ${error?.message}`);
      assert(data !== null, `Expected product details for slug ${testSlug} to be visible`);
    });

  } catch (err) {
    console.error(`\n!!! FATAL TEST RUN FAILURE: ${err.message}`);
  } finally {
    // CLEANUP
    console.log('\n[CLEANUP] Cleaning up test data...');
    if (isCreated) {
      const { error } = await serviceClient
        .from('products')
        .delete()
        .eq('id', testId);
      if (error) {
        console.warn(`  Warning: Failed to delete created test product ${testId}: ${error.message}`);
      } else {
        console.log(`  Successfully hard-deleted created test product ${testId}.`);
      }
    } else {
      // Restore to null just in case it was an existing product that we mutated
      const { error } = await serviceClient
        .from('products')
        .update({ deleted_at: null })
        .eq('id', testId);
      if (error) {
        console.warn(`  Warning: Failed to reset deleted_at to null for existing product ${testId}: ${error.message}`);
      } else {
        console.log(`  Successfully reset deleted_at to null for existing product ${testId}.`);
      }
    }
    console.log('[CLEANUP] Done.');
  }

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed                                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nUNHANDLED EXCEPTION:', err);
  process.exit(1);
});
