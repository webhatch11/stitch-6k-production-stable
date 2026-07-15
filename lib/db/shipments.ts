/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { DEFAULT_PICKUP_LOCATION } from "./constants";
import { shiprocket } from "../shiprocket";
import { ordersDb } from "./orders";
import { Shipment, ShipmentEvent } from "../types";

export async function getShipmentByOrderId(orderId: string): Promise<Shipment | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("shipments")
    .select("id, order_id, shiprocket_order_id, shipment_id, awb_code, courier_name, status, created_at, updated_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching shipment from Supabase:", error);
    return null;
  }
  return data;
}

export async function getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("shipment_events")
    .select("id, shipment_id, status, activity, location, timestamp")
    .eq("shipment_id", shipmentId)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Error fetching shipment events from Supabase:", error);
    return [];
  }
  return data || [];
}

export async function saveShipment(shipment: Partial<Shipment>): Promise<Shipment> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const payload = {
    order_id: shipment.order_id,
    shiprocket_order_id: shipment.shiprocket_order_id,
    shipment_id: shipment.shipment_id,
    awb_code: shipment.awb_code,
    courier_name: shipment.courier_name,
    status: shipment.status,
    etd: shipment.etd,
    weight: shipment.weight,
    dimensions_length: shipment.dimensions_length || 30,
    dimensions_width: shipment.dimensions_width || 22,
    dimensions_height: shipment.dimensions_height || 5,
    updated_at: new Date().toISOString(),
  };

  if (shipment.id) {
    (payload as any).id = shipment.id;
  }

  const { data, error } = await supabase
    .from("shipments")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error saving shipment to Supabase:", error);
    throw error;
  }
  return data;
}

export async function saveShipmentEvent(event: Partial<ShipmentEvent>): Promise<ShipmentEvent> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const payload = {
    shipment_id: event.shipment_id,
    status: event.status,
    activity: event.activity,
    location: event.location,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  if (event.id) {
    (payload as any).id = event.id;
  }

  const { data, error } = await supabase
    .from("shipment_events")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error saving shipment event to Supabase:", error);
    throw error;
  }
  return data;
}

export async function saveTrackingLog(log: { shipment_id: string; raw_payload: any }): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { error } = await supabase
    .from("tracking_logs")
    .insert({
      shipment_id: log.shipment_id,
      raw_payload: log.raw_payload,
    });

  if (error) {
    console.error("Error saving tracking log to Supabase:", error);
  }
}

export async function getTrackingLogs(limit: number = 100): Promise<any[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("tracking_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Error fetching tracking logs:", error);
    return [];
  }
  return data || [];
}

export async function dispatchFulfillment(
  orderId: string
): Promise<{ success: boolean; status: "CREATED" | "RETRYING"; error?: string }> {
  try {
    const order = await ordersDb.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

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

    const useCartItems = Array.isArray(order.cartItems) && order.cartItems.length > 0;
    const quantity = useCartItems
      ? order.cartItems!.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
      : order.items.length || 1;
    const orderItems = useCartItems
      ? order.cartItems!.map((item: any, idx: number) => {
          const name = item.productName || item.title || "Luxury Atelier Shirt";
          const sku = item.productId
            ? `SKU-${item.productId}-${item.size || "M"}-${item.color || "Default"}`
            : `SKU-${name.toUpperCase().substring(0, 5).replace(/\s+/g, "")}-${idx}`;
          return {
            name,
            sku,
            units: item.quantity || 1,
            selling_price: Number(item.price || Math.round(order.total / quantity)),
          };
        })
      : order.items.map((itemStr: any, idx: number) => {
          const name = typeof itemStr === "string" ? itemStr : itemStr.productName || itemStr.title || "Luxury Atelier Shirt";
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

    if (!result.success) {
      try {
        const { Queue } = await import("bullmq");
        const redisUrlStr = process.env.REDIS_URL || "redis://localhost:6379";
        const redisUrl = new URL(redisUrlStr);
        const connectionOptions = {
          host: redisUrl.hostname,
          port: Number(redisUrl.port) || 6379,
          password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
          tls: redisUrl.protocol === "rediss:" ? {} : undefined,
          maxRetriesPerRequest: null,
        };
        const retryQueue = new Queue("shipment-retry", { connection: connectionOptions });
        await retryQueue.add("retry_shipment", { orderId }, { delay: 5 * 60 * 1000 });
        await retryQueue.close();
      } catch (queueErr) {
        console.error("[Dispatch] Failed to queue retry job:", queueErr);
      }

      await saveShipment({
        order_id: order.id,
        shiprocket_order_id: "",
        shipment_id: "",
        awb_code: `RETRY-AWB-${order.id}`,
        courier_name: "Shiprocket Partner Courier",
        status: "RETRYING",
        weight,
        dimensions_length: length,
        dimensions_width: width,
        dimensions_height: height,
      });

      await ordersDb.createOrderEvent(order.id, "Shipment Failed - Retrying");

      return { success: false, status: "RETRYING", error: result.error };
    }

    await saveShipment({
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

    await ordersDb.createOrderEvent(order.id, "Shipment Created");
    await ordersDb.createOrderEvent(order.id, "AWB Generated");

    let labelUrl: string | null = null;
    let manifestUrl: string | null = null;

    if (result.shipmentId) {
      try {
        const shipmentIdNum = Number(result.shipmentId);
        const labelRes = await shiprocket.generateShippingLabel(shipmentIdNum);
        if (labelRes.success && labelRes.labelUrl) {
          labelUrl = labelRes.labelUrl;

          const manifestRes = await shiprocket.generateManifest(shipmentIdNum);
          if (manifestRes.success && manifestRes.manifestUrl) {
            manifestUrl = manifestRes.manifestUrl;
          }

          const { supabase } = loadService();
          if (supabase) {
            await supabase
              .from("shipments")
              .update({
                label_url: labelUrl,
                manifest_url: manifestUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("order_id", order.id);
          }

          await ordersDb.createOrderEvent(order.id, "Shipping label generated. AWB: " + result.awbCode);
        } else {
          console.error("[Dispatch] Shipping label generation failed:", labelRes.error);
        }
      } catch (labelErr) {
        console.error("[Dispatch] Error generating shipping label/manifest:", labelErr);
      }
    }

    const updatedOrder = { ...order, status: "Shipped", shiprocketId: result.awbCode || "" };
    await ordersDb.saveOrder(updatedOrder);

    try {
      await ordersDb.addOrderStatusHistory(order.id, "Shipped", "Fulfillment dispatched via Shiprocket", {
        awb: result.awbCode || "",
        courier: result.courierName || "",
      });
    } catch (historyErr) {
      console.error("[Dispatch] Failed to add order status history:", historyErr);
    }

    try {
      const snapEmail = order.address_snapshot?.email;
      const snapName = order.address_snapshot?.name || order.customer;
      if (snapEmail) {
        const { sendShippingConfirmationEmail } = await import("../email");
        const etdDate = result.etd
          ? new Date(result.etd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

        const items = Array.isArray(order.cartItems)
          ? order.cartItems.map((item: any) => ({
              name: item.productName || item.title || "Luxury Atelier Shirt",
              quantity: item.quantity || 1,
            }))
          : order.items.map((itemStr: any) => ({
              name: typeof itemStr === "string" ? itemStr : itemStr.productName || itemStr.title || "Luxury Atelier Shirt",
              quantity: 1,
            }));

        const trackingUrl =
          (process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com") + "/ordertracking?orderId=" + order.id;

        await sendShippingConfirmationEmail({
          to: snapEmail,
          customerName: snapName,
          orderId: order.id,
          awbCode: result.awbCode || "PENDING",
          courierName: result.courierName || "Shiprocket Partner Courier",
          estimatedDelivery: etdDate,
          items,
          trackingUrl,
        });
      }
    } catch (emailErr) {
      console.error("[Dispatch] Failed to send shipping confirmation email:", emailErr);
    }

    return { success: true, status: "CREATED" };
  } catch (e: any) {
    console.error("[Dispatch] Unhandled dispatch exception:", e);
    await saveShipment({
      order_id: orderId,
      shiprocket_order_id: "",
      shipment_id: "",
      awb_code: `RETRY-AWB-${orderId}`,
      courier_name: "Shiprocket Partner Courier",
      status: "RETRYING",
    });

    await ordersDb.createOrderEvent(orderId, "Shipment Failed - Retrying");

    try {
      const { Queue } = await import("bullmq");
      const redisUrlStr = process.env.REDIS_URL || "redis://localhost:6379";
      const redisUrl = new URL(redisUrlStr);
      const connectionOptions = {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
        tls: redisUrl.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null,
      };
      const retryQueue = new Queue("shipment-retry", { connection: connectionOptions });
      await retryQueue.add("retry_shipment", { orderId }, { delay: 5 * 60 * 1000 });
      await retryQueue.close();
    } catch (queueErr) {
      console.error("[Dispatch] Failed to queue retry job:", queueErr);
    }

    return { success: false, status: "RETRYING", error: e.message };
  }
}

export const shipmentsDb = {
  getShipmentByOrderId,
  getShipmentEvents,
  saveShipment,
  saveShipmentEvent,
  saveTrackingLog,
  getTrackingLogs,
  dispatchFulfillment,
};
