import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { db } from "@/lib/db";
import { claimPaymentAtomically } from "@/lib/db/payments";
import { paymentProcessingQueue } from "@/lib/jobs/payment-processing";
import { paymentDebugLog } from "@/lib/payment-debug";
import { processOutbox } from "@/lib/jobs/outbox";
import { razorpay } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      paymentDebugLog({
        functionName: "POST /api/webhooks/razorpay",
        reason: "RAZORPAY_WEBHOOK_SECRET missing in environment",
        error: "Webhook secret not configured"
      });
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured. Refusing all webhooks.");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      paymentDebugLog({
        functionName: "POST /api/webhooks/razorpay",
        reason: "Missing signature header in webhook request",
        error: "Missing signature"
      });
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 400 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      paymentDebugLog({
        functionName: "POST /api/webhooks/razorpay",
        reason: "Webhook signature mismatch",
        error: "Invalid signature"
      });
      console.error("[Webhook] Signature mismatch");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.event;

    const eventId = req.headers.get("x-razorpay-event-id") || 
      (eventName && eventName.startsWith("refund.")
        ? `evt_${payload.payload?.refund?.entity?.id}_${eventName}`
        : `evt_${payload.payload?.payment?.entity?.id}_${eventName}`);

    // 2. Idempotency Check
    if (supabase) {
      const { data: existingLog } = await supabase
        .from("webhook_logs")
        .select("id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existingLog) {
        paymentDebugLog({
          functionName: "POST /api/webhooks/razorpay",
          reason: `Webhook event already processed. Skipping.`,
          metadata: { eventId, event: eventName }
        });
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // Log the incoming webhook immediately
      await supabase.from("webhook_logs").insert({
        event_id: eventId,
        payload,
        signature: signature || "skipped_dev",
        processed: false
      });
    }

    paymentDebugLog({
      functionName: "POST /api/webhooks/razorpay",
      reason: `Webhook event verification successful. Event: ${eventName}`,
      metadata: { eventId, event: eventName }
    });

    const body = payload; // alias to match the prompt's snippet

    switch (eventName) {
      case "payment.captured":
      case "order.paid": {
        const paymentEntity = body.payload?.payment?.entity;
        const razorpayOrderId = paymentEntity?.order_id;
        const razorpayPaymentId = paymentEntity?.id;

        if (!razorpayOrderId) {
          paymentDebugLog({
            functionName: `Webhook event handler: ${eventName}`,
            razorpayPaymentId,
            reason: "Missing order ID in payment entity",
            error: "No order ID"
          });
          return NextResponse.json({ success: true, message: "No order ID present" });
        }

        if (supabase) {
          const { data: dbOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("razorpay_order_id", razorpayOrderId)
            .maybeSingle();

          if (!dbOrder) {
            paymentDebugLog({
              functionName: `Webhook event handler: ${eventName}`,
              razorpayOrderId,
              razorpayPaymentId,
              reason: "Order lookup failed. No order matched in DB.",
              error: "Order not found"
            });
          } else {
            const traceId = (dbOrder.payment_processing_state as any)?.traceId || "webhook-no-trace";
            paymentDebugLog({
              traceId,
              functionName: `Webhook event handler: ${eventName}`,
              orderId: dbOrder.id,
              razorpayOrderId,
              razorpayPaymentId,
              reason: `Loaded order in webhook with status: ${dbOrder.status}`
            });

            // Execute Transactional Payment RPC
            const earnBase = Math.max(0, (dbOrder.original_total || 0) - (dbOrder.coupon_discount || 0));
            const earned = Math.floor(earnBase / 100) * 5; 

            paymentDebugLog({
              traceId,
              functionName: `Webhook event handler: ${eventName}`,
              orderId: dbOrder.id,
              razorpayOrderId,
              razorpayPaymentId,
              reason: "Executing confirmOrderAndProcessPaymentsAtomic transaction RPC from webhook",
              rpc: "confirm_order_and_process_payments_atomic"
            });
            const transactionRes = await db.confirmOrderAndProcessPaymentsAtomic({
              orderId: dbOrder.id,
              paymentId: razorpayPaymentId,
              walletDeduction: dbOrder.wallet_paid || 0,
              pointsRedeemed: dbOrder.points_redeemed || 0,
              couponCode: dbOrder.coupon_code || "",
              earnedPoints: earned,
              method: "razorpay"
            });

            paymentDebugLog({
              traceId,
              functionName: `Webhook event handler: ${eventName}`,
              orderId: dbOrder.id,
              razorpayOrderId,
              razorpayPaymentId,
              reason: `RPC confirm_order_and_process_payments_atomic result: ${transactionRes.success ? "success" : "failed"}`,
              rpc: "confirm_order_and_process_payments_atomic",
              metadata: transactionRes
            });

            if (!transactionRes.success) {
              if (!transactionRes.error?.includes("already processed")) {
                console.error("[Webhook] Failed to confirm order via transaction RPC:", transactionRes.error);
              }
            } else {
              // Trigger Outbox processing fast-path asynchronously
              processOutbox().catch(err => {
                console.error("[Webhook] Failed to process outbox in fast-path:", err);
              });
            }
          }
        }
        break;
      }
      case "payment.failed": {
        const paymentEntity = body.payload?.payment?.entity;
        const razorpayOrderId = paymentEntity?.order_id;
        const razorpayPaymentId = paymentEntity?.id;
        if (!razorpayOrderId) {
          paymentDebugLog({
            functionName: "Webhook event handler: payment.failed",
            razorpayPaymentId,
            reason: "Missing order ID in payment entity",
            error: "No order ID"
          });
          return NextResponse.json({ success: true, message: "No order ID present" });
        }
        if (supabase) {
          const { data: dbOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("razorpay_order_id", razorpayOrderId)
            .maybeSingle();

          const isAlreadyProcessed = ["Paid", "Paid via Wallet", "paid via wallet", "Accepted", "Processing", "Packed", "Shipped", "Delivered"].includes(dbOrder?.status || "");
          if (dbOrder && !isAlreadyProcessed) {
            const orderId = dbOrder.id;
            const traceId = (dbOrder.payment_processing_state as any)?.traceId || "webhook-no-trace";

            // BUG 1 FIX: Before marking FAILED, verify with Razorpay API that the overall order status is not paid.
            // A payment.failed webhook can arrive BEFORE payment.captured when a user retries a card.
            if (razorpayOrderId) {
              try {
                const rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
                if (rzpOrder.status === "paid") {
                  paymentDebugLog({
                    traceId,
                    functionName: "Webhook event handler: payment.failed",
                    orderId,
                    razorpayOrderId,
                    razorpayPaymentId,
                    reason: "payment.failed webhook received but Razorpay API confirms order status is PAID. Skipping FAILED transition to prevent race condition."
                  });
                  // Do NOT mark order as FAILED — the captured webhook or verify route will handle it
                  break;
                }
              } catch (rzpFetchErr: any) {
                paymentDebugLog({
                  traceId,
                  functionName: "Webhook event handler: payment.failed",
                  orderId,
                  razorpayOrderId,
                  razorpayPaymentId,
                  reason: "Could not fetch order status from Razorpay API during payment.failed handling. Proceeding with FAILED transition.",
                  error: rzpFetchErr.message
                });
              }
            }

            paymentDebugLog({
              traceId,
              functionName: "Webhook event handler: payment.failed",
              orderId,
              razorpayOrderId,
              razorpayPaymentId,
              oldStatus: dbOrder.status,
              newStatus: "FAILED",
              reason: "payment.failed event confirmed, changing order status to FAILED and releasing reservation"
            });

            await db.transitionOrderStatus(orderId, "FAILED", {
              triggerSource: "Razorpay Webhook",
              userOrAdmin: "system",
              reason: "Payment Failed"
            });

            await db.createPaymentAuditLog(orderId, "Payment Pending", "FAILED", "webhook");

            await supabase.from("orders").update({
              payment_status: "FAILED"
            }).eq("id", orderId);

            // Release reservation
            await db.releaseReservation(dbOrder.idempotency_key);

            const { data: payment } = await supabase.from("payments").select("id").eq("order_id", orderId).maybeSingle();
            if (payment) {
              await supabase.from("payments").update({
                status: "FAILED"
              }).eq("id", payment.id);

              await supabase.from("payment_logs").insert({
                payment_id: payment.id,
                previous_status: "CREATED",
                new_status: "FAILED",
                metadata: { event: eventName, reason: paymentEntity?.error_description }
              });
            }
          }
        }
        break;
      }
      case "refund.processed":
      case "refund.failed": {
        const refund = body.payload?.refund?.entity;
        if (!refund?.id) {
          console.warn("[Webhook refund] missing refund.id", body);
          return NextResponse.json({ ok: true });
        }
        
        if (!supabase) {
          console.error("[Webhook refund] supabase client is null");
          return NextResponse.json({ ok: true });
        }
        
        const newStatus = refund.status === "processed" ? "processed" : "failed";
        
        // Find the order by refund_id (uses the partial index from Day 12C)
        const { data: order, error: findErr } = await supabase
          .from("orders")
          .select("id, refund_status")
          .eq("refund_id", refund.id)
          .maybeSingle();
        
        if (findErr || !order) {
          console.warn(`[Webhook refund] no order matches refund_id=${refund.id}`);
          // Still return 200 so Razorpay doesn't keep retrying
          return NextResponse.json({ ok: true });
        }
        
        // Idempotency: skip if already in terminal state
        if (order.refund_status === "processed" || order.refund_status === "failed") {
          // Order already in terminal state
          if (supabase) {
            await supabase.from("webhook_logs").update({ processed: true }).eq("event_id", eventId);
          }
          return NextResponse.json({ ok: true });
        }
        
        // Transition status
        await supabase
          .from("orders")
          .update({ 
            refund_status: newStatus,
            refunded_at: new Date().toISOString(),
          })
          .eq("id", order.id);
        
        // Refund state updated
        if (supabase) {
          await supabase.from("webhook_logs").update({ processed: true }).eq("event_id", eventId);
        }
        return NextResponse.json({ ok: true });
      }
    }

    // 4. Mark processed
    if (supabase) {
      await supabase.from("webhook_logs").update({ processed: true }).eq("event_id", eventId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    Sentry.captureException(error, { tags: { area: "payment", route: "webhook-razorpay" } });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
