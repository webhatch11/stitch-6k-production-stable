import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiprocket } from "@/lib/shiprocket";
import { supabase } from "@/lib/supabase";
import { ShipmentEvent } from "@/lib/registry";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");
    const awb = searchParams.get("awb");

    if (!orderId && !awb) {
      return NextResponse.json(
        { success: false, error: "Missing parameter: orderId or awb" },
        { status: 400 }
      );
    }

    let order = null;
    const orders = await db.getOrders();

    if (orderId) {
      order = orders.find((o) => o.id.toUpperCase() === orderId.toUpperCase());
    } else if (awb) {
      order = orders.find((o) => o.shiprocketId === awb);
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // Attempt to retrieve shipment from database
    let shipment = await db.getShipmentByOrderId(order.id);
    let events: ShipmentEvent[] = [];

    // If shipment is not in database but order has AWB, create shipment record
    if (!shipment && order.shiprocketId) {
      try {
        shipment = await db.saveShipment({
          order_id: order.id,
          awb_code: order.shiprocketId,
          courier_name: "Shiprocket Express Partner",
          status: order.status,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[Track API] Failed to auto-create shipment record:", err);
      }
    }

    if (shipment) {
      events = await db.getShipmentEvents(shipment.id);

      // Trigger live tracking sync if AWB exists
      if (shipment.awb_code) {
        const trackData = await shiprocket.trackShipment(shipment.awb_code);
        if (trackData && trackData.success) {
          const currentStatus = trackData.current_status;
          const scans = trackData.scans || [];
          const etd = trackData.etd;

          // Map status
          let mappedStatus = order.status;
          const lowerStatus = currentStatus.toLowerCase();

          if (lowerStatus.includes("delivered")) {
            mappedStatus = "Delivered";
          } else if (lowerStatus.includes("out for delivery") || lowerStatus.includes("out_for_delivery")) {
            mappedStatus = "Out for Delivery";
          } else if (lowerStatus.includes("transit") || lowerStatus.includes("shipped")) {
            mappedStatus = "Shipped";
          } else if (lowerStatus.includes("packed") || lowerStatus.includes("manifest")) {
            mappedStatus = "Packed";
          } else if (lowerStatus.includes("placed") || lowerStatus.includes("confirmed")) {
            mappedStatus = "Order Placed";
          } else if (lowerStatus.includes("return") || lowerStatus.includes("rto")) {
            mappedStatus = "Returned";
          } else if (lowerStatus.includes("cancel")) {
            mappedStatus = "Cancelled";
          }

          // Update DB if status changed
          if (mappedStatus !== order.status) {
            order.status = mappedStatus;
            await db.saveOrder(order);
            await db.addOrderStatusHistory(order.id, mappedStatus, "Shiprocket Live Tracking Query", {
              awb: shipment.awb_code,
              current_status: currentStatus,
            });
          }

          if (mappedStatus !== shipment.status || etd !== shipment.etd) {
            shipment.status = mappedStatus;
            if (etd) shipment.etd = etd;
            await db.saveShipment(shipment);
          }

          // Save tracking log
          await db.saveTrackingLog({
            shipment_id: shipment.id,
            raw_payload: trackData,
          });

          // Insert new scans as events
          if (scans && scans.length > 0) {
            for (const scan of scans) {
              const activity = scan.activity || "";
              const location = scan.location || "";
              const timestamp = scan.date || new Date().toISOString();

              const exists = events.some(
                (e) =>
                  e.status === scan.status ||
                  (e.activity === activity && e.timestamp === timestamp)
              );

              if (!exists) {
                const newEv = await db.saveShipmentEvent({
                  shipment_id: shipment.id,
                  status: mappedStatus,
                  activity: activity,
                  location: location,
                  timestamp: timestamp,
                });
                events.push(newEv);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      order,
      shipment: shipment || {
        order_id: order.id,
        status: order.status,
        courier_name: "Self-Fulfillment",
        awb_code: order.shiprocketId || "PENDING",
      },
      events: events.length > 0 ? events : null,
      orderEvents: await db.getOrderEvents(order.id),
    });

  } catch (err: any) {
    console.error("[Track API] Unhandled exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
