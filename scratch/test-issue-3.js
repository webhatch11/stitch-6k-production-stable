'use strict';

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || '';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const BASE_URL = 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}
if (!razorpaySecret) {
  console.error('ERROR: RAZORPAY_KEY_SECRET missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function signVerify(razorpayOrderId, razorpayPaymentId) {
  return crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

function signWebhook(payloadStr) {
  if (!webhookSecret) return null;
  return crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadStr)
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

async function postWebhook(payload) {
  const bodyStr = JSON.stringify(payload);
  const signature = signWebhook(bodyStr);
  
  const headers = { 'Content-Type': 'application/json' };
  if (signature) {
    headers['x-razorpay-signature'] = signature;
  }
  
  const res = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
    method: 'POST',
    headers,
    body: bodyStr,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function insertOrder(id, razorpayOrderId, total, status = 'PAYMENT_PENDING', extra = {}) {
  const { error } = await supabase.from('orders').insert({
    id,
    customer: `Test Customer [${id}]`,
    date: '20 Jun 2026',
    total,
    original_total: total,
    status,
    payment_status: status,
    razorpay_order_id: razorpayOrderId,
    items: ['Test Item'],
    cart_items: [],
    idempotency_key: `idem-${id}`,
    ...extra,
  });
  if (error) throw new Error(`insertOrder(${id}) failed: ${error.message}`);
}

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

async function cleanup(orderIds) {
  for (const id of orderIds) {
    if (!id) continue;
    await supabase.from('inventory_reservations').delete().eq('session_id', `idem-${id}`);
    await supabase.from('payment_audit_logs').delete().eq('order_id', id);
    await supabase.from('order_events').delete().eq('order_id', id);
    await supabase.from('payment_logs').delete().eq('metadata->>razorpay_order_id', `rzp_test_ORDER_${id}`);
    await supabase.from('payments').delete().eq('order_id', id);
    await supabase.from('orders').delete().eq('id', id);
  }
}

// ---------------------------------------------------------------------------
// TEST 1 — Verify called twice for same payment
// ---------------------------------------------------------------------------
async function test1() {
  console.log('--- TEST 1: Verify called twice for same payment ---');
  const id = `T3-T1-${Date.now()}`;
  const rzpOrderId = `rzp_test_ORDER_${id}`;
  const rzpPaymentId = `rzp_test_PAY_${id}`;
  const signature = signVerify(rzpOrderId, rzpPaymentId);

  try {
    await insertOrder(id, rzpOrderId, 1000);
    await insertPayment(id, rzpOrderId, 1000);

    // Call 1
    console.log('Sending first verify POST...');
    const r1 = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderId,
      razorpay_signature: signature,
      checkoutState: {},
    });
    assert(r1.status === 200, `Call 1 expected HTTP 200, got ${r1.status}`);
    assert(r1.json.success === true, `Call 1 expected success=true, got ${JSON.stringify(r1.json)}`);

    // Call 2
    console.log('Sending second verify POST (duplicate)...');
    const r2 = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderId,
      razorpay_signature: signature,
      checkoutState: {},
    });
    assert(r2.status === 200, `Call 2 expected HTTP 200, got ${r2.status}`);
    assert(r2.json.success === true, `Call 2 expected success=true, got ${JSON.stringify(r2.json)}`);
    assert(r2.json.message === 'Order already processed', `Expected message='Order already processed', got: ${r2.json.message}`);

    // Query DB assertions
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    assert(order.status === 'PAID', `Expected order.status='PAID', got '${order.status}'`);
    assert(order.points_earned === 100, `Expected points_earned=100, got ${order.points_earned}`);

    const { data: payment } = await supabase.from('payments').select('*').eq('order_id', id).single();
    assert(payment.status === 'CAPTURED', `Expected payment.status='CAPTURED', got '${payment.status}'`);

    const { data: auditLogs, error: auditErr } = await supabase.from('payment_audit_logs').select('*').eq('order_id', id);
    if (auditErr) throw new Error(`Query payment_audit_logs failed: ${auditErr.message}`);
    assert(auditLogs.length === 1, `Expected exactly 1 audit log, got ${auditLogs.length}`);

    const { data: events, error: eventErr } = await supabase.from('order_events').select('*').eq('order_id', id).eq('event', 'Payment Successful');
    if (eventErr) throw new Error(`Query order_events failed: ${eventErr.message}`);
    assert(events.length === 1, `Expected exactly 1 'Payment Successful' event, got ${events.length}`);

    console.log('✅ TEST 1 PASSED');
    return { pass: true };
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([id]);
  }
}

// ---------------------------------------------------------------------------
// TEST 2 — Webhook called first, then verify
// ---------------------------------------------------------------------------
async function test2() {
  console.log('\n--- TEST 2: Webhook called first, then verify ---');
  const id = `T3-T2-${Date.now()}`;
  const rzpOrderId = `rzp_test_ORDER_${id}`;
  const rzpPaymentId = `rzp_test_PAY_${id}`;
  const signature = signVerify(rzpOrderId, rzpPaymentId);

  try {
    await insertOrder(id, rzpOrderId, 1000);
    await insertPayment(id, rzpOrderId, 1000);

    // POST to webhook
    console.log('Simulating webhook call...');
    const rWebhook = await postWebhook({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId,
            order_id: rzpOrderId,
          }
        }
      }
    });
    assert(rWebhook.status === 200, `Webhook expected HTTP 200, got ${rWebhook.status}`);

    // Verify order is PAID after webhook
    const { data: orderAfterWebhook } = await supabase.from('orders').select('*').eq('id', id).single();
    assert(orderAfterWebhook.status === 'PAID', `Expected status='PAID' after webhook, got '${orderAfterWebhook.status}'`);

    // POST to verify
    console.log('Sending verify POST after webhook...');
    const rVerify = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderId,
      razorpay_signature: signature,
      checkoutState: {},
    });
    assert(rVerify.status === 200, `Verify expected HTTP 200, got ${rVerify.status}`);
    assert(rVerify.json.success === true, `Verify expected success=true, got ${JSON.stringify(rVerify.json)}`);
    assert(rVerify.json.message === 'Order already processed', `Expected message='Order already processed', got: ${rVerify.json.message}`);

    // Query DB assertions
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    assert(order.points_earned === 100, `Expected points_earned=100, got ${order.points_earned}`);

    const { data: auditLogs, error: auditErr } = await supabase.from('payment_audit_logs').select('*').eq('order_id', id);
    if (auditErr) throw new Error(`Query payment_audit_logs failed: ${auditErr.message}`);
    assert(auditLogs.length === 1, `Expected exactly 1 audit log (from webhook), got ${auditLogs.length}`);

    console.log('✅ TEST 2 PASSED');
    return { pass: true };
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([id]);
  }
}

// ---------------------------------------------------------------------------
// TEST 3 — Concurrent verify + webhook (race condition test)
// ---------------------------------------------------------------------------
async function test3() {
  console.log('\n--- TEST 3: Concurrent verify + webhook (race condition) ---');
  const id = `T3-T3-${Date.now()}`;
  const rzpOrderId = `rzp_test_ORDER_${id}`;
  const rzpPaymentId = `rzp_test_PAY_${id}`;
  const signature = signVerify(rzpOrderId, rzpPaymentId);

  try {
    await insertOrder(id, rzpOrderId, 1000);
    await insertPayment(id, rzpOrderId, 1000);

    console.log('Firing verify and webhook requests simultaneously...');
    const promises = [
      postVerify({
        razorpay_payment_id: rzpPaymentId,
        razorpay_order_id: rzpOrderId,
        razorpay_signature: signature,
        checkoutState: {},
      }),
      postWebhook({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: rzpPaymentId,
              order_id: rzpOrderId,
            }
          }
        }
      })
    ];

    const [verifyRes, webhookRes] = await Promise.all(promises);
    console.log('Verify Response Status:', verifyRes.status);
    console.log('Webhook Response Status:', webhookRes.status);

    assert(verifyRes.status === 200, `Verify expected 200, got ${verifyRes.status}`);
    assert(webhookRes.status === 200, `Webhook expected 200, got ${webhookRes.status}`);

    // Query DB assertions
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    assert(order.status === 'PAID', `Expected order.status='PAID', got '${order.status}'`);
    assert(order.points_earned === 100, `Expected points_earned=100, got ${order.points_earned}`);

    const { data: auditLogs, error: auditErr } = await supabase.from('payment_audit_logs').select('*').eq('order_id', id);
    if (auditErr) throw new Error(`Query payment_audit_logs failed: ${auditErr.message}`);
    assert(auditLogs.length === 1, `Expected exactly 1 audit log, got ${auditLogs.length}`);

    const { data: events, error: eventErr } = await supabase.from('order_events').select('*').eq('order_id', id).eq('event', 'Payment Successful');
    if (eventErr) throw new Error(`Query order_events failed: ${eventErr.message}`);
    assert(events.length === 1, `Expected exactly 1 'Payment Successful' event, got ${events.length}`);

    console.log('✅ TEST 3 PASSED');
    return { pass: true };
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([id]);
  }
}

// ---------------------------------------------------------------------------
// TEST 4 — Verify with status=FAILED order
// ---------------------------------------------------------------------------
async function test4() {
  console.log('\n--- TEST 4: Verify with status=FAILED order ---');
  const id = `T3-T4-${Date.now()}`;
  const rzpOrderId = `rzp_test_ORDER_${id}`;
  const rzpPaymentId = `rzp_test_PAY_${id}`;
  const signature = signVerify(rzpOrderId, rzpPaymentId);

  try {
    await insertOrder(id, rzpOrderId, 1000, 'FAILED');
    await insertPayment(id, rzpOrderId, 1000);

    console.log('Sending verify POST for a FAILED order...');
    const r = await postVerify({
      razorpay_payment_id: rzpPaymentId,
      razorpay_order_id: rzpOrderId,
      razorpay_signature: signature,
      checkoutState: {},
    });

    console.log('Response Status:', r.status);
    console.log('Response Body:', JSON.stringify(r.json));

    assert(r.status === 400, `Expected HTTP 400, got ${r.status}`);
    assert(r.json.success === false, 'Expected success=false');
    assert(r.json.error === 'Order in failed state, cannot reprocess', `Expected error message, got: ${r.json.error}`);

    console.log('✅ TEST 4 PASSED');
    return { pass: true };
  } catch (err) {
    console.error('❌ TEST 4 FAILED:', err.message);
    return { pass: false, reason: err.message };
  } finally {
    await cleanup([id]);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function runAll() {
  console.log('=== Issue #3 Idempotency Fix — E2E Tests ===\n');
  
  const suite = [
    { name: 'TEST 1 — Verify called twice for same payment', fn: test1 },
    { name: 'TEST 2 — Webhook called first, then verify', fn: test2 },
    { name: 'TEST 3 — Concurrent verify + webhook (race condition)', fn: test3 },
    { name: 'TEST 4 — Verify with status=FAILED order', fn: test4 },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of suite) {
    const result = await t.fn();
    if (result.pass) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n=== Idempotency Test Suite Complete: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch((err) => {
  console.error('Unexpected fatal error:', err);
  process.exit(1);
});
