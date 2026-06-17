import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { awb, current_status, current_status_code, etd, scans } = body;

    if (!awb || !current_status) {
      return NextResponse.json({ success: false, error: "Missing required parameters: awb or current_status" }, { status: 400 });
    }

    console.log(`[Shiprocket Webhook] Received tracking update for AWB: ${awb}, Status: ${current_status}`);

    // Find the order matching the AWB number
    const orders = await db.getOrders();
    const order = orders.find((o) => o.shiprocketId === awb);

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

      if (supabase) {
        await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", order.id);
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

  } catch (error: any) {
    console.error("[Shiprocket Webhook] Error processing tracking webhook:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
