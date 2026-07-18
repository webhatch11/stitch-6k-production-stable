import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { claimPaymentAtomically } from "@/lib/db/payments";
import { paymentProcessingQueue } from "@/lib/jobs/payment-processing";
import { paymentDebugLog } from "@/lib/payment-debug";

export async function POST(req: NextRequest) {
  let traceId = "callback-no-trace";
  try {
    const formData = await req.formData();
    const razorpay_payment_id = formData.get("razorpay_payment_id")?.toString();
    const razorpay_order_id = formData.get("razorpay_order_id")?.toString();
    const razorpay_signature = formData.get("razorpay_signature")?.toString();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      paymentDebugLog({
        functionName: "POST /api/payments/razorpay-callback",
        reason: "Missing payment credentials in formData",
        error: "Missing credentials"
      });
      return NextResponse.redirect(
        new URL("/payment-failed?error=Missing+payment+credentials", req.url),
        303
      );
    }

    if (!supabase) {
      paymentDebugLog({
        functionName: "POST /api/payments/razorpay-callback",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "Supabase client is null",
        error: "Database unavailable"
      });
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
      paymentDebugLog({
        functionName: "POST /api/payments/razorpay-callback",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        reason: "Order lookup failed by razorpay_order_id",
        error: orderFetchError?.message || "Order not found"
      });
      return NextResponse.redirect(
        new URL("/payment-failed?error=Order+not+found", req.url),
        303
      );
    }

    traceId = (dbOrder.payment_processing_state as any)?.traceId || "callback-no-trace";

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/razorpay-callback",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: `Loaded order from DB in callback route with status: ${dbOrder.status}`
    });

    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/razorpay-callback",
        orderId: dbOrder.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        oldStatus: dbOrder.status,
        newStatus: dbOrder.status !== "Paid" ? "FAILED" : dbOrder.status,
        reason: "Signature mismatch check failed in callback redirect, updating status if not Paid"
      });
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

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/razorpay-callback",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: "Cryptographic signature validation successful in callback redirect"
    });

    // Atomic compare-and-set
    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/razorpay-callback",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: "Executing atomic_claim_payment database RPC lock",
      rpc: "atomic_claim_payment"
    });
    const claimResult = await claimPaymentAtomically(dbOrder.id, razorpay_payment_id);
    
    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/razorpay-callback",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: `RPC atomic_claim_payment result: ${claimResult.message}`,
      rpc: "atomic_claim_payment",
      rpcResult: claimResult.success ? "success" : "failed",
      metadata: claimResult
    });

    if (!claimResult.success && claimResult.message !== 'Duplicate payment ID prevented') {
      return NextResponse.redirect(
        new URL(`/payment-failed?error=${encodeURIComponent(claimResult.message || "Failed to claim order")}`, req.url),
        303
      );
    }

    if (claimResult.message !== 'Order already claimed' && claimResult.message !== 'Duplicate payment ID prevented') {
      // We won the race. Enqueue side effects worker.
      try {
        const jobId = `payment_${dbOrder.id}_${razorpay_payment_id}`;
        await paymentProcessingQueue.add("process_payment_side_effects", {
          orderId: dbOrder.id,
          razorpayPaymentId: razorpay_payment_id
        }, {
          jobId // Deduplication via jobId
        });
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/razorpay-callback",
          orderId: dbOrder.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          reason: `Successfully enqueued process_payment_side_effects job with jobId: ${jobId}`
        });
        console.log(`[Callback] Enqueued payment side effects for ${dbOrder.id}`);
      } catch (enqueueErr: any) {
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/razorpay-callback",
          orderId: dbOrder.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          reason: "Failed to enqueue payment worker to Redis/BullMQ",
          error: enqueueErr.message || String(enqueueErr)
        });
        console.error("[Callback] Failed to enqueue payment worker:", enqueueErr);
      }
    }

    // Success! Redirect to confirmation page with the correct database order UUID
    return NextResponse.redirect(
      new URL(`/orderconfirmed?orderId=${dbOrder.id}`, req.url),
      303
    );

  } catch (error: any) {
    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/razorpay-callback",
      reason: "Unhandled exception in callback route handler",
      error: error.message || String(error)
    });
    console.error("[Razorpay Callback Error]:", error);
    return NextResponse.redirect(
      new URL(`/payment-failed?error=${encodeURIComponent(error.message || "Payment processing failed")}`, req.url),
      303
    );
  }
}
