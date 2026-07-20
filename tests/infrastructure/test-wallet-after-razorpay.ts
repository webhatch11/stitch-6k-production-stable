// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWalletAfterRazorpayFlow() {
  console.log("🚀 Running integration test for Wallet checkout after Razorpay dismissal...");

  // Fetch real product variant from DB to pass validation
  const { data: variants } = await supabase
    .from("product_variants")
    .select("product_id, size, color")
    .gt("stock", 0)
    .limit(1);

  if (!variants || variants.length === 0) {
    console.warn("⚠️ [Skip Test] No product variants found in DB.");
    return;
  }

  const realVariant = variants[0];
  console.log(`Using real variant: productId=${realVariant.product_id}, size=${realVariant.size}, color=${realVariant.color}`);

  const testIdempotencyKey = `test-idem-rzp-wallet-${Date.now()}`;
  const testOrderId = `6K-TEST-${Math.floor(Math.random() * 900000 + 100000)}`;

  // 1. Simulate initial Razorpay attempt: Create order in Payment Pending status
  console.log(`\nStep 1: Creating initial Razorpay order (${testOrderId}) with status 'Payment Pending'...`);
  const { data: createdOrder, error: createError } = await supabase
    .from("orders")
    .insert({
      id: testOrderId,
      idempotency_key: testIdempotencyKey,
      customer: "Automated QA Test",
      date: new Date().toLocaleDateString("en-IN"),
      total: 100,
      original_total: 100,
      status: "Payment Pending",
      payment_status: "Payment Pending",
      wallet_paid: 0,
      gateway_paid: 100,
      cart_items: [{
        productId: realVariant.product_id,
        productName: "Test Product",
        price: 100,
        quantity: 1,
        size: realVariant.size,
        color: realVariant.color || "Default"
      }]
    })
    .select()
    .single();

  if (createError) {
    console.error("❌ Failed to create test pending order:", createError.message);
    return;
  }

  console.log(`✓ Order created successfully with idempotencyKey: ${testIdempotencyKey}`);

  // 2. Simulate User closing Razorpay widget and switching to Wallet payment
  console.log("\nStep 2: Simulating User switching to Wallet payment on the SAME idempotencyKey...");
  
  // Call the atomic transaction RPC directly as processWalletPointsCheckoutAction does on targetOrderId
  const { data: txData, error: txError } = await supabase.rpc("confirm_order_and_process_payments_atomic", {
    p_order_id: testOrderId,
    p_payment_id: `wallet-${testOrderId}`,
    p_wallet_deduction: 0,
    p_points_redeemed: 0,
    p_coupon_code: "",
    p_earned_points: 5,
    p_method: "wallet"
  });

  if (txError) {
    console.error("❌ RPC Execution Error:", txError.message);
    await supabase.from("orders").delete().eq("id", testOrderId);
    return;
  }

  console.log("RPC Output:", JSON.stringify(txData));

  // 3. Verify Database Status
  console.log("\nStep 3: Verifying final Order status in Database...");
  const { data: finalOrder } = await supabase
    .from("orders")
    .select("id, status, payment_status, wallet_paid")
    .eq("id", testOrderId)
    .single();

  console.log("Final Database Record:", finalOrder);

  if (finalOrder && finalOrder.status === "Paid via Wallet" && finalOrder.payment_status === "Paid") {
    console.log("\n==================================================");
    console.log("🎉 SUCCESS: Pending Razorpay Order successfully converted to 'Paid via Wallet'!");
    console.log("==================================================");
  } else {
    console.error("❌ FAILED: Order status was not updated properly.");
  }

  // Cleanup test order
  await supabase.from("orders").delete().eq("id", testOrderId);
  console.log("\n✓ Cleaned up test order record.");
}

testWalletAfterRazorpayFlow().catch((err) => {
  console.error("Integration test crashed:", err);
});
