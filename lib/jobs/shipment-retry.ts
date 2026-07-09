import { Worker, Queue } from "bullmq";
import { db } from "../../lib/db";
import { shiprocket } from "../../lib/shiprocket";
import IORedis from "ioredis";

const DEFAULT_PICKUP_LOCATION = 
  process.env.SHIPROCKET_PICKUP_LOCATION || 
  "Primary Warehouse";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const RETRY_DELAYS = [
  5 * 60 * 1000,   // 5 mins
  15 * 60 * 1000,  // 15 mins
  30 * 60 * 1000,  // 30 mins
  60 * 60 * 1000,  // 60 mins
];

export const shipmentRetryWorker = new Worker(
  "shipment-retry",
  async (job) => {
    if (job.name === "retry_shipment") {
      const { orderId } = job.data;
      console.log(`[Shipment Retry Worker] Attempting shipment retry for order: ${orderId}. Attempt: ${job.attemptsMade + 1}`);

      try {
        const orders = await db.getOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) {
          console.error(`[Shipment Retry Worker] Order ${orderId} not found.`);
          return;
        }

        // Use the address captured at checkout time — no fallback or name-matching
        const snap = order.address_snapshot;
        if (!snap) {
          throw new Error(`Order ${orderId} has no address_snapshot — cannot dispatch without a verified delivery address`);
        }
        const shippingAddress = {
          name: snap.name || order.customer,
          phone: snap.phone || "",
          address_line_1: snap.address_line_1 || "",
          address_line_2: snap.address_line_2 || "",
          city: snap.city || "",
          state: snap.state || "",
          postal_code: snap.postal_code || "",
          country: snap.country || "India",
          email: snap.email || "",
        };

        const quantity = order.items.length || 1;
        const orderItems = order.items.map((itemStr: any, idx: number) => {
          const name = typeof itemStr === "string" ? itemStr : (itemStr.productName || itemStr.title || "Luxury Atelier Shirt");
          const sku = `SKU-${name.toUpperCase().substring(0, 5).replace(/\s+/g, "")}-${idx}`;
          return {
            name,
            sku,
            units: 1,
            selling_price: Math.round(order.total / quantity),
          };
        });

        const weight = 0.4 * quantity;
        const length = 30;
        const width = 22;
        const height = Math.max(5, 5 * quantity);

        const shiprocketPayload = {
          order_id: order.id,
          order_date: new Date().toISOString().split("T")[0],
          pickup_location: DEFAULT_PICKUP_LOCATION,
          billing_customer_name: shippingAddress.name.split(" ")[0] || "Customer",
          billing_last_name: shippingAddress.name.split(" ").slice(1).join(" ") || "Atelier",
          billing_address: shippingAddress.address_line_1,
          billing_address_2: shippingAddress.address_line_2,
          billing_city: shippingAddress.city,
          billing_pincode: shippingAddress.postal_code,
          billing_state: shippingAddress.state,
          billing_country: shippingAddress.country,
          billing_email: shippingAddress.email,
          billing_phone: shippingAddress.phone,
          shipping_is_billing: true,
          order_items: orderItems,
          payment_method: "Prepaid" as const,
          sub_total: order.total,
          length,
          width,
          height,
          weight,
        };

        const result = await shiprocket.createAndDispatchOrder(shiprocketPayload);

        if (result.success) {
          // Success! Update shipment details to CREATED
          await db.saveShipment({
            order_id: order.id,
            shiprocket_order_id: String(result.shiprocketOrderId || ""),
            shipment_id: String(result.shipmentId || ""),
            awb_code: result.awbCode || "",
            courier_name: result.courierName || "Shiprocket Partner Courier",
            status: "CREATED",
            weight,
            dimensions_length: length,
            dimensions_width: width,
            dimensions_height: height,
          });

          await db.createOrderEvent(order.id, "Shipment Created");
          await db.createOrderEvent(order.id, "AWB Generated");

          // Save order awb
          const updatedOrder = { ...order, shiprocketId: result.awbCode || "" };
          await db.saveOrder(updatedOrder);

          console.log(`[Shipment Retry Worker] Shipment retry succeeded for order ${orderId}`);
          return;
        }

        throw new Error(result.error || "Shiprocket API rejected adhoc creation");

      } catch (error: any) {
        console.warn(`[Shipment Retry Worker] Attempt failed: ${error.message}`);
        
        const attemptsMade = job.attemptsMade + 1;
        if (attemptsMade < RETRY_DELAYS.length) {
          const nextDelay = RETRY_DELAYS[attemptsMade];
          console.log(`[Shipment Retry Worker] Scheduling next retry in ${nextDelay / (60 * 1000)} minutes.`);

          const retryQueue = new Queue("shipment-retry", { connection: connection as any });
          await retryQueue.add("retry_shipment", { orderId }, { delay: nextDelay });
          await retryQueue.close();

          await db.saveShipment({
            order_id: orderId,
            status: "RETRYING",
          });
        } else {
          console.error(`[Shipment Retry Worker] All shipment retry attempts failed for order ${orderId}. Marking FAILED.`);
          
          await db.saveShipment({
            order_id: orderId,
            status: "FAILED",
          });

          await db.createOrderEvent(orderId, "Shipment Failed - Max Retries");
        }
      }
    }
  },
  { connection: connection as any }
);

import * as Sentry from "@sentry/nextjs";

shipmentRetryWorker.on("completed", (job) => {
  console.log(`[Shipment Retry Worker] Job ${job.id} completed successfully`);
});
shipmentRetryWorker.on("failed", (job, err) => {
  console.error(`[Shipment Retry Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "shipment-retry" },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
    },
  });
});
