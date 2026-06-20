'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const totalTests = 6;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(testNum, testName, fn) {
  console.log(`\n--- TEST ${testNum}: ${testName} ---`);
  try {
    await fn();
    console.log(`[PASS] TEST ${testNum}`);
    return true;
  } catch (err) {
    console.error(`[FAIL] TEST ${testNum}: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('=== Starting Issue #5 Inventory Function Verification ===');

  const productId = "RLS-TEST-P5-" + Date.now();
  const sku = "SKU-TEST-P5-" + Date.now();
  let variantId = null;

  // SETUP: Insert product and variant
  console.log('\n[SETUP] Creating test product and variant...');
  
  // Insert product
  const { error: prodErr } = await serviceClient.from('products').insert({
    id: productId,
    slug: productId.toLowerCase(),
    title: 'Test Product 5',
    price: 1000,
    category: 'Test Category',
    stock: 10
  });
  if (prodErr) throw new Error(`Failed to insert product: ${prodErr.message}`);
  console.log(`Created product: ${productId}`);

  // Insert variant
  const { data: variantData, error: varErr } = await serviceClient.from('product_variants').insert({
    product_id: productId,
    size: 'M',
    color: 'Black',
    price: 1000,
    stock: 10,
    sku: sku
  }).select('*').single();
  
  if (varErr) throw new Error(`Failed to insert variant: ${varErr.message}`);
  variantId = variantData.id;
  console.log(`Created variant with ID: ${variantId}`);

  let passedTestsCount = 0;

  try {
    // TEST 1 — deduct_variant_stock decreases stock
    await runTest(1, 'deduct_variant_stock decreases stock', async () => {
      const { data, error } = await serviceClient.rpc('deduct_variant_stock', {
        p_product_id: productId,
        p_size: 'M',
        p_color: 'Black',
        p_quantity: 3
      });
      assert(!error, `RPC failed: ${error?.message}`);
      assert(data === true, `Expected data to be true, got: ${data}`);

      // Re-query variant
      const { data: varData, error: varQueryErr } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('id', variantId)
        .single();
      assert(!varQueryErr, `Failed to query variant stock: ${varQueryErr?.message}`);
      assert(varData.stock === 7, `Expected variant stock to be 7, got ${varData.stock}`);

      // Query inventory_audit_logs
      const { data: auditData, error: auditErr } = await serviceClient
        .from('inventory_audit_logs')
        .select('*')
        .eq('variant_id', variantId);
      assert(!auditErr, `Failed to query audit logs: ${auditErr?.message}`);
      assert(auditData && auditData.length === 1, `Expected exactly 1 audit log row, got ${auditData?.length}`);
      assert(auditData[0].quantity_changed === -3, `Expected quantity_changed to be -3, got ${auditData[0].quantity_changed}`);
      assert(auditData[0].type === 'deduction', `Expected type to be "deduction", got "${auditData[0].type}"`);
    });
    passedTestsCount++;

    // TEST 2 — deduct returns false when insufficient stock
    await runTest(2, 'deduct returns false when insufficient stock', async () => {
      const { data, error } = await serviceClient.rpc('deduct_variant_stock', {
        p_product_id: productId,
        p_size: 'M',
        p_color: 'Black',
        p_quantity: 999
      });
      assert(!error, `RPC failed: ${error?.message}`);
      assert(data === false, `Expected data to be false, got: ${data}`);

      // Re-query variant
      const { data: varData, error: varQueryErr } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('id', variantId)
        .single();
      assert(!varQueryErr, `Failed to query variant stock: ${varQueryErr?.message}`);
      assert(varData.stock === 7, `Expected variant stock to be 7, got ${varData.stock}`);

      // Query audit logs
      const { data: auditData, error: auditErr } = await serviceClient
        .from('inventory_audit_logs')
        .select('*')
        .eq('variant_id', variantId);
      assert(!auditErr, `Failed to query audit logs: ${auditErr?.message}`);
      assert(auditData && auditData.length === 1, `Expected still exactly 1 audit log row, got ${auditData?.length}`);
    });
    passedTestsCount++;

    // TEST 3 — deduct returns false for missing variant
    await runTest(3, 'deduct returns false for missing variant', async () => {
      const { data, error } = await serviceClient.rpc('deduct_variant_stock', {
        p_product_id: 'NONEXISTENT',
        p_size: 'M',
        p_color: 'Black',
        p_quantity: 1
      });
      assert(!error, `RPC failed: ${error?.message}`);
      assert(data === false, `Expected data to be false, got: ${data}`);
    });
    passedTestsCount++;

    // TEST 4 — restore_variant_stock increases stock
    await runTest(4, 'restore_variant_stock increases stock', async () => {
      const { error } = await serviceClient.rpc('restore_variant_stock', {
        p_product_id: productId,
        p_size: 'M',
        p_color: 'Black',
        p_quantity: 2
      });
      assert(!error, `RPC failed: ${error?.message}`);

      // Re-query variant
      const { data: varData, error: varQueryErr } = await serviceClient
        .from('product_variants')
        .select('stock')
        .eq('id', variantId)
        .single();
      assert(!varQueryErr, `Failed to query variant stock: ${varQueryErr?.message}`);
      assert(varData.stock === 9, `Expected variant stock to be 9, got ${varData.stock}`);

      // Query audit logs
      const { data: auditData, error: auditErr } = await serviceClient
        .from('inventory_audit_logs')
        .select('*')
        .eq('variant_id', variantId)
        .order('created_at', { ascending: true });
      assert(!auditErr, `Failed to query audit logs: ${auditErr?.message}`);
      assert(auditData && auditData.length === 2, `Expected exactly 2 audit log rows, got ${auditData?.length}`);
      assert(auditData[1].quantity_changed === 2, `Expected second row quantity_changed to be 2, got ${auditData[1].quantity_changed}`);
      assert(auditData[1].type === 'restoration', `Expected second row type to be "restoration", got "${auditData[1].type}"`);
    });
    passedTestsCount++;

    // TEST 5 — reserve_variant_inventory_atomic succeeds
    await runTest(5, 'reserve_variant_inventory_atomic succeeds', async () => {
      const { data, error } = await serviceClient.rpc('reserve_variant_inventory_atomic', {
        p_product_id: productId,
        p_size: 'M',
        p_color: 'Black',
        p_quantity: 2,
        p_expires_mins: 15,
        p_session: 'test-session-1'
      });
      assert(!error, `RPC failed: ${error?.message}`);
      assert(data && typeof data === 'object', `Expected object, got: ${typeof data}`);
      assert(data.success === true, `Expected success to be true, got: ${data.success}`);
      assert(typeof data.remaining_available === 'number', `Expected remaining_available to be a number, got: ${data.remaining_available}`);

      // Query inventory_reservations
      const { data: resData, error: resErr } = await serviceClient
        .from('inventory_reservations')
        .select('*')
        .eq('session_id', 'test-session-1');
      assert(!resErr, `Querying reservations failed: ${resErr?.message}`);
      assert(resData && resData.length === 1, `Expected exactly 1 reservation row, got ${resData?.length}`);
      assert(resData[0].product_id === productId, `Expected product_id to match, got ${resData[0].product_id}`);
      assert(resData[0].size === 'M', `Expected size to be "M", got ${resData[0].size}`);
      assert(resData[0].color === 'Black', `Expected color to be "Black", got ${resData[0].color}`);
      assert(resData[0].quantity === 2, `Expected quantity to be 2, got ${resData[0].quantity}`);
      assert(resData[0].status === 'reserved' || resData[0].status === 'ACTIVE', `Expected status to be reserved/ACTIVE, got "${resData[0].status}"`);
      const expiresAt = new Date(resData[0].expires_at);
      assert(expiresAt > new Date(), 'Expected expires_at to be in the future');
    });
    passedTestsCount++;

    // TEST 6 — reserve fails on insufficient available stock
    await runTest(6, 'reserve fails on insufficient available stock', async () => {
      const { data, error } = await serviceClient.rpc('reserve_variant_inventory_atomic', {
        p_product_id: productId,
        p_size: 'M',
        p_color: 'Black',
        p_quantity: 999,
        p_expires_mins: 15,
        p_session: 'test-session-2'
      });
      assert(!error, `RPC failed: ${error?.message}`);
      assert(data && typeof data === 'object', `Expected object, got: ${typeof data}`);
      assert(data.success === false, `Expected success to be false, got: ${data.success}`);
      assert(data.error && data.error.includes('Insufficient inventory'), `Expected error message to include 'Insufficient inventory', got: "${data.error}"`);

      // Query inventory_reservations for test-session-2
      const { data: resData, error: resErr } = await serviceClient
        .from('inventory_reservations')
        .select('*')
        .eq('session_id', 'test-session-2');
      assert(!resErr, `Querying reservations failed: ${resErr?.message}`);
      assert(!resData || resData.length === 0, `Expected 0 reservations, got ${resData?.length}`);
    });
    passedTestsCount++;

  } catch (err) {
    console.error('\n!!! INVENTORY TEST FAILED !!!');
    console.error('Skipping cleanup so database remains in failed state for investigation.');
    process.exit(1);
  }

  // CLEANUP
  console.log('\n[CLEANUP] Cleaning up test data...');
  try {
    // Delete reservations
    const { error: cleanResErr } = await serviceClient.from('inventory_reservations').delete().like('session_id', 'test-session-%');
    if (cleanResErr) console.error(`Error deleting reservations: ${cleanResErr.message}`);

    // Delete audit logs
    if (variantId) {
      const { error: cleanAuditErr } = await serviceClient.from('inventory_audit_logs').delete().eq('variant_id', variantId);
      if (cleanAuditErr) console.error(`Error deleting audit logs: ${cleanAuditErr.message}`);
    }

    // Delete variant
    const { error: cleanVarErr } = await serviceClient.from('product_variants').delete().eq('product_id', productId);
    if (cleanVarErr) console.error(`Error deleting variant: ${cleanVarErr.message}`);

    // Delete product
    const { error: cleanProdErr } = await serviceClient.from('products').delete().eq('id', productId);
    if (cleanProdErr) console.error(`Error deleting product: ${cleanProdErr.message}`);

    console.log('[CLEANUP] Cleaned up test data.');
  } catch (cleanupErr) {
    console.error(`[CLEANUP] Cleanup failed: ${cleanupErr.message}`);
  }

  console.log(`\n=== Issue #5 Inventory Test Summary: ${passedTestsCount}/${totalTests} Passed ===`);
  if (passedTestsCount === totalTests) {
    console.log('All inventory functions verified successfully!');
    process.exit(0);
  } else {
    console.error('Some tests did not execute.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
