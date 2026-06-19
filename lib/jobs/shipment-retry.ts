import { Worker, Queue } from "bullmq";
import { db } from "../../lib/db";
import { shiprocket } from "../../lib/shiprocket";
import IORedis from "ioredis";

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

        // Resolve shipping address
        let shippingAddress = {
          name: order.customer,
          phone: "+91 9876543210",
          address_line_1: "Apt 402, Sky-High Residency",
          address_line_2: "7th Main, Sector 4, HSR Layout",
          city: "Bengaluru",
          state: "Karnataka",
          postal_code: "560102",
          country: "India",
          email: `${order.customer.toLowerCase().replace(/\s+/g, ".")}@example.com`
        };

        try {
          const addresses = await db.getUserAddresses();
          const userAddr = addresses.find(a => a.name.toLowerCase() === order.customer.toLowerCase() || a.is_default);
          if (userAddr) {
            shippingAddress = {
              name: userAddr.name || order.customer,
              phone: userAddr.phone || "+91 9876543210",
              address_line_1: userAddr.address_line_1 || "Apt 402, Sky-High Residency",
              address_line_2: userAddr.address_line_2 || "7th Main, Sector 4, HSR Layout",
              city: userAddr.city || "Bengaluru",
              state: userAddr.state || "Karnataka",
              postal_code: userAddr.postal_code || "560102",
              country: userAddr.country || "India",
              email: `${(userAddr.name || order.customer).toLowerCase().replace(/\s+/g, ".")}@example.com`
            };
          }
        } catch (err) {
          console.warn("[Shipment Retry Worker] Address resolution failed:", err);
        }

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
          pickup_location: "Varanasi Workshop",
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

          const retryQueue = new Queue("shipment-retry", { connection });
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
  { connection }
);
