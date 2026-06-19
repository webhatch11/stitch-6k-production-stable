import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  // @deprecated — accepted for client backward-compat but never used for side effects
  checkoutState: z.any()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid verification payload" }, { status: 400 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = parsed.data;

    // Fetch authoritative order from DB using the Razorpay order ID supplied by
    // the payment gateway. All side effects below use only this row — never
    // client-supplied checkoutState — to prevent forged payload attacks.
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
    }

    const { data: dbOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (orderFetchError || !dbOrder) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Defense in depth: assert the row we loaded is the one we asked for.
    if (dbOrder.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json({ success: false, error: "Order ID mismatch" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "";

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await supabase.from("payment_logs").insert({
        payment_id: null,
        previous_status: "PAYMENT_PENDING",
        new_status: "FAILED_SIGNATURE",
        metadata: { razorpay_payment_id, razorpay_order_id }
      });

      await supabase.from("orders").update({
        payment_status: "FAILED",
        status: "FAILED"
      }).eq("id", dbOrder.id);

      await db.saveOrder({ id: dbOrder.id, status: "FAILED" });
      await db.releaseReservation(dbOrder.idempotency_key);
      await db.createOrderEvent(dbOrder.id, "Payment Failed");

      return NextResponse.json({ success: false, error: "Payment verification failed: Invalid signature" }, { status: 400 });
    }

    // Payment is legitimately successful.
    // All values sourced exclusively from dbOrder (DB row), never from client input.

    // 0. Deduct inventory variant stock and fulfill reservation
    await db.deductStock(dbOrder.cart_items || [], dbOrder.idempotency_key);

    // 1. Complete the logic (Wallet/Loyalty/Coupons)

    // Increment coupon usage
    if (dbOrder.coupon_code) {
      await db.incrementCouponUsage(dbOrder.coupon_code);
    }

    // Debit wallet if used
    if (dbOrder.wallet_paid > 0) {
      await db.applyWalletDebit(dbOrder.wallet_paid, dbOrder.id, dbOrder.user_id);
    }

    // Debit points if used
    if (dbOrder.points_redeemed > 0) {
      await db.applyLoyaltyDebit(dbOrder.points_redeemed, dbOrder.id, dbOrder.user_id);
    }

    // Award new points
    const earned = Math.floor(dbOrder.total / 10);
    if (earned > 0) {
      await db.awardLoyaltyPoints(dbOrder.total, dbOrder.id, dbOrder.user_id);
    }

    // Update order status to PAID
    await db.saveOrder({
      id: dbOrder.id,
      status: "PAID",
      pointsEarned: earned
    });

    // Write audit log and events
    await db.createPaymentAuditLog(dbOrder.id, "PAYMENT_PENDING", "PAID", "verify_route");
    await db.createOrderEvent(dbOrder.id, "Payment Successful");

    await supabase.from("orders").update({
      payment_status: "PAID",
      status: "PAID",
      points_earned: earned
    }).eq("id", dbOrder.id);

    // Find the payment record
    const { data: payment } = await supabase.from("payments").select("id").eq("order_id", dbOrder.id).single();

    if (payment) {
      await supabase.from("payments").update({
        razorpay_payment_id,
        status: "CAPTURED"
      }).eq("id", payment.id);

      await supabase.from("payment_logs").insert({
        payment_id: payment.id,
        previous_status: "CREATED",
        new_status: "CAPTURED",
        metadata: { razorpay_payment_id, razorpay_signature }
      });
    }

    // Trigger Shiprocket fulfillment creation
    await db.dispatchFulfillment(dbOrder.id);

    return NextResponse.json({ success: true, message: "Payment verified successfully" });

  } catch (error: any) {
    console.error("Payment Verification Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
