import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { claimPaymentAtomically } from "@/lib/db/payments";
import { paymentProcessingQueue } from "@/lib/jobs/payment-processing";
import { paymentDebugLog } from "@/lib/payment-debug";
import { processOutbox } from "@/lib/jobs/outbox";

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

    // Execute Transactional Payment RPC
    const earnBase = Math.max(0, (dbOrder.original_total || 0) - (dbOrder.coupon_discount || 0));
    const earned = Math.floor(earnBase / 100) * 5; 

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/razorpay-callback",
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
      functionName: "POST /api/payments/razorpay-callback",
      orderId: dbOrder.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      reason: `RPC confirm_order_and_process_payments_atomic result: ${transactionRes.success ? "success" : "failed"}`,
      rpc: "confirm_order_and_process_payments_atomic",
      metadata: transactionRes
    });

    if (!transactionRes.success) {
      if (!transactionRes.error?.includes("already processed")) {
        return NextResponse.redirect(
          new URL(`/payment-failed?error=${encodeURIComponent(transactionRes.error || "Failed to claim order")}`, req.url),
          303
        );
      }
    } else {
      // Trigger Outbox processing fast-path asynchronously
      processOutbox().catch(err => {
        console.error("[Callback] Failed to process outbox in fast-path:", err);
      });
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
