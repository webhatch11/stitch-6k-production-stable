import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiprocket } from "@/lib/shiprocket";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { getServerUser } from "@/lib/supabase-server";
import { ShipmentEvent } from "@/lib/types";
import { CacheService } from "@/lib/cache";

// Only the fields the tracking UI needs — never the full order row, which
// contains the address snapshot, contact details and payment breakdown.
function sanitizeOrderForTracking(order: any) {
  return {
    id: order.id,
    status: order.status,
    date: order.date,
    items: order.items,
    shiprocketId: order.shiprocketId || null,
    returnRequestDate: order.returnRequestDate || null,
    returnReason: order.returnReason || null,
    returnImage: order.returnImage || null,
    returnDate: order.returnDate || null,
    refundOption: order.refundOption || null,
  };
}

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

    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in to track orders." },
        { status: 401 }
      );
    }

    // Indexed lookups — never scan the whole orders table per request
    let order = null;
    if (orderId) {
      order = (await db.getOrderById(orderId)) || (await db.getOrderById(orderId.toUpperCase()));
    } else if (awb) {
      order = await db.getOrderByAwb(awb);
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // Ownership check: customers can only track their own orders. Respond 404
    // (not 403) so order IDs cannot be enumerated.
    const orderOwnerId = (order as any).user_id || (order as any).userId;
    if (user.role !== "admin" && (!orderOwnerId || orderOwnerId !== user.id)) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    const cacheKey = `tracking:${order.id}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
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
          const isReturnFlow = ["Return Requested", "Return in Transit", "Returned"].includes(order.status);

          if (isReturnFlow) {
            if (lowerStatus.includes("delivered")) {
              mappedStatus = "Returned";
            } else if (
              lowerStatus.includes("transit") ||
              lowerStatus.includes("shipped") ||
              lowerStatus.includes("out for delivery") ||
              lowerStatus.includes("out_for_delivery") ||
              lowerStatus.includes("packed") ||
              lowerStatus.includes("manifest")
            ) {
              mappedStatus = "Return in Transit";
            } else if (lowerStatus.includes("placed") || lowerStatus.includes("confirmed")) {
              mappedStatus = "Return Requested";
            } else if (lowerStatus.includes("return") || lowerStatus.includes("rto")) {
              mappedStatus = "Returned";
            } else if (lowerStatus.includes("cancel")) {
              mappedStatus = "Cancelled";
            }
          } else {
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
          }

          // Update DB if status changed
          if (mappedStatus !== order.status) {
            await db.transitionOrderStatus(order.id, mappedStatus, {
              triggerSource: "Shiprocket Live Tracking Query",
              userOrAdmin: "system",
              reason: `Status mapped to ${mappedStatus} from ${currentStatus}`
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

    const responseData = {
      success: true,
      order: sanitizeOrderForTracking(order),
      shipment: shipment || {
        order_id: order.id,
        status: order.status,
        courier_name: "Self-Fulfillment",
        awb_code: order.shiprocketId || "PENDING",
      },
      events: events.length > 0 ? events : null,
      orderEvents: await db.getOrderEvents(order.id),
    };

    await CacheService.set(cacheKey, responseData, 300);

    return NextResponse.json(responseData);

  } catch (err: unknown) {
    console.error("[Track API] Unhandled exception:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tracking information. Please try again." },
      { status: 500 }
    );
  }
}
