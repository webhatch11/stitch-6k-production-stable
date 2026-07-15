import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";

// Shiprocket webhooks are authenticated with a pre-shared token: set the same
// value in the Shiprocket dashboard (Settings → API → Webhooks, sent as the
// `x-api-key` header) and in the SHIPROCKET_WEBHOOK_TOKEN env var.
function verifyWebhookToken(req: NextRequest): boolean {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
  if (!expected) {
    // No token configured: reject in production, allow in dev for local testing.
    if (process.env.NODE_ENV === "production") {
      console.error("[Shiprocket Webhook] SHIPROCKET_WEBHOOK_TOKEN not configured. Refusing all webhooks.");
      return false;
    }
    console.warn("[Shiprocket Webhook] SHIPROCKET_WEBHOOK_TOKEN not set — accepting unauthenticated webhook (dev only).");
    return true;
  }
  const provided = req.headers.get("x-api-key") || req.headers.get("x-shiprocket-token") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyWebhookToken(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { awb, current_status, current_status_code, etd, scans } = body;

    if (!awb || !current_status) {
      return NextResponse.json({ success: false, error: "Missing required parameters: awb or current_status" }, { status: 400 });
    }

    // Find the order matching the AWB number (indexed lookup)
    const order = await db.getOrderByAwb(awb);

    if (!order) {
      console.error("Webhook: order not found for AWB:", awb);
      return NextResponse.json({ success: true, message: `Webhook processed, but no order matches AWB ${awb}.` });
    }

    // Map Shiprocket status to Stitch 6K order status
    let newStatus = order.status;
    const lowerStatus = current_status.toLowerCase();
    
    // Import admin alert function dynamically
    const { sendAdminAlert } = await import("@/lib/email");

    let eventMsg = "";
    const isNdr = lowerStatus === "ndr" || lowerStatus.includes("ndr - delivery attempt failed");
    const isRtoInitiated = lowerStatus.includes("rto initiated") || lowerStatus.includes("rto_initiated");
    const isRtoDelivered = lowerStatus.includes("rto delivered") || lowerStatus.includes("rto_delivered");
    const isPickupScheduled = lowerStatus.includes("pickup scheduled") || lowerStatus.includes("pickup generated");
    const isPickupError = lowerStatus.includes("pickup error") || lowerStatus.includes("pickup exception");
    const isInTransit = lowerStatus.includes("in transit");
    const isReturnPickupScheduled = lowerStatus.includes("return pickup scheduled");
    const isReturnPickupFailed = lowerStatus.includes("return pickup failed");

    if (isNdr) {
      eventMsg = "Delivery attempt failed. Courier will retry.";
      
      const snap = typeof order.address_snapshot === "string" ? JSON.parse(order.address_snapshot) : order.address_snapshot;
      const addrStr = snap ? `${snap.address_line_1 || ""}, ${snap.city || ""}, ${snap.state || ""} - ${snap.postal_code || ""}` : "Not Available";
      
      await sendAdminAlert({
        subject: `NDR Alert — Order #${order.id} delivery failed`,
        body: `Order ID: #${order.id}\nCustomer: ${order.customer}\nAWB: ${awb}\nDelivery Address: ${addrStr}\nAttempt Count: ${body.attempt_count || body.attempts || "1"}\nReason: ${body.ndr_reason || body.reason || "Courier could not contact customer / incorrect address"}`,
        orderId: order.id,
        awb,
      }).catch(err => console.error("[Webhook NDR Alert] Failed to send email:", err));
    } else if (isRtoInitiated) {
      newStatus = "RTO Initiated";
      eventMsg = "Package returning to warehouse — courier could not deliver.";
      
      const snap = typeof order.address_snapshot === "string" ? JSON.parse(order.address_snapshot) : order.address_snapshot;
      const addrStr = snap ? `${snap.address_line_1 || ""}, ${snap.city || ""}, ${snap.state || ""} - ${snap.postal_code || ""}` : "Not Available";

      await sendAdminAlert({
        subject: `RTO Alert — Order #${order.id} returning`,
        body: `Order ID: #${order.id}\nAWB: ${awb}\nCustomer Address: ${addrStr}\nReason: ${body.rto_reason || body.reason || "Undeliverable after multiple attempts"}`,
        orderId: order.id,
        awb,
      }).catch(err => console.error("[Webhook RTO Alert] Failed to send email:", err));
    } else if (isRtoDelivered) {
      newStatus = "RTO Delivered";
      eventMsg = "Package returned to warehouse.";
      
      await sendAdminAlert({
        subject: `RTO Delivered — Order #${order.id} back at warehouse`,
        body: `Order ID: #${order.id}\nAWB: ${awb}\nNext Steps: Package returned back to JRT TEXTILES warehouse. Please issue wallet refund or contact customer for reshipment.`,
        orderId: order.id,
        awb,
      }).catch(err => console.error("[Webhook RTO Delivered Alert] Failed to send email:", err));
    } else if (isPickupScheduled) {
      eventMsg = "Pickup scheduled by courier.";
    } else if (
      lowerStatus.includes("picked up") ||
      lowerStatus.includes("shipment picked")
    ) {
      eventMsg = "Package picked up by courier.";
    } else if (isPickupError) {
      eventMsg = "Pickup failed. Rescheduling required.";
      
      await sendAdminAlert({
        subject: `Pickup Failed — Order #${order.id}`,
        body: `Order ID: #${order.id}\nAWB: ${awb}\nWarehouse Address: Tiruchirappalli (620018)\nReason: ${body.pickup_error || body.reason || "Courier pickup failed"}`,
        orderId: order.id,
        awb,
      }).catch(err => console.error("[Webhook Pickup Error Alert] Failed to send email:", err));
    } else if (isInTransit) {
      newStatus = "Shipped";
      eventMsg = "Package in transit.";
    } else if (isReturnPickupScheduled) {
      eventMsg = "Return pickup scheduled at customer address.";
    } else if (isReturnPickupFailed) {
      eventMsg = "Return pickup attempt failed. Customer was unavailable.";
      
      const snap = typeof order.address_snapshot === "string" ? JSON.parse(order.address_snapshot) : order.address_snapshot;
      const addrStr = snap ? `${snap.address_line_1 || ""}, ${snap.city || ""}, ${snap.state || ""} - ${snap.postal_code || ""}` : "Not Available";

      await sendAdminAlert({
        subject: `Return Pickup Failed — #${order.id}`,
        body: `Order ID: #${order.id}\nReturn AWB: ${awb}\nCustomer Address: ${addrStr}\nSuggested Next Action: Reschedule return pickup or reject return request.`,
        orderId: order.id,
        awb,
      }).catch(err => console.error("[Webhook Return Pickup Error Alert] Failed to send email:", err));
    } else if (lowerStatus.includes("delivered")) {
      newStatus = "Delivered";
      eventMsg = "Package delivered to customer. Return window: 7 days.";
    } else if (lowerStatus.includes("cancelled") || lowerStatus.includes("canceled")) {
      newStatus = "Cancelled";
    } else if (lowerStatus.includes("returned")) {
      newStatus = "Returned";
    } else if (lowerStatus.includes("out for delivery")) {
      newStatus = "Shipped";
      eventMsg = "Package out for delivery.";
    }

    // Update the database order
    if (newStatus !== order.status) {
      order.status = newStatus;
      await db.saveOrder(order);
    }

    // Insert order event if defined
    if (eventMsg) {
      try {
        await db.createOrderEvent(order.id, eventMsg);
      } catch (err) {
        console.error("[Webhook] Failed to create order event:", err);
      }
    }

    // Add status history entry
    try {
      await db.addOrderStatusHistory(
        order.id,
        newStatus,
        "Shiprocket Webhook",
        {
          awb,
          current_status,
          current_status_code,
          etd,
          scans: scans || []
        }
      );
    } catch (historyErr) {
      console.warn(`[Shiprocket Webhook] Failed to add status history for order ${order.id}:`, historyErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed status update of "${current_status}" for order #${order.id}.`
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Shiprocket Webhook] Error processing tracking webhook:", error);
    // Never return error status to Shiprocket webhooks, always 200
    return NextResponse.json({ success: true, error: message || "Internal server error" });
  }
}
