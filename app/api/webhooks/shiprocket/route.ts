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

    console.log(`[Shiprocket Webhook] Received tracking update for AWB: ${awb}, Status: ${current_status}`);

    // Find the order matching the AWB number (indexed lookup)
    const order = await db.getOrderByAwb(awb);

    if (!order) {
      console.warn(`[Shiprocket Webhook] No matching order found for AWB: ${awb}`);
      return NextResponse.json({ success: true, message: `Webhook processed, but no order matches AWB ${awb}.` });
    }

    // Map Shiprocket status to Stitch 6K order status
    let newStatus = order.status;
    const lowerStatus = current_status.toLowerCase();

    if (lowerStatus.includes("delivered")) {
      newStatus = "Delivered";
    } else if (lowerStatus.includes("cancelled") || lowerStatus.includes("canceled")) {
      newStatus = "Cancelled";
    } else if (lowerStatus.includes("returned") || lowerStatus.includes("rto delivered")) {
      newStatus = "Returned";
    } else if (lowerStatus.includes("out for delivery")) {
      // Custom intermediary statuses can be added if supported by db schema status constraints
      // Standard schema statuses: 'Pending', 'Paid', 'Shipped', 'Delivered', 'Returned', 'Cancelled'
      // We will keep it as 'Shipped' but log the exact event detail.
      newStatus = "Shipped";
    }

    // Update the database order
    if (newStatus !== order.status) {
      order.status = newStatus;
      await db.saveOrder(order);
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
    return NextResponse.json({ success: false, error: message || "Internal server error" }, { status: 500 });
  }
}
