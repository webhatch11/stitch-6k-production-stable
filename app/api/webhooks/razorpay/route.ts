import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured. Refusing all webhooks.");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
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
      console.error("[Webhook] Signature mismatch");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Signature valid, continue with event processing

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
        console.log(`[Webhook] Event ${eventId} already processed. Skipping.`);
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

    // 3. Process the Event
    const body = payload; // alias to match the prompt's snippet

    switch (eventName) {
      case "payment.captured":
      case "order.paid": {
        const paymentEntity = body.payload?.payment?.entity;
        const razorpayOrderId = paymentEntity?.order_id;
        const razorpayPaymentId = paymentEntity?.id;

        if (!razorpayOrderId) {
          return NextResponse.json({ success: true, message: "No order ID present" });
        }

        if (supabase) {
          const { data: dbOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("razorpay_order_id", razorpayOrderId)
            .maybeSingle();

          if (!dbOrder) {
            console.log(`[Webhook] No order found for razorpay_order_id=${razorpayOrderId}`);
          } else {
            const earned = Math.floor(dbOrder.total / 10);

            // Atomic compare-and-set: only one process (verify or webhook) wins this UPDATE.
            // The WHERE status='PAYMENT_PENDING' predicate means only the first caller
            // transitions the row; subsequent callers see claimed=null and skip side effects.
            const { data: claimed, error: claimErr } = await supabase
              .from("orders")
              .update({
                status: "PAID",
                payment_status: "PAID",
                points_earned: earned,
              })
              .eq("id", dbOrder.id)
              .eq("status", "PAYMENT_PENDING")
              .select("id")
              .maybeSingle();

            if (claimErr) {
              console.error("[Webhook] claim error:", claimErr);
            } else if (!claimed) {
              console.log(`[Webhook] Order ${dbOrder.id} already claimed by another process, skipping side effects`);
            } else {
              // We won the race. Run side effects in order.
              // Failures here are logged but do NOT roll back PAID status — the
              // customer's payment is captured and reverting risks a second charge.

              // a. Deduct inventory stock
              let deductSuccess = false;
              try {
                deductSuccess = await db.deductStock(dbOrder.cart_items || [], dbOrder.idempotency_key);
              } catch (e) {
                console.error("[webhook] deductStock failed:", e);
              }
              if (!deductSuccess) {
                console.error(`[webhook] DEDUCT FAILED post-payment for order ${dbOrder.id}`);
                console.warn(`[ADMIN ALERT] Webhook inventory deduction failed for order ${dbOrder.id}`);
                // do not change status
              }

              // b. Increment coupon usage
              if (dbOrder.coupon_code) {
                try {
                  await db.incrementCouponUsage(dbOrder.coupon_code);
                } catch (e) {
                  console.error("[webhook] incrementCouponUsage failed:", e);
                }
              }

              // c. Debit wallet
              if (dbOrder.wallet_paid > 0) {
                try {
                  await db.applyWalletDebit(dbOrder.wallet_paid, dbOrder.id, dbOrder.user_id);
                } catch (e) {
                  console.error("[webhook] applyWalletDebit failed:", e);
                }
              }

              // d. Debit loyalty points
              if (dbOrder.points_redeemed > 0) {
                try {
                  await db.applyLoyaltyDebit(dbOrder.points_redeemed, dbOrder.id, dbOrder.user_id);
                } catch (e) {
                  console.error("[webhook] applyLoyaltyDebit failed:", e);
                }
              }

              // e. Award loyalty points
              try {
                await db.awardLoyaltyPoints(dbOrder.total, dbOrder.id, dbOrder.user_id);
              } catch (e) {
                console.error("[webhook] awardLoyaltyPoints failed:", e);
              }

              // f. Update payments record
              try {
                const { data: payment } = await supabase
                  .from("payments")
                  .select("id")
                  .eq("order_id", dbOrder.id)
                  .maybeSingle();

                if (payment) {
                  await supabase.from("payments").update({
                    razorpay_payment_id: razorpayPaymentId,
                    status: "CAPTURED"
                  }).eq("id", payment.id);

                  await supabase.from("payment_logs").insert({
                    payment_id: payment.id,
                    previous_status: "CREATED",
                    new_status: "CAPTURED",
                    metadata: { event: eventName, source: "webhook", razorpay_payment_id: razorpayPaymentId }
                  });
                }
              } catch (e) {
                console.error("[webhook] payments update failed:", e);
              }

              // g. Payment audit log
              try {
                await db.createPaymentAuditLog(dbOrder.id, "PAYMENT_PENDING", "PAID", "webhook");
              } catch (e) {
                console.error("[webhook] createPaymentAuditLog failed:", e);
              }

              // h. Order event
              try {
                await db.createOrderEvent(dbOrder.id, "Payment Successful");
              } catch (e) {
                console.error("[webhook] createOrderEvent failed:", e);
              }

              // i. Dispatch fulfillment
              try {
                await db.dispatchFulfillment(dbOrder.id);
              } catch (e) {
                console.error("[webhook] dispatchFulfillment failed:", e);
              }
            }
          }
        }
        break;
      }
      case "payment.failed": {
        const paymentEntity = body.payload?.payment?.entity;
        const razorpayOrderId = paymentEntity?.order_id;
        if (!razorpayOrderId) {
          return NextResponse.json({ success: true, message: "No order ID present" });
        }
        if (supabase) {
          const { data: dbOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("razorpay_order_id", razorpayOrderId)
            .maybeSingle();

          if (dbOrder && dbOrder.status !== "PAID") {
            const orderId = dbOrder.id;

            // Update status to FAILED
            await db.saveOrder({
              id: orderId,
              status: "FAILED"
            });

            await db.createPaymentAuditLog(orderId, "PAYMENT_PENDING", "FAILED", "webhook");
            await db.createOrderEvent(orderId, "Payment Failed");

            await supabase.from("orders").update({
              payment_status: "FAILED",
              status: "FAILED"
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
          console.log(`[Webhook refund] order ${order.id} already in terminal state ${order.refund_status}`);
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
        
        console.log(`[Webhook refund] order ${order.id} → ${newStatus}`);
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
