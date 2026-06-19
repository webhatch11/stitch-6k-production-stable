'use strict';

/**
 * End-to-end tests for Issue #1 security fix:
 * /api/payments/verify must use DB row values, never client-supplied checkoutState.
 *
 * Prerequisites:
 *   - Next.js dev server running at http://localhost:3000
 *   - .env.local present with SUPABASE_SERVICE_ROLE_KEY and RAZORPAY_KEY_SECRET
 *
 * Run: node scratch/test-issue-1.js
 */

const path = require('path');
const crypto = require('crypto');

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

// Strip trailing /rest/v1/ that is present in NEXT_PUBLIC_SUPABASE_URL
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || '';
const BASE_URL = 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}
if (!razorpaySecret) {
  console.error('ERROR: RAZORPAY_KEY_SECRET missing in .env.local');
  process.exit(1);
}

// Service-role client bypasses RLS for test setup/teardown
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sign(razorpayOrderId, razorpayPaymentId) {
  return crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postVerify(body) {
  const res = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

/** Insert a minimal PAYMENT_PENDING order for testing. */
async function insertOrder(id, razorpayOrderId, total, extra = {}) {
  const { error } = await supabase.from('orders').insert({
    id,
    customer: `Test Customer [${id}]`,
    date: '19 Jun 2026',
    total,
    original_total: total,
    status: 'PAYMENT_PENDING',
    payment_status: 'PAYMENT_PENDING',
    razorpay_order_id: razorpayOrderId,
    items: ['Test Shirt'],
    cart_items: [],
    idempotency_key: `idem-${id}`,
    ...extra,
  });
  if (error) throw new Error(`insertOrder(${id}) failed: ${error.message}`);
}

/** Insert a minimal CREATED payment row for an order. */
async function insertPayment(orderId, razorpayOrderId, amount) {
  const { error } = await supabase.from('payments').insert({
    order_id: orderId,
    razorpay_order_id: razorpayOrderId,
    amount,
    currency: 'INR',
    status: 'CREATED',
    method: 'razorpay',
  });
  if (error) throw new Error(`insertPayment(${orderId}) failed: ${error.message}`);
}

/**
 * Cleanup: deleting an order cascades to order_events, payment_audit_logs,
 * shipments (→ shipment_events, tracking_logs), and payments (→ payment_logs).
 * inventory_reservations are keyed by session_id (= idempotency_key here).
 */
async function cleanup(orderIds) {
  for (const id of orderIds) {
    if (!id) continue;
    await supabase.from('inventory_reservations').delete().eq('session_id', `idem-${id}`);
    await supabase.from('orders').delete().eq('id', id);
  }
}

// ---------------------------------------------------------------------------
// TEST 1 — Happy path (legitimate payment)
// ---------------------------------------------------------------------------
async function test1() {
  const orderId = `TEST-T1-${Date.now()}`;
  const rzpOrderId = `rzp_test_ORDER_T1_${Date.now()}`;
  const rzpPaymentId = `rzp_test_PAY_T1_${Date.now()}`;

  try {
    await insertOrder(orderId, rzpOrderId, 1000);
    await insertPayment(orderId, rzpOrderId, 1000);

    const { status, json } = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderId,
      razorpay_signature: sign(rzpOrderId, rzpPaymentId),
      checkoutState: {}, // deliberately empty — must be ignored
    });

    assert(status === 200, `Expected HTTP 200, got ${status}`);
    assert(json.success === true, `Expected success=true, body=${JSON.stringify(json)}`);

    const { data: order } = await supabase
      .from('orders')
      .select('status, payment_status, points_earned')
      .eq('id', orderId)
      .single();

    assert(order.status === 'PAID', `order.status should be PAID, got ${order.status}`);
    assert(order.payment_status === 'PAID', `payment_status should be PAID, got ${order.payment_status}`);
    assert(
      order.points_earned === 100,
      `points_earned should be 100 (floor(1000/10)), got ${order.points_earned}`,
    );

    const { data: payment } = await supabase
      .from('payments')
      .select('status, razorpay_payment_id')
      .eq('order_id', orderId)
      .single();

    assert(payment.status === 'CAPTURED', `payment.status should be CAPTURED, got ${payment.status}`);
    assert(
      payment.razorpay_payment_id === rzpPaymentId,
      `razorpay_payment_id not saved, got ${payment.razorpay_payment_id}`,
    );

    return { pass: true };
  } catch (err) {
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([orderId]);
  }
}

// ---------------------------------------------------------------------------
// TEST 2 — Forged orderId attack
// Attacker has a valid payment for orderA, but sends checkoutState.orderId
// pointing at orderB (a different victim order). After the fix, the route must
// look up by razorpay_order_id and mark orderA PAID — orderB must be untouched.
// ---------------------------------------------------------------------------
async function test2() {
  const orderAId = `TEST-T2A-${Date.now()}`;
  const orderBId = `TEST-T2B-${Date.now()}`;
  const rzpOrderIdA = `rzp_test_ORDER_T2A_${Date.now()}`;
  const rzpOrderIdB = `rzp_test_ORDER_T2B_${Date.now()}`;
  const rzpPaymentId = `rzp_test_PAY_T2_${Date.now()}`;

  try {
    await insertOrder(orderAId, rzpOrderIdA, 500);
    await insertOrder(orderBId, rzpOrderIdB, 9999);
    await insertPayment(orderAId, rzpOrderIdA, 500);

    // Signature is valid for orderA's razorpay_order_id
    const { status, json } = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderIdA,
      razorpay_signature: sign(rzpOrderIdA, rzpPaymentId),
      // Attack vector: claim this payment belongs to the victim order (orderB)
      checkoutState: {
        orderId: orderBId,
        idempotencyKey: `idem-${orderBId}`,
      },
    });

    assert(status === 200, `Expected HTTP 200 for the legitimate orderA payment, got ${status}`);
    assert(json.success === true, `Expected success=true, body=${JSON.stringify(json)}`);

    // orderA must be PAID (the legitimate outcome)
    const { data: orderA } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderAId)
      .single();
    assert(orderA.status === 'PAID', `orderA.status should be PAID, got ${orderA.status}`);

    // orderB must still be PAYMENT_PENDING (attack was blocked by the fix)
    const { data: orderB } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderBId)
      .single();
    assert(
      orderB.status === 'PAYMENT_PENDING',
      `orderB.status should still be PAYMENT_PENDING (forged orderId attack blocked), got ${orderB.status}`,
    );

    return { pass: true };
  } catch (err) {
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([orderAId, orderBId]);
  }
}

// ---------------------------------------------------------------------------
// TEST 3 — Forged netTotal attack (loyalty point farming)
// Attacker inflates checkoutState.netTotal to earn massive loyalty points.
// After the fix, points must be based on dbOrder.total, not checkoutState.netTotal.
// ---------------------------------------------------------------------------
async function test3() {
  const orderId = `TEST-T3-${Date.now()}`;
  const rzpOrderId = `rzp_test_ORDER_T3_${Date.now()}`;
  const rzpPaymentId = `rzp_test_PAY_T3_${Date.now()}`;

  try {
    // DB total is 1000 → legitimate points_earned = floor(1000/10) = 100
    await insertOrder(orderId, rzpOrderId, 1000);
    await insertPayment(orderId, rzpOrderId, 1000);

    const { status, json } = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderId,
      razorpay_signature: sign(rzpOrderId, rzpPaymentId),
      // Attack vector: inflate netTotal to farm 99,999 loyalty points
      checkoutState: {
        netTotal: 999999,
        orderId,
      },
    });

    assert(status === 200, `Expected HTTP 200, got ${status}`);
    assert(json.success === true, `Expected success=true, body=${JSON.stringify(json)}`);

    const { data: order } = await supabase
      .from('orders')
      .select('points_earned')
      .eq('id', orderId)
      .single();

    // Must be 100 (from DB total=1000), not 99999 (from forged checkoutState.netTotal)
    assert(
      order.points_earned === 100,
      `points_earned should be 100 (DB total 1000 ÷ 10), got ${order.points_earned}` +
        ` — forged netTotal=999999 was NOT blocked`,
    );

    return { pass: true };
  } catch (err) {
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([orderId]);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Issue #1 Security Fix — End-to-End Tests ===\n');
  console.log(`  Supabase : ${supabaseUrl}`);
  console.log(`  API      : ${BASE_URL}/api/payments/verify`);
  console.log('');

  const suite = [
    { name: 'TEST 1 — Happy path (legitimate payment)', fn: test1 },
    { name: 'TEST 2 — Forged orderId attack', fn: test2 },
    { name: 'TEST 3 — Forged netTotal attack (loyalty point farming)', fn: test3 },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of suite) {
    process.stdout.write(`  ${t.name} ... `);
    const result = await t.fn();
    if (result.pass) {
      console.log('PASS');
      passed++;
    } else {
      console.log(`FAIL\n    Reason: ${result.reason}`);
      failed++;
    }
  }

  console.log('');
  console.log(`=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected fatal error:', err);
  process.exit(1);
});
