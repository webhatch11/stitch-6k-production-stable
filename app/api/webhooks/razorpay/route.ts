import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
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
      // In case client callback `/api/payments/verify` failed or user closed tab before redirect,
      // webhook serves as a backup to mark order PAID.
      if (supabase) {
        const { data: order } = await supabase.from("orders").select("id, status").eq("razorpay_order_id", razorpayOrderId).single();
        if (order && order.status !== "PAID") {
          await supabase.from("orders").update({ payment_status: "PAID", status: "PAID" }).eq("id", order.id);
          await db.saveOrder({ id: order.id, status: "PAID" });

          // Log payment transition
          const { data: payment } = await supabase.from("payments").select("id").eq("order_id", order.id).single();
          if (payment) {
            await supabase.from("payment_logs").insert({
              payment_id: payment.id,
              previous_status: "CREATED",
              new_status: "CAPTURED",
              metadata: { event: eventName, source: "webhook" }
            });
            await supabase.from("payments").update({ status: "CAPTURED", razorpay_payment_id: razorpayPaymentId }).eq("id", payment.id);
          }
        }
      }
    } else if (eventName === "payment.failed") {
      if (supabase) {
        const { data: order } = await supabase.from("orders").select("id, status").eq("razorpay_order_id", razorpayOrderId).single();
        if (order && order.status !== "PAID") {
          await supabase.from("orders").update({ payment_status: "FAILED", status: "FAILED" }).eq("id", order.id);
          await db.saveOrder({ id: order.id, status: "FAILED" });
          
          const { data: payment } = await supabase.from("payments").select("id").eq("order_id", order.id).single();
          if (payment) {
            await supabase.from("payment_logs").insert({
              payment_id: payment.id,
              previous_status: "CREATED",
              new_status: "FAILED",
              metadata: { event: eventName, reason: paymentEntity.error_description }
            });
            await supabase.from("payments").update({ status: "FAILED" }).eq("id", payment.id);
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
