import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // 1. Signature Verification with Fallback
    if (process.env.NODE_ENV === "production" || secret) {
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
      }
      if (!secret) {
        return NextResponse.json({ error: "Webhook secret missing in environment" }, { status: 500 });
      }

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("Webhook signature mismatch!");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    } else {
      console.warn("⚠️ Running in development mode without RAZORPAY_WEBHOOK_SECRET. Skipping verification.");
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.event;

    // Typically Razorpay payload sends an `x-razorpay-event-id` header
    // We will use a combination of event name and payment ID for idempotency if header missing
    const eventId = req.headers.get("x-razorpay-event-id") || `evt_${payload.payload?.payment?.entity?.id}_${eventName}`;

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
    const paymentEntity = payload.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;

    if (!razorpayOrderId) {
      return NextResponse.json({ success: true, message: "No order ID present" });
    }

    if (eventName === "payment.captured" || eventName === "order.paid") {
      // Serves as a backup to mark order PAID when the client callback
      // (/api/payments/verify) failed or the user closed the tab before redirect.
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
            try {
              await db.deductStock(dbOrder.cart_items || [], dbOrder.idempotency_key);
            } catch (e) {
              console.error("[webhook] deductStock failed:", e);
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
    } else if (eventName === "payment.failed") {
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
    }

    // 4. Mark processed
    if (supabase) {
      await supabase.from("webhook_logs").update({ processed: true }).eq("event_id", eventId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
