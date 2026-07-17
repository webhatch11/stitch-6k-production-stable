import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { claimPaymentAtomically } from "@/lib/db/payments";
import { paymentProcessingQueue } from "@/lib/jobs/payment-processing";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const razorpay_payment_id = formData.get("razorpay_payment_id")?.toString();
    const razorpay_order_id = formData.get("razorpay_order_id")?.toString();
    const razorpay_signature = formData.get("razorpay_signature")?.toString();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.redirect(
        new URL("/payment-failed?error=Missing+payment+credentials", req.url),
        303
      );
    }

    if (!supabase) {
      return NextResponse.redirect(
        new URL("/payment-failed?error=Database+unavailable", req.url),
        303
      );
    }

    const { data: dbOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (orderFetchError || !dbOrder) {
      return NextResponse.redirect(
        new URL("/payment-failed?error=Order+not+found", req.url),
        303
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Mark order as failed (only if not already paid)
      if (dbOrder.status !== "Paid") {
        await supabase.from("orders").update({
          payment_status: "FAILED",
          status: "FAILED"
        }).eq("id", dbOrder.id);
        await db.releaseReservation(dbOrder.idempotency_key);
        await db.createOrderEvent(dbOrder.id, "Payment Failed");
      }

      return NextResponse.redirect(
        new URL("/payment-failed?error=Invalid+payment+signature", req.url),
        303
      );
    }

    // Atomic compare-and-set
    const claimResult = await claimPaymentAtomically(dbOrder.id, razorpay_payment_id);
    
    if (!claimResult.success && claimResult.message !== 'Duplicate payment ID prevented') {
      return NextResponse.redirect(
        new URL(`/payment-failed?error=${encodeURIComponent(claimResult.message || "Failed to claim order")}`, req.url),
        303
      );
    }

    if (claimResult.message !== 'Order already claimed' && claimResult.message !== 'Duplicate payment ID prevented') {
      // We won the race. Enqueue side effects worker.
      try {
        await paymentProcessingQueue.add("process_payment_side_effects", {
          orderId: dbOrder.id,
          razorpayPaymentId: razorpay_payment_id
        }, {
          jobId: `payment_${dbOrder.id}_${razorpay_payment_id}` // Deduplication via jobId
        });
        console.log(`[Callback] Enqueued payment side effects for ${dbOrder.id}`);
      } catch (enqueueErr) {
        console.error("[Callback] Failed to enqueue payment worker:", enqueueErr);
      }
    }

    // Success! Redirect to confirmation page with the correct database order UUID
    return NextResponse.redirect(
      new URL(`/orderconfirmed?orderId=${dbOrder.id}`, req.url),
      303
    );

  } catch (error: any) {
    console.error("[Razorpay Callback Error]:", error);
    return NextResponse.redirect(
      new URL(`/payment-failed?error=${encodeURIComponent(error.message || "Payment processing failed")}`, req.url),
      303
    );
  }
}
