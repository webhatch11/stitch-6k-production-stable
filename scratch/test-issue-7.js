'use strict';

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

if (!webhookSecret) {
  console.error('ERROR: RAZORPAY_WEBHOOK_SECRET is not configured in .env.local');
  process.exit(1);
}

const totalTests = 3;

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
  console.log('=== Starting Issue #7 Webhook Signature Hardening Tests ===');
  console.log(`Using RAZORPAY_WEBHOOK_SECRET = "${webhookSecret}"`);

  let passedTestsCount = 0;

  try {
    // TEST 1 — Webhook with NO signature header is rejected
    await runTest(1, 'Webhook with NO signature header is rejected', async () => {
      const body = { event: 'payment.captured', payload: {} };
      const response = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const resBody = await response.json();
      assert(response.status === 400, `Expected HTTP status 400, got ${response.status}`);
      assert(
        resBody.error && resBody.error.includes('Missing signature header'),
        `Expected error to include 'Missing signature header', got: ${JSON.stringify(resBody)}`
      );
    });
    passedTestsCount++;

    // TEST 2 — Webhook with WRONG signature is rejected
    await runTest(2, 'Webhook with WRONG signature is rejected', async () => {
      const body = { event: 'payment.captured', payload: {} };
      const response = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'invalid_signature_value',
        },
        body: JSON.stringify(body),
      });

      const resBody = await response.json();
      assert(response.status === 401, `Expected HTTP status 401, got ${response.status}`);
      assert(
        resBody.error && resBody.error.includes('Invalid signature'),
        `Expected error to include 'Invalid signature', got: ${JSON.stringify(resBody)}`
      );
    });
    passedTestsCount++;

    // TEST 3 — Webhook with VALID signature is accepted
    await runTest(3, 'Webhook with VALID signature is accepted', async () => {
      const bodyStr = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_x',
              order_id: 'order_test_y',
            },
          },
        },
      });

      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyStr)
        .digest('hex');

      const response = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': validSignature,
        },
        body: bodyStr,
      });

      const resBody = await response.json();
      
      // Expected HTTP status is 200, but can be success: true, message: "No order ID present" or similar
      // since the inner order lookup fails to find order_test_y
      assert(response.status === 200, `Expected HTTP status 200, got ${response.status}`);
      assert(
        resBody.success === true,
        `Expected response success to be true, got: ${JSON.stringify(resBody)}`
      );
    });
    passedTestsCount++;

  } catch (err) {
    console.error('\n!!! WEBHOOK HARDENING TEST FAILED !!!');
    process.exit(1);
  }

  console.log(`\n=== Issue #7 Webhook Hardening Test Summary: ${passedTestsCount}/${totalTests} Passed ===`);
  if (passedTestsCount === totalTests) {
    console.log('Webhook signature verification verified successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
