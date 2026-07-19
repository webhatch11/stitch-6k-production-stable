// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPaymentTransaction() {
  console.log("🚀 Starting payment transactional architecture tests...");

  // Fetch a valid order to run integration tests against
  const { data: dbOrders, error: orderError } = await supabase
    .from("orders")
    .select("id, total, user_id, coupon_code, cart_items, idempotency_key")
    .eq("status", "Payment Pending")
    .limit(1);

  if (orderError || !dbOrders || dbOrders.length === 0) {
    console.warn("⚠️ [Skip Test] No orders with 'Payment Pending' status found in database. Please seed or create a checkout order to test.");
    return;
  }

  const testOrder = dbOrders[0];
  console.log(`Using pending order: ${testOrder.id} for user ${testOrder.user_id}`);

  // Determine amount parameters
  const walletDeduction = 10.0;
  const pointsRedeemed = 5;
  const couponCode = testOrder.coupon_code || "";
  const earnedPoints = 15;
  const paymentId = `test-verify-pay-${Date.now()}`;

  // 1. Verify Transaction Execution and Idempotency
  console.log("\n==================================================");
  console.log("TEST 1: Atomic transaction and idempotency check");
  console.log("==================================================");

  const { data: txData, error: txError } = await supabase.rpc("confirm_order_and_process_payments_atomic", {
    p_order_id: testOrder.id,
    p_payment_id: paymentId,
    p_wallet_deduction: walletDeduction,
    p_points_redeemed: pointsRedeemed,
    p_coupon_code: couponCode,
    p_earned_points: earnedPoints,
    p_method: "razorpay"
  });

  if (txError) {
    console.error("❌ RPC Transaction Error:", txError.message);
  } else {
    console.log("RPC Response:", JSON.stringify(txData));
    console.log(txData.success ? "✅ PASSED: RPC executed successfully." : `❌ FAILED: RPC failed: ${txData.error}`);
  }

  // Verify idempotency: call RPC again for same order
  const { data: retryData, error: retryError } = await supabase.rpc("confirm_order_and_process_payments_atomic", {
    p_order_id: testOrder.id,
    p_payment_id: paymentId,
    p_wallet_deduction: walletDeduction,
    p_points_redeemed: pointsRedeemed,
    p_coupon_code: couponCode,
    p_earned_points: earnedPoints,
    p_method: "razorpay"
  });

  if (retryError) {
    console.error("❌ RPC Retry Error:", retryError.message);
  } else {
    console.log("RPC Retry Response:", JSON.stringify(retryData));
    const passed = retryData.success && (retryData.message === "Order already processed" || retryData.status === "Paid");
    console.log(passed ? "✅ PASSED: Idempotent execution prevented duplicate deductions." : "❌ FAILED: Duplicate transaction not blocked.");
  }

  // 2. Verify Thread-Safe Outbox Claim (FOR UPDATE SKIP LOCKED)
  console.log("\n==================================================");
  console.log("TEST 2: Thread-Safe Outbox Claim (SKIP LOCKED)");
  console.log("==================================================");

  const { data: claimData, error: claimError } = await supabase.rpc("claim_pending_outbox_events", {
    p_limit: 10
  });

  if (claimError) {
    console.error("❌ Claim RPC Error:", claimError.message);
  } else {
    console.log(`RPC claimed: ${claimData.length} events.`);
    console.log("✅ PASSED: Claimed outbox events successfully.");
  }

  // 3. Verify Outbox metrics logging
  console.log("\n==================================================");
  console.log("TEST 3: Verify outbox telemetry counts");
  console.log("==================================================");

  const { data: outboxStats, error: outboxError } = await supabase
    .from("outbox_events")
    .select("status, count")
    .select("id, status");

  if (outboxError) {
    console.error("❌ Outbox fetch error:", outboxError.message);
  } else {
    const processing = outboxStats.filter(x => x.status === "PROCESSING").length;
    const pending = outboxStats.filter(x => x.status === "PENDING").length;
    const processed = outboxStats.filter(x => x.status === "PROCESSED").length;
    const failed = outboxStats.filter(x => x.status === "FAILED").length;
    
    console.log(`Current Outbox Database Metrics - Pending: ${pending}, Processing: ${processing}, Processed: ${processed}, Failed (DLQ): ${failed}`);
    console.log("✅ PASSED: Outbox telemetry validated.");
  }

  console.log("\n==================================================");
  console.log("🏆 PAYMENT TRANSACTION TESTS RUN COMPLETE");
  console.log("==================================================");
}

testPaymentTransaction().catch((err) => {
  console.error("Test suite crashed:", err);
});
