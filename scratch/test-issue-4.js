'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

// 1. serviceClient — uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS, used for test setup/teardown only)
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 2. anonClient — uses NEXT_PUBLIC_SUPABASE_ANON_KEY (no auth)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 3. userClient — uses NEXT_PUBLIC_SUPABASE_ANON_KEY but signed in as a specific test user
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const totalTests = 10;

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
    throw err; // Stop testing if any test fails
  }
}

async function main() {
  console.log('=== Starting Issue #4 RLS Security Policy Verification ===');

  let userAId = null;
  let userBId = null;

  // SETUP: Pre-clean in case of dirty database
  console.log('\n[SETUP] Pre-cleaning test data...');
  try {
    // Delete orders
    await serviceClient.from('orders').delete().in('id', ['RLS-TEST-A1', 'RLS-TEST-B1']);
    // Delete product
    await serviceClient.from('products').delete().eq('id', 'RLS-TEST-P1');

    // List and delete existing test users
    const { data: { users }, error: listErr } = await serviceClient.auth.admin.listUsers();
    if (!listErr && users) {
      for (const u of users) {
        if (u.email === 'rls-test-a@example.com' || u.email === 'rls-test-b@example.com') {
          console.log(`[SETUP] Deleting existing test user: ${u.email} (${u.id})`);
          await serviceClient.auth.admin.deleteUser(u.id);
        }
      }
    }
  } catch (err) {
    console.warn(`[SETUP] Non-fatal warning during pre-clean: ${err.message}`);
  }

  // SETUP: Create test users and insert records
  console.log('\n[SETUP] Creating test users and inserting mock records...');

  // Create userA
  const { data: userAData, error: userAErr } = await serviceClient.auth.admin.createUser({
    email: 'rls-test-a@example.com',
    password: 'TestPass123!',
    email_confirm: true,
    user_metadata: { name: 'Alice' }
  });
  if (userAErr) throw new Error(`Failed to create userA: ${userAErr.message}`);
  userAId = userAData.user.id;
  console.log(`Created UserA: ${userAId}`);

  // Create userB
  const { data: userBData, error: userBErr } = await serviceClient.auth.admin.createUser({
    email: 'rls-test-b@example.com',
    password: 'TestPass123!',
    email_confirm: true,
    user_metadata: { name: 'Bob' }
  });
  if (userBErr) throw new Error(`Failed to create userB: ${userBErr.message}`);
  userBId = userBData.user.id;
  console.log(`Created UserB: ${userBId}`);

  // Wait a small buffer for triggers to complete if necessary
  await new Promise(resolve => setTimeout(resolve, 500));

  // Update profiles wallet_balance
  console.log('[SETUP] Updating profiles to set exact wallet_balance...');
  const { error: profileAUpdateErr } = await serviceClient
    .from('profiles')
    .update({ wallet_balance: 1000 })
    .eq('id', userAId);
  if (profileAUpdateErr) throw new Error(`Failed to set wallet_balance for userA: ${profileAUpdateErr.message}`);

  const { error: profileBUpdateErr } = await serviceClient
    .from('profiles')
    .update({ wallet_balance: 500 })
    .eq('id', userBId);
  if (profileBUpdateErr) throw new Error(`Failed to set wallet_balance for userB: ${profileBUpdateErr.message}`);

  // Insert orders
  console.log('[SETUP] Inserting orders...');
  const { error: orderAInsertErr } = await serviceClient.from('orders').insert({
    id: 'RLS-TEST-A1',
    user_id: userAId,
    customer: 'Alice',
    date: '2026-06-20',
    total: 5000,
    original_total: 5000,
    status: 'PENDING',
    idempotency_key: 'idem-rls-test-a1'
  });
  if (orderAInsertErr) throw new Error(`Failed to insert order A1: ${orderAInsertErr.message}`);

  const { error: orderBInsertErr } = await serviceClient.from('orders').insert({
    id: 'RLS-TEST-B1',
    user_id: userBId,
    customer: 'Bob',
    date: '2026-06-20',
    total: 3000,
    original_total: 3000,
    status: 'PENDING',
    idempotency_key: 'idem-rls-test-b1'
  });
  if (orderBInsertErr) throw new Error(`Failed to insert order B1: ${orderBInsertErr.message}`);

  // Insert product
  console.log('[SETUP] Inserting product...');
  const { error: prodInsertErr } = await serviceClient.from('products').insert({
    id: 'RLS-TEST-P1',
    slug: 'rls-test-p1',
    title: 'Test Product 1',
    price: 1000,
    category: 'Test Category',
    stock: 10
  });
  if (prodInsertErr) throw new Error(`Failed to insert product P1: ${prodInsertErr.message}`);

  console.log('[SETUP] Setup completed successfully.');

  let passedTestsCount = 0;

  try {
    // TEST 1 — Anonymous CANNOT read profiles
    await runTest(1, 'Anonymous CANNOT read profiles', async () => {
      const { data, error } = await anonClient.from('profiles').select('*');
      assert(!data || data.length === 0, 'Anonymous query returned profile rows.');
    });
    passedTestsCount++;

    // TEST 2 — Anonymous CANNOT read orders
    await runTest(2, 'Anonymous CANNOT read orders', async () => {
      const { data, error } = await anonClient.from('orders').select('*');
      assert(!data || data.length === 0, 'Anonymous query returned order rows.');
    });
    passedTestsCount++;

    // TEST 3 — Anonymous CAN read products
    await runTest(3, 'Anonymous CAN read products', async () => {
      const { data, error } = await anonClient.from('products').select('*');
      assert(!error, `Products query failed: ${error?.message}`);
      assert(data && data.some(p => p.id === 'RLS-TEST-P1'), 'Anonymous could not find product RLS-TEST-P1.');
    });
    passedTestsCount++;

    // Authenticate userClient for subsequent tests
    console.log('\nAuthenticating userClient as userA...');
    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: 'rls-test-a@example.com',
      password: 'TestPass123!',
    });
    if (signInErr) throw new Error(`UserA sign in failed: ${signInErr.message}`);
    console.log('userClient authenticated.');

    // TEST 4 — UserA signs in and reads OWN profile
    await runTest(4, 'UserA signs in and reads OWN profile', async () => {
      const { data, error } = await userClient.from('profiles').select('*');
      assert(!error, `Failed to query profiles: ${error?.message}`);
      assert(data && data.length === 1, `Expected exactly 1 profile row, got ${data?.length}`);
      assert(data[0].name === 'Alice', `Expected name to be "Alice", got "${data[0].name}"`);
    });
    passedTestsCount++;

    // TEST 5 — UserA CANNOT read UserB's profile
    await runTest(5, "UserA CANNOT read UserB's profile", async () => {
      const { data, error } = await userClient.from('profiles').select('*').eq('id', userBId);
      assert(!error, `Query failed: ${error?.message}`);
      assert(!data || data.length === 0, 'UserA successfully read UserB\'s profile.');
    });
    passedTestsCount++;

    // TEST 6 — UserA CAN read OWN orders
    await runTest(6, 'UserA CAN read OWN orders', async () => {
      const { data, error } = await userClient.from('orders').select('*');
      assert(!error, `Query failed: ${error?.message}`);
      const hasA1 = data && data.some(o => o.id === 'RLS-TEST-A1');
      const hasB1 = data && data.some(o => o.id === 'RLS-TEST-B1');
      assert(hasA1, 'UserA order RLS-TEST-A1 is missing.');
      assert(!hasB1, 'UserB order RLS-TEST-B1 is incorrectly visible to UserA.');
    });
    passedTestsCount++;

    // TEST 7 — UserA CANNOT update their own wallet_balance directly
    await runTest(7, 'UserA CANNOT update their own wallet_balance directly', async () => {
      const { error: updateErr } = await userClient
        .from('profiles')
        .update({ wallet_balance: 999999 })
        .eq('id', userAId);
      
      if (updateErr) {
        console.log(`(Received expected update error: ${updateErr.message})`);
      }

      // Re-query balance
      const { data: balanceData, error: queryErr } = await userClient
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userAId)
        .single();
      
      assert(!queryErr, `Querying balance failed: ${queryErr?.message}`);
      assert(
        Number(balanceData.wallet_balance) === 1000,
        `wallet_balance was modified! Expected 1000, got ${balanceData.wallet_balance}`
      );
    });
    passedTestsCount++;

    // TEST 8 — UserA CANNOT update their own role to admin
    await runTest(8, 'UserA CANNOT update their own role to admin', async () => {
      const { error: roleUpdateErr } = await userClient
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userAId);
      
      if (roleUpdateErr) {
        console.log(`(Received expected role update error: ${roleUpdateErr.message})`);
      }

      // Re-query role
      const { data: roleData, error: roleQueryErr } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', userAId)
        .single();
      
      assert(!roleQueryErr, `Querying role failed: ${roleQueryErr?.message}`);
      assert(roleData.role !== 'admin', 'role was successfully modified to admin!');
    });
    passedTestsCount++;

    // TEST 9 — UserA CANNOT read coupons (SERVICE-ONLY)
    await runTest(9, 'UserA CANNOT read coupons (SERVICE-ONLY)', async () => {
      const { data, error } = await userClient.from('coupons').select('*');
      assert(!data || data.length === 0, 'UserA read coupons successfully.');
    });
    passedTestsCount++;

    // TEST 10 — Service role CAN read everything
    await runTest(10, 'Service role CAN read everything', async () => {
      const { data, error } = await serviceClient.from('orders').select('*');
      assert(!error, `Service query failed: ${error?.message}`);
      const hasA1 = data && data.some(o => o.id === 'RLS-TEST-A1');
      const hasB1 = data && data.some(o => o.id === 'RLS-TEST-B1');
      assert(hasA1 && hasB1, 'Service role is missing access to one or both orders.');
    });
    passedTestsCount++;

  } catch (err) {
    console.error('\n!!! SECURITY TEST FAILED !!!');
    console.error('Skipping cleanup so database remains in failed state for investigation.');
    process.exit(1);
  }

  // CLEANUP
  console.log('\n[CLEANUP] Cleaning up test data...');
  try {
    // Delete orders
    const { error: cleanOrdersErr } = await serviceClient.from('orders').delete().in('id', ['RLS-TEST-A1', 'RLS-TEST-B1']);
    if (cleanOrdersErr) console.error(`Error deleting orders: ${cleanOrdersErr.message}`);

    // Delete product
    const { error: cleanProdErr } = await serviceClient.from('products').delete().eq('id', 'RLS-TEST-P1');
    if (cleanProdErr) console.error(`Error deleting product: ${cleanProdErr.message}`);

    // Delete test users
    const { error: cleanUserAErr } = await serviceClient.auth.admin.deleteUser(userAId);
    if (cleanUserAErr) console.error(`Error deleting userA: ${cleanUserAErr.message}`);

    const { error: cleanUserBErr } = await serviceClient.auth.admin.deleteUser(userBId);
    if (cleanUserBErr) console.error(`Error deleting userB: ${cleanUserBErr.message}`);

    console.log('[CLEANUP] Cleaned up test data.');
  } catch (cleanupErr) {
    console.error(`[CLEANUP] Cleanup failed: ${cleanupErr.message}`);
  }

  console.log(`\n=== Issue #4 Security Test Summary: ${passedTestsCount}/${totalTests} Passed ===`);
  if (passedTestsCount === totalTests) {
    console.log('All RLS policies verified successfully!');
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
