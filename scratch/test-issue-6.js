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

// Service client (using service role key)
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const totalTests = 3;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(testLetter, testName, fn) {
  console.log(`\n--- TEST ${testLetter}: ${testName} ---`);
  try {
    await fn();
    console.log(`[PASS] TEST ${testLetter}`);
    return true;
  } catch (err) {
    console.error(`[FAIL] TEST ${testLetter}: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('=== Starting Issue #6 Service Client verification ===');

  let testUserId = null;
  const testEmail = "issue6-test-" + Date.now() + "@example.com";

  // SETUP: Create test user and configure profile
  console.log('\n[SETUP] Creating test user and profile...');
  const { data: userData, error: userErr } = await serviceClient.auth.admin.createUser({
    email: testEmail,
    password: 'TestPass123!',
    email_confirm: true,
  });
  if (userErr) throw new Error(`Failed to create test user: ${userErr.message}`);
  testUserId = userData.user.id;
  console.log(`Created test user: ${testEmail} (${testUserId})`);

  // Wait a small buffer for triggers to execute
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('[SETUP] Updating profile balance and points...');
  const { error: profileErr } = await serviceClient
    .from('profiles')
    .update({ wallet_balance: 5000, loyalty_points: 250 })
    .eq('id', testUserId);
  if (profileErr) throw new Error(`Failed to update profile: ${profileErr.message}`);

  let passedTestsCount = 0;

  try {
    // TEST A — service-role client connects and reads
    await runTest('A', 'service-role client connects and reads', async () => {
      const { data, error } = await serviceClient
        .from('profiles')
        .select('wallet_balance, loyalty_points')
        .eq('id', testUserId)
        .single();
      
      assert(!error, `Failed to read profile: ${error?.message}`);
      assert(Number(data.wallet_balance) === 5000, `Expected wallet_balance to be 5000, got ${data.wallet_balance}`);
      assert(Number(data.loyalty_points) === 250, `Expected loyalty_points to be 250, got ${data.loyalty_points}`);
    });
    passedTestsCount++;

    // TEST B — verify no auth context leak
    await runTest('B', 'verify no auth context leak', async () => {
      const { data, error } = await serviceClient.auth.getUser();
      // Even if error is present, data.user should be null or undefined.
      const user = data ? data.user : null;
      assert(!user, `Auth context leaked! Found user: ${JSON.stringify(user)}`);
    });
    passedTestsCount++;

    // TEST C — service-role bypasses RLS
    await runTest('C', 'service-role bypasses RLS', async () => {
      // service role bypasses RLS and can select any/all profiles
      const { data, error } = await serviceClient
        .from('profiles')
        .select('*')
        .limit(5);
      
      assert(!error, `Failed to query profiles: ${error?.message}`);
      assert(data && data.length > 0, 'No profiles returned (expected rows since service role bypasses RLS).');
    });
    passedTestsCount++;

  } catch (err) {
    console.error('\n!!! ISSUE #6 TEST FAILED !!!');
    console.error('Skipping cleanup so database remains in failed state for investigation.');
    process.exit(1);
  }

  // CLEANUP
  console.log('\n[CLEANUP] Deleting test user...');
  try {
    const { error: cleanErr } = await serviceClient.auth.admin.deleteUser(testUserId);
    if (cleanErr) console.error(`Error deleting test user: ${cleanErr.message}`);
    console.log('[CLEANUP] Cleanup completed successfully.');
  } catch (cleanupErr) {
    console.error(`[CLEANUP] Cleanup failed: ${cleanupErr.message}`);
  }

  console.log(`\n=== Issue #6 Test Summary: ${passedTestsCount}/${totalTests} Passed ===`);
  if (passedTestsCount === totalTests) {
    console.log('All Service Client checks verified successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
