import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  checkoutState: z.any()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid verification payload" }, { status: 400 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, checkoutState } = parsed.data;

    const secret = process.env.RAZORPAY_KEY_SECRET || "";

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Log the failure
      if (supabase) {
        await supabase.from("payment_logs").insert({
          payment_id: null,
          previous_status: "PAYMENT_PENDING",
          new_status: "FAILED_SIGNATURE",
          metadata: { razorpay_payment_id, razorpay_order_id }
        });
        
        await supabase.from("orders").update({
          payment_status: "FAILED",
          status: "FAILED"
        }).eq("razorpay_order_id", razorpay_order_id);
      }
      
      // Also mark local order as failed
      await db.saveOrder({
        id: checkoutState.idempotencyKey,
        status: "FAILED"
      });

      return NextResponse.json({ success: false, error: "Payment verification failed: Invalid signature" }, { status: 400 });
    }

    // Payment is legitimately successful.
    // 1. Complete the logic (Wallet/Loyalty/Coupons)
    
    // Increment coupon usage
    if (checkoutState.couponCode) {
      await db.incrementCouponUsage(checkoutState.couponCode);
    }
    
    // Debit wallet if used
    if (checkoutState.walletDeduction > 0) {
      await db.applyWalletDebit(checkoutState.walletDeduction, checkoutState.idempotencyKey, checkoutState.userId);
    }

    // Debit points if used
    if (checkoutState.pointsRedeemed > 0) {
      await db.applyLoyaltyDebit(checkoutState.pointsRedeemed, checkoutState.idempotencyKey, checkoutState.userId);
    }

    // Award new points
    const earned = Math.floor(checkoutState.netTotal / 10);
    if (earned > 0) {
      await db.awardLoyaltyPoints(checkoutState.netTotal, checkoutState.idempotencyKey, checkoutState.userId);
    }

    // Update order status to PAID
    await db.saveOrder({
      id: checkoutState.idempotencyKey,
      status: "PAID",
      pointsEarned: earned
    });

    if (supabase) {
      await supabase.from("orders").update({
        payment_status: "PAID",
        status: "PAID",
        points_earned: earned
      }).eq("id", checkoutState.idempotencyKey);

      // Find the payment record
      const { data: payment } = await supabase.from("payments").select("id").eq("order_id", checkoutState.idempotencyKey).single();
      
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
    }

    return NextResponse.json({ success: true, message: "Payment verified successfully" });

  } catch (error: any) {
    console.error("Payment Verification Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
