import { Worker, Queue } from "bullmq";
import { shiprocket } from "@/lib/shiprocket";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import IORedis from "ioredis";

let connection: IORedis | null = null;
try {
  if (process.env.REDIS_URL) {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    connection.on("error", (err) => {
      console.warn("[Shipment Sync Worker] Redis connection error:", err.message);
    });
  }
} catch (e) {
  console.warn("[Shipment Sync Worker] Failed to connect to Redis:", e);
}

export const shipmentSyncWorker = connection
  ? new Worker(
      "shipment-sync",
      async (job) => {
        if (job.name === "sync_active_shipments") {
          console.log("[Shipment Sync Worker] Running active shipments sync...");

          try {
            // Get all orders that have a shipment tracking code and are not finalized
            const orders = await db.getOrders();
            const activeOrders = orders.filter(
              (o) =>
                o.shiprocketId &&
                o.shiprocketId.trim() !== "" &&
                !["Delivered", "Returned", "Cancelled", "Expired"].includes(o.status)
            );

            console.log(`[Shipment Sync Worker] Found ${activeOrders.length} active shipments to track.`);

            for (const order of activeOrders) {
              try {
                const awbCode = order.shiprocketId!;
                console.log(`[Shipment Sync Worker] Tracking AWB: ${awbCode} for Order: ${order.id}`);
                
                const trackData = await shiprocket.trackShipment(awbCode);
                if (!trackData || !trackData.success) {
                  console.warn(`[Shipment Sync Worker] Failed to track AWB ${awbCode}:`, trackData?.error || "Unknown error");
                  continue;
                }

                const currentStatus = trackData.current_status || "";
                const scans = trackData.scans || [];
                const etd = trackData.etd;

                // Map Shiprocket status to Stitch 6K order status
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

                // If status changed, save it
                if (mappedStatus !== order.status) {
                  console.log(`[Shipment Sync Worker] Status updated for order ${order.id}: ${order.status} -> ${mappedStatus}`);
                  order.status = mappedStatus;
                  await db.saveOrder(order);

                  // Update order history
                  await db.addOrderStatusHistory(
                    order.id,
                    mappedStatus,
                    "Shiprocket Auto-Sync Worker",
                    {
                      awb: awbCode,
                      current_status: currentStatus,
                      etd,
                      scans
                    }
                  );
                }

                // Update shipments table and events
                let shipment = await db.getShipmentByOrderId(order.id);
                if (!shipment) {
                  // Create shipment if it doesn't exist
                  shipment = await db.saveShipment({
                    order_id: order.id,
                    awb_code: awbCode,
                    courier_name: trackData.isMock ? "Shiprocket Premium Express (Mock)" : "Shiprocket Partner Courier",
                    status: mappedStatus,
                    etd: etd,
                  });
                } else {
                  // Update existing shipment status
                  shipment.status = mappedStatus;
                  if (etd) shipment.etd = etd;
                  await db.saveShipment(shipment);
                }

                // Save raw payload in tracking logs
                await db.saveTrackingLog({
                  shipment_id: shipment.id,
                  raw_payload: trackData,
                });

                // Clear/insert events from scans
                if (scans && scans.length > 0) {
                  const existingEvents = await db.getShipmentEvents(shipment.id);
                  for (const scan of scans) {
                    const activity = scan.activity || "";
                    const location = scan.location || "";
                    const timestamp = scan.date || new Date().toISOString();
                    
                    const eventExists = existingEvents.some(
                      (e) =>
                        e.status === scan.status ||
                        (e.activity === activity && e.timestamp === timestamp)
                    );

                    if (!eventExists) {
                      await db.saveShipmentEvent({
                        shipment_id: shipment.id,
                        status: mappedStatus,
                        activity: activity,
                        location: location,
                        timestamp: timestamp,
                      });
                    }
                  }
                }

              } catch (orderErr) {
                console.error(`[Shipment Sync Worker] Error tracking order ${order.id}:`, orderErr);
              }
            }
          } catch (err) {
            console.error("[Shipment Sync Worker] Unhandled exception in sync loop:", err);
          }
        }
      },
      { connection: connection as any }
    )
  : null;

if (shipmentSyncWorker) {
  shipmentSyncWorker.on("completed", (job) => {
    console.log(`[Shipment Sync Worker] Job ${job.id} completed successfully`);
  });
  shipmentSyncWorker.on("failed", (job, err) => {
    console.error(`[Shipment Sync Worker] Job ${job?.id} failed:`, err);
  });
}
