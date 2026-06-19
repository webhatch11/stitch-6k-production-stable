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

    // Idempotency: if this order was already processed, return success without
    // running any side effects.
    if (dbOrder.status === "PAID") {
      return NextResponse.json({ success: true, message: "Order already processed" });
    }

    if (dbOrder.status === "FAILED") {
      return NextResponse.json({ success: false, error: "Order in failed state, cannot reprocess" }, { status: 400 });
    }

    // Compute earned points before the atomic claim so all 4 columns are written
    // in a single UPDATE statement.
    const earned = Math.floor(dbOrder.total / 10);

    // Atomic compare-and-set: only one process (verify or webhook) wins this UPDATE.
    // The WHERE status='PAYMENT_PENDING' predicate means only the first caller
    // transitions the row; subsequent callers see claimed=null and return early.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({
        status: "PAID",
        payment_status: "PAID",
        points_earned: earned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dbOrder.id)
      .eq("status", "PAYMENT_PENDING")
      .select("id")
      .maybeSingle();

    if (claimErr) {
      console.error("[verify] claim error:", claimErr);
      return NextResponse.json({ success: false, error: "Failed to claim order" }, { status: 500 });
    }

    if (!claimed) {
      return NextResponse.json({ success: true, message: "Order already processed" });
    }

    // We won the race. Run side effects in order.
    // Failures here are logged but do NOT roll back PAID status — the customer's
    // payment is captured and reverting to PAYMENT_PENDING risks a second charge.
    // Inventory and ledger discrepancies are reconciled by ops.

    // a. Deduct inventory stock
    try {
      await db.deductStock(dbOrder.cart_items || [], dbOrder.idempotency_key);
    } catch (e) {
      console.error("[verify] deductStock failed:", e);
    }

    // b. Increment coupon usage
    if (dbOrder.coupon_code) {
      try {
        await db.incrementCouponUsage(dbOrder.coupon_code);
      } catch (e) {
        console.error("[verify] incrementCouponUsage failed:", e);
      }
    }

    // c. Debit wallet
    if (dbOrder.wallet_paid > 0) {
      try {
        await db.applyWalletDebit(dbOrder.wallet_paid, dbOrder.id, dbOrder.user_id);
      } catch (e) {
        console.error("[verify] applyWalletDebit failed:", e);
      }
    }

    // d. Debit loyalty points
    if (dbOrder.points_redeemed > 0) {
      try {
        await db.applyLoyaltyDebit(dbOrder.points_redeemed, dbOrder.id, dbOrder.user_id);
      } catch (e) {
        console.error("[verify] applyLoyaltyDebit failed:", e);
      }
    }

    // e. Award loyalty points
    try {
      await db.awardLoyaltyPoints(dbOrder.total, dbOrder.id, dbOrder.user_id);
    } catch (e) {
      console.error("[verify] awardLoyaltyPoints failed:", e);
    }

    // f. Update payments record
    try {
      const { data: payment } = await supabase
        .from("payments")
        .select("id")
        .eq("order_id", dbOrder.id)
        .single();

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
    } catch (e) {
      console.error("[verify] payments update failed:", e);
    }

    // g. Payment audit log
    try {
      await db.createPaymentAuditLog(dbOrder.id, "PAYMENT_PENDING", "PAID", "verify_route");
    } catch (e) {
      console.error("[verify] createPaymentAuditLog failed:", e);
    }

    // h. Order event
    try {
      await db.createOrderEvent(dbOrder.id, "Payment Successful");
    } catch (e) {
      console.error("[verify] createOrderEvent failed:", e);
    }

    // i. Dispatch fulfillment
    try {
      await db.dispatchFulfillment(dbOrder.id);
    } catch (e) {
      console.error("[verify] dispatchFulfillment failed:", e);
    }

    return NextResponse.json({ success: true, message: "Payment verified successfully" });

  } catch (error: any) {
    console.error("Payment Verification Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
