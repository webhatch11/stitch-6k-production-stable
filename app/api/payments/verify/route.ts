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
import { paymentDebugLog } from "@/lib/payment-debug";
import { processOutbox } from "@/lib/jobs/outbox";

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
      paymentDebugLog({
        functionName: "POST /api/payments/verify",
        reason: "Invalid payload parameters schema parsing failed",
        error: parsed.error.message
      });
      return NextResponse.json({ success: false, error: "Invalid verification payload" }, { status: 400 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = parsed.data;

    if (!supabase) {
      paymentDebugLog({
        functionName: "POST /api/payments/verify",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "Supabase client is null",
        error: "Database unavailable"
      });
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
    }

    const { data: dbOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (orderFetchError || !dbOrder) {
      paymentDebugLog({
        functionName: "POST /api/payments/verify",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "Order lookup failed by razorpay_order_id",
        error: orderFetchError?.message || "Order not found"
      });
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const traceId = (dbOrder.payment_processing_state as any)?.traceId || "verify-no-trace";

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/verify",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: `Loaded authoritative order from DB with status: ${dbOrder.status}`
    });

    // Defense in depth: assert the row we loaded is the one we asked for.
    if (dbOrder.razorpay_order_id !== razorpay_order_id) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/verify",
        orderId: dbOrder.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "Order ID assertion mismatch mismatch",
        error: `Loaded=${dbOrder.razorpay_order_id} vs Request=${razorpay_order_id}`
      });
      return NextResponse.json({ success: false, error: "Order ID mismatch" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "";

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/verify",
        orderId: dbOrder.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        oldStatus: dbOrder.status,
        newStatus: "FAILED",
        reason: "Signature mismatch check failed, changing order status to FAILED and releasing reservation"
      });

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

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/verify",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: "Cryptographic signature validation successful"
    });

    // Verify paid amount matches expected amount
    const expectedAmount = Math.round(
      (dbOrder.gateway_paid ?? dbOrder.total) * 100
    ); // Razorpay uses paise

    let paymentEntity;
    try {
      paymentEntity = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (e: any) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/verify",
        orderId: dbOrder.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "Failed to fetch payment details from Razorpay gateway API",
        error: e.message || String(e)
      });
      console.error("[verify] failed to fetch payment details from razorpay:", e);
    }

    if (paymentEntity?.amount && 
        expectedAmount &&
        Number(paymentEntity.amount) < expectedAmount) {
      
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/verify",
        orderId: dbOrder.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "[FRAUD ALERT] Payment amount mismatch: underpayment detected",
        error: `paid=${paymentEntity.amount} vs expected=${expectedAmount}`
      });
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
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/verify",
        orderId: dbOrder.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: `[Overpayment Warning] paid=${paymentEntity.amount} vs expected=${expectedAmount}`
      });
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
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/verify",
          orderId: dbOrder.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          reason: `Order is already Paid but reservation status is ${resData.status}. Running recovery mode side-effects.`
        });
        isRecoveryMode = true;
      } else {
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/verify",
          orderId: dbOrder.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          reason: "Order is already Paid and inventory reservation is fulfilled. Skipping all duplicate steps."
        });
        return NextResponse.json({ success: true, message: "Order already processed", orderId: dbOrder.id });
      }
    }

    // BUG 1 FIX: When the order status is FAILED, do not immediately reject.
    // A payment.failed webhook from a previous declined attempt may have arrived BEFORE
    // the payment.captured event, incorrectly marking the order FAILED. If the signature
    // we just validated is correct and Razorpay confirms the payment is captured,
    // we reset the order to "Payment Pending" so atomic_claim_payment can process it.
    if (dbOrder.status === "FAILED") {
      let paymentStatusFromRzp = paymentEntity?.status as string | undefined;

      // If we didn't fetch the payment entity yet (e.g. fetch threw above), try again now
      if (!paymentStatusFromRzp) {
        try {
          const rzpPaymentCheck = await razorpay.payments.fetch(razorpay_payment_id);
          paymentStatusFromRzp = rzpPaymentCheck.status as string;
        } catch (_e) {
          // Cannot determine — safe to reject
        }
      }

      if (paymentStatusFromRzp === "captured") {
        // Payment was genuinely captured. The order was prematurely marked FAILED
        // by a racing webhook. Reset to Payment Pending so the claim proceeds.
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/verify",
          orderId: dbOrder.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          oldStatus: "FAILED",
          newStatus: "Payment Pending",
          reason: "Order was prematurely FAILED by a racing payment.failed webhook. Razorpay confirms payment is CAPTURED. Resetting to Payment Pending to allow claim."
        });
        await supabase.from("orders").update({
          status: "Payment Pending",
          payment_status: "Payment Pending"
        }).eq("id", dbOrder.id);
        // Allow execution to fall through to atomic_claim_payment below
      } else {
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/verify",
          orderId: dbOrder.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          reason: "Order status is FAILED and Razorpay does not confirm capture. Refusing reprocessing.",
          error: "FAILED state block"
        });
        return NextResponse.json({ success: false, error: "Order in failed state, cannot reprocess" }, { status: 400 });
      }
    }

    // Earned points calculated for reference
    const earnBase = Math.max(0, (dbOrder.original_total || 0) - (dbOrder.coupon_discount || 0));
    const earned = Math.floor(earnBase / 100) * 5; 

    // Execute Transactional Payment RPC
    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/verify",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: "Executing confirmOrderAndProcessPaymentsAtomic transaction RPC",
      rpc: "confirm_order_and_process_payments_atomic"
    });
    const transactionRes = await db.confirmOrderAndProcessPaymentsAtomic({
      orderId: dbOrder.id,
      paymentId: razorpay_payment_id,
      walletDeduction: dbOrder.wallet_paid || 0,
      pointsRedeemed: dbOrder.points_redeemed || 0,
      couponCode: dbOrder.coupon_code || "",
      earnedPoints: earned,
      method: "razorpay"
    });

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/verify",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: `RPC confirm_order_and_process_payments_atomic result: ${transactionRes.success ? "success" : "failed"}`,
      rpc: "confirm_order_and_process_payments_atomic",
      metadata: transactionRes
    });

    if (!transactionRes.success) {
      if (transactionRes.error?.includes("already processed")) {
        console.log(`[verify] Order ${dbOrder.id} already processed. Skipping side effects.`);
        return NextResponse.json({ success: true, message: "Order already processed", orderId: dbOrder.id });
      }
      return NextResponse.json({ success: false, error: transactionRes.error || "Failed to confirm order" }, { status: 500 });
    }

    // Trigger Outbox processing fast-path asynchronously
    processOutbox().catch(err => {
      console.error("[verify] Failed to process outbox in fast-path:", err);
    });

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

  } catch (error: any) {
    paymentDebugLog({
      functionName: "POST /api/payments/verify",
      reason: "Unhandled exception in verify route handler",
      error: error.message || String(error)
    });
    console.error("[Payment Error]:", error);
    Sentry.captureException(error, { tags: { area: "payment", route: "verify" } });
    return NextResponse.json(
      { success: false, error: "Payment processing failed. Please try again." },
      { status: 500 }
    );
  }
}
