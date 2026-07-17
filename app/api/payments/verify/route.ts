import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { z } from "zod";
import { razorpay } from "@/lib/razorpay";
import { sendGA4Purchase, sendMetaPurchase } from "@/lib/server-analytics";
import { claimPaymentAtomically } from "@/lib/db/payments";
import { paymentProcessingQueue } from "@/lib/jobs/payment-processing";

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
        previous_status: "Payment Pending",
        new_status: "FAILED_SIGNATURE",
        metadata: { razorpay_payment_id, razorpay_order_id }
      });

      await db.transitionOrderStatus(dbOrder.id, "FAILED", {
        triggerSource: "System Verification",
        userOrAdmin: "system",
        reason: "Payment verification failed: Invalid signature"
      });
      await db.releaseReservation(dbOrder.idempotency_key);

      return NextResponse.json({ success: false, error: "Payment verification failed: Invalid signature" }, { status: 400 });
    }

    // Verify paid amount matches expected amount
    const expectedAmount = Math.round(
      (dbOrder.gateway_paid ?? dbOrder.total) * 100
    ); // Razorpay uses paise

    let paymentEntity;
    try {
      paymentEntity = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (e) {
      console.error("[verify] failed to fetch payment details from razorpay:", e);
    }

    if (paymentEntity?.amount && 
        expectedAmount &&
        Number(paymentEntity.amount) < expectedAmount) {
      
      console.error(
        '[FRAUD ALERT] Payment amount mismatch:',
        `paid=${paymentEntity.amount}`,
        `expected=${expectedAmount}`,
        `orderId=${dbOrder.id}`
      );
      
      // Capture to Sentry immediately
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureEvent({
        message: 'FRAUD: Payment amount mismatch',
        level: 'error',
        extra: {
          paid: paymentEntity.amount,
          expected: expectedAmount,
          orderId: dbOrder.id
        }
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment amount verification failed.' 
        },
        { status: 400 }
      );
    }

    if (paymentEntity?.amount && Number(paymentEntity.amount) > expectedAmount) {
      console.warn(
        `[Overpayment] Payment amount greater than expected:`,
        `paid=${paymentEntity.amount}`,
        `expected=${expectedAmount}`,
        `orderId=${dbOrder.id}`
      );
    }

    // Idempotency: if this order was already processed, verify all side effects completed.
    // If the previous run crashed midway, the order status is 'Paid' but the inventory reservation
    // remains unfulfilled. In that case, we proceed to run the missed side effects.
    let isRecoveryMode = false;
    if (dbOrder.status === "Paid") {
      const { data: resData } = await supabase
        .from("inventory_reservations")
        .select("status")
        .eq("session_id", dbOrder.idempotency_key)
        .maybeSingle();

      if (resData && resData.status !== "fulfilled") {
        console.warn(`[verify] Order ${dbOrder.id} is Paid but reservation status is ${resData.status}. Recovering missing side-effects...`);
        isRecoveryMode = true;
      } else {
        return NextResponse.json({ success: true, message: "Order already processed", orderId: dbOrder.id });
      }
    }

    if (dbOrder.status === "FAILED") {
      return NextResponse.json({ success: false, error: "Order in failed state, cannot reprocess" }, { status: 400 });
    }

    // Earned points calculated for reference
    const earnBase = Math.max(0, (dbOrder.original_total || 0) - (dbOrder.coupon_discount || 0));
    const earned = Math.floor(earnBase / 100) * 5; 

    // Atomic compare-and-set
    const claimResult = await claimPaymentAtomically(dbOrder.id, razorpay_payment_id);
    
    if (!claimResult.success && claimResult.message !== 'Duplicate payment ID prevented') {
      return NextResponse.json({ success: false, error: claimResult.message || "Failed to claim order" }, { status: 500 });
    }

    if (claimResult.message === 'Order already claimed' || claimResult.message === 'Duplicate payment ID prevented') {
       console.log(`[verify] Order ${dbOrder.id} already claimed. Skipping side effects.`);
       return NextResponse.json({ success: true, message: "Order already processed", orderId: dbOrder.id });
    }

    // We won the race. Enqueue side effects worker.
    try {
      await paymentProcessingQueue.add("process_payment_side_effects", {
        orderId: dbOrder.id,
        razorpayPaymentId: razorpay_payment_id
      }, {
        jobId: `payment_${dbOrder.id}_${razorpay_payment_id}` // Deduplication via jobId
      });
      console.log(`[verify] Enqueued payment side effects for ${dbOrder.id}`);
    } catch (enqueueErr) {
      console.error("[verify] Failed to enqueue payment worker:", enqueueErr);
      // Even if it fails, the recovery worker will pick it up, or it can be manually retried.
    }



    // Run server-side tracking in parallel (non-blocking)
    Promise.all([
      sendGA4Purchase({
        orderId: dbOrder.id,
        total: dbOrder.total,
        items: dbOrder.cart_items || [],
        couponCode: dbOrder.coupon_code,
        clientId: req.headers.get("x-ga-client-id") || dbOrder.id,
      }),
      sendMetaPurchase({
        orderId: dbOrder.id,
        total: dbOrder.total,
        items: dbOrder.cart_items || [],
        customerEmail: dbOrder.address_snapshot?.email || undefined,
        customerPhone: dbOrder.address_snapshot?.phone || undefined,
        customerName: dbOrder.customer,
        createdAt: dbOrder.created_at,
      }),
    ]).catch((err) => {
      console.error("[Server Analytics]:", err);
    });

    return NextResponse.json({ success: true, message: "Payment verified successfully", orderId: dbOrder.id });

  } catch (error: unknown) {
    console.error("[Payment Error]:", error);
    Sentry.captureException(error, { tags: { area: "payment", route: "verify" } });
    return NextResponse.json(
      { success: false, error: "Payment processing failed. Please try again." },
      { status: 500 }
    );
  }
}
