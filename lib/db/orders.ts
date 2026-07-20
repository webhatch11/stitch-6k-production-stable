/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { mapDbOrderToOrder } from "./utils";
import { Order, OrderStatusHistory, OrderNote, OrderEvent } from "../types";
import { paymentDebugLog } from "../payment-debug";

export async function getOrders(userId?: string): Promise<Order[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  let query = supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, return_image_url, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, awb_code, courier_name, tracking_url")
    .gt("total", 0);
  if (userId) {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders from Supabase:", error);
    return [];
  }
  return (data || []).map(mapDbOrderToOrder);
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  return getOrders(userId);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  return getOrderById(orderId);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, return_image_url, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, awb_code, courier_name, tracking_url")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching order by id ${orderId}:`, error);
    return null;
  }
  return data ? mapDbOrderToOrder(data) : null;
}

export async function getOrderByIdempotencyKey(key: string): Promise<Order | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, return_image_url, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, awb_code, courier_name, tracking_url")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching order by idempotency key ${key}:`, error);
    return null;
  }
  return data ? mapDbOrderToOrder(data) : null;
}

export async function getOrderByAwb(awb: string): Promise<Order | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, return_image_url, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, awb_code, courier_name, tracking_url")
    .or(`shiprocket_id.eq.${awb},return_awb.eq.${awb}`)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching order by AWB ${awb}:`, error);
    return null;
  }
  return data ? mapDbOrderToOrder(data) : null;
}

export async function saveOrder(order: Partial<Order>): Promise<Order> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  let orderId = order.id || "ORD-" + Math.floor(Math.random() * 9000 + 1000);
  const isNew = !order.id || !order.id.startsWith("6K-");

  const { data: existingOrder, error: fetchError } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, return_image_url, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, awb_code, courier_name, tracking_url")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching order to save:", fetchError);
  }

  const isExisting = !!existingOrder;
  if (!isExisting && isNew) {
    const pm =
      (order.gatewayPaid && order.gatewayPaid > 0) || order.razorpay_payment_id || (order as any).razorpay_order_id
        ? "razorpay"
        : "wallet";
    orderId = await generateOrderId(pm);
  }

  const dbPayload: any = {};
  dbPayload.id = orderId;
  if (order.customer !== undefined) dbPayload.customer = order.customer;
  if (order.date !== undefined) dbPayload.date = order.date;
  if (order.total !== undefined) dbPayload.total = order.total;
  if (order.status !== undefined) dbPayload.status = order.status;
  if (order.items !== undefined) dbPayload.items = order.items;
  if (order.originalTotal !== undefined) dbPayload.original_total = order.originalTotal;
  if (order.couponDiscount !== undefined) dbPayload.coupon_discount = order.couponDiscount;
  if (order.couponCode !== undefined) dbPayload.coupon_code = order.couponCode ? order.couponCode.trim().toUpperCase() : "";
  if (order.walletPaid !== undefined) dbPayload.wallet_paid = order.walletPaid;
  if (order.gatewayPaid !== undefined) dbPayload.gateway_paid = order.gatewayPaid;
  if (order.pointsRedeemed !== undefined) dbPayload.points_redeemed = order.pointsRedeemed;
  if (order.pointsDiscount !== undefined) dbPayload.points_discount = order.pointsDiscount;
  if (order.pointsEarned !== undefined) dbPayload.points_earned = order.pointsEarned;
  if (order.returnReason !== undefined) dbPayload.return_reason = order.returnReason;
  if (order.returnDetails !== undefined) dbPayload.return_details = order.returnDetails;
  if (order.returnImage !== undefined) dbPayload.return_image = order.returnImage;
  if (order.refundOption !== undefined) dbPayload.refund_option = order.refundOption;
  if (order.returnRequestDate !== undefined) dbPayload.return_request_date = order.returnRequestDate;
  if (order.returnDate !== undefined) dbPayload.return_date = order.returnDate;
  if (order.returnRejectReason !== undefined) dbPayload.return_reject_reason = order.returnRejectReason;
  if (order.qualityCheckPassed !== undefined) dbPayload.quality_check_passed = order.qualityCheckPassed;
  if (order.shiprocketId !== undefined) dbPayload.shiprocket_id = order.shiprocketId;
  if (order.idempotencyKey !== undefined) dbPayload.idempotency_key = order.idempotencyKey;
  if (order.cartItems !== undefined) dbPayload.cart_items = order.cartItems;
  if (order.paymentStatus !== undefined) dbPayload.payment_status = order.paymentStatus;
  if (order.pointsCreditStatus !== undefined) dbPayload.points_credit_status = order.pointsCreditStatus;
  if (order.pointsCreditScheduledAt !== undefined) dbPayload.points_credit_scheduled_at = order.pointsCreditScheduledAt;
  if (order.userId !== undefined || order.user_id !== undefined) dbPayload.user_id = order.userId || order.user_id;
  if (order.address_snapshot !== undefined) dbPayload.address_snapshot = order.address_snapshot;
  if (order.deliveredAt !== undefined || order.delivered_at !== undefined) dbPayload.delivered_at = order.deliveredAt || order.delivered_at;
  if (order.returnAwb !== undefined || order.return_awb !== undefined) dbPayload.return_awb = order.returnAwb || order.return_awb;
  if (order.returnPickupScheduled !== undefined || order.return_pickup_scheduled !== undefined) dbPayload.return_pickup_scheduled = order.returnPickupScheduled || order.return_pickup_scheduled;
  if (order.utmSource !== undefined || order.utm_source !== undefined) dbPayload.utm_source = order.utmSource || order.utm_source;
  if (order.utmMedium !== undefined || order.utm_medium !== undefined) dbPayload.utm_medium = order.utmMedium || order.utm_medium;
  if (order.utmCampaign !== undefined || order.utm_campaign !== undefined) dbPayload.utm_campaign = order.utmCampaign || order.utm_campaign;
  if (order.shippingAmount !== undefined || order.shipping_amount !== undefined) dbPayload.shipping_amount = order.shippingAmount ?? order.shipping_amount;
  if (order.packedAt !== undefined) dbPayload.packed_at = order.packedAt;
  if (order.acceptedAt !== undefined) dbPayload.accepted_at = order.acceptedAt;

  if (order.status && order.status.toLowerCase() === "delivered") {
    dbPayload.delivered_at = (existingOrder && existingOrder.delivered_at) || dbPayload.delivered_at || new Date().toISOString();
    dbPayload.points_credit_scheduled_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  if (isExisting) {
    const { error } = await supabase.from("orders").update(dbPayload).eq("id", orderId);
    if (error) {
      console.error("Error updating order in Supabase:", error);
      throw error;
    }
  } else {
    const insertPayload = {
      id: orderId,
      customer: order.customer || "Guest Customer",
      date: order.date || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
      total: order.total || 0,
      status: order.status || "Pending",
      items: order.items || [],
      original_total: order.originalTotal || 0,
      coupon_discount: order.couponDiscount || 0,
      coupon_code: order.couponCode ? order.couponCode.trim().toUpperCase() : "",
      wallet_paid: order.walletPaid || 0,
      gateway_paid: order.gatewayPaid || 0,
      points_redeemed: order.pointsRedeemed || 0,
      points_discount: order.pointsDiscount || 0,
      points_earned: order.pointsEarned || 0,
      idempotency_key: order.idempotencyKey || orderId,
      cart_items: order.cartItems || [],
      payment_status: order.paymentStatus || "PENDING",
      user_id: order.userId || order.user_id || null,
      address_snapshot: order.address_snapshot ?? null,
      utm_source: order.utmSource || order.utm_source || null,
      utm_medium: order.utmMedium || order.utm_medium || null,
      utm_campaign: order.utmCampaign || order.utm_campaign || null,
      shipping_amount: order.shippingAmount ?? order.shipping_amount ?? 0,
      ...dbPayload,
    };
    const { error } = await supabase.from("orders").insert(insertPayload);
    if (error) {
      console.error("Error inserting order in Supabase:", error);
      throw error;
    }
  }

  const mergedOrder: Order = {
    id: orderId,
    customer: order.customer || (existingOrder ? existingOrder.customer : "Guest Customer"),
    date: order.date || (existingOrder ? existingOrder.date : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })),
    total: order.total !== undefined ? order.total : (existingOrder ? Number(existingOrder.total) : 0),
    status: order.status || (existingOrder ? existingOrder.status : "Pending"),
    items: order.items || (existingOrder ? existingOrder.items : []),
    originalTotal: order.originalTotal !== undefined ? order.originalTotal : (existingOrder ? Number(existingOrder.original_total) : 0),
    couponDiscount: order.couponDiscount !== undefined ? order.couponDiscount : (existingOrder ? Number(existingOrder.coupon_discount) : 0),
    couponCode: order.couponCode !== undefined ? order.couponCode : (existingOrder ? existingOrder.coupon_code : ""),
    walletPaid: order.walletPaid !== undefined ? order.walletPaid : (existingOrder ? Number(existingOrder.wallet_paid) : 0),
    gatewayPaid: order.gatewayPaid !== undefined ? order.gatewayPaid : (existingOrder ? Number(existingOrder.gateway_paid) : 0),
    pointsRedeemed: order.pointsRedeemed !== undefined ? order.pointsRedeemed : (existingOrder ? Number(existingOrder.points_redeemed) : 0),
    pointsDiscount: order.pointsDiscount !== undefined ? order.pointsDiscount : (existingOrder ? Number(existingOrder.points_discount) : 0),
    pointsEarned: order.pointsEarned !== undefined ? order.pointsEarned : (existingOrder ? Number(existingOrder.points_earned) : 0),
    returnReason: order.returnReason !== undefined ? order.returnReason : (existingOrder ? existingOrder.return_reason : undefined),
    returnDetails: order.returnDetails !== undefined ? order.returnDetails : (existingOrder ? existingOrder.return_details : undefined),
    returnImage: order.returnImage !== undefined ? order.returnImage : (existingOrder ? existingOrder.return_image : undefined),
    refundOption: order.refundOption !== undefined ? order.refundOption : (existingOrder ? existingOrder.refund_option : undefined),
    returnRequestDate: order.returnRequestDate !== undefined ? order.returnRequestDate : (existingOrder ? existingOrder.return_request_date : undefined),
    returnDate: order.returnDate !== undefined ? order.returnDate : (existingOrder ? existingOrder.return_date : undefined),
    returnRejectReason: order.returnRejectReason !== undefined ? order.returnRejectReason : (existingOrder ? existingOrder.return_reject_reason : undefined),
    qualityCheckPassed: order.qualityCheckPassed !== undefined ? order.qualityCheckPassed : (existingOrder ? existingOrder.quality_check_passed : undefined),
    shiprocketId: order.shiprocketId !== undefined ? order.shiprocketId : (existingOrder ? existingOrder.shiprocket_id : undefined),
    cartItems: order.cartItems || (existingOrder ? existingOrder.cart_items : []),
    paymentStatus: order.paymentStatus || (existingOrder ? existingOrder.payment_status : "PENDING"),
    pointsCreditStatus: dbPayload.points_credit_status !== undefined ? dbPayload.points_credit_status : (existingOrder ? existingOrder.points_credit_status : "pending"),
    pointsCreditScheduledAt: dbPayload.points_credit_scheduled_at !== undefined ? dbPayload.points_credit_scheduled_at : (existingOrder ? existingOrder.points_credit_scheduled_at : null),
    address_snapshot: order.address_snapshot !== undefined ? order.address_snapshot : (existingOrder ? existingOrder.address_snapshot : null),
    delivered_at: dbPayload.delivered_at !== undefined ? dbPayload.delivered_at : (existingOrder ? existingOrder.delivered_at : undefined),
    deliveredAt: dbPayload.delivered_at !== undefined ? dbPayload.delivered_at : (existingOrder ? existingOrder.delivered_at : undefined),
    return_awb: dbPayload.return_awb !== undefined ? dbPayload.return_awb : (existingOrder ? existingOrder.return_awb : undefined),
    returnAwb: dbPayload.return_awb !== undefined ? dbPayload.return_awb : (existingOrder ? existingOrder.return_awb : undefined),
    return_pickup_scheduled: dbPayload.return_pickup_scheduled !== undefined ? dbPayload.return_pickup_scheduled : (existingOrder ? existingOrder.return_pickup_scheduled : undefined),
    returnPickupScheduled: dbPayload.return_pickup_scheduled !== undefined ? dbPayload.return_pickup_scheduled : (existingOrder ? existingOrder.return_pickup_scheduled : undefined),
    shippingAmount: order.shippingAmount !== undefined ? order.shippingAmount : (order.shipping_amount !== undefined ? order.shipping_amount : (existingOrder ? Number(existingOrder.shipping_amount) : 0)),
    shipping_amount: order.shippingAmount !== undefined ? order.shippingAmount : (order.shipping_amount !== undefined ? order.shipping_amount : (existingOrder ? Number(existingOrder.shipping_amount) : 0)),
    packedAt: order.packedAt !== undefined ? order.packedAt : (existingOrder ? existingOrder.packed_at : null),
    acceptedAt: order.acceptedAt !== undefined ? order.acceptedAt : (existingOrder ? existingOrder.accepted_at : null),
  };

  await CacheService.del("analytics:dashboard");

  return mergedOrder;
}

export async function requestManualReturn(
  orderId: string,
  payload: { reason: string; details: string; image: string; refundOption: string; imageUrl?: string }
): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, return_image_url, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, awb_code, courier_name, tracking_url")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderData) return false;
  if (orderData.status === "Returned" || orderData.status === "Return Requested") return false;

  const { error } = await supabase
    .from("orders")
    .update({
      status: "Return Requested",
      return_reason: payload.reason,
      return_details: payload.details,
      return_image: payload.image,
      return_image_url: payload.imageUrl || null,
      refund_option: payload.refundOption === "bank" ? "original_source" : payload.refundOption,
      return_request_date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
    })
    .eq("id", orderId);

  return !error;
}

export async function approveReturnPickup(orderId: string): Promise<boolean> {
  // Use transitionOrderStatus so that the state machine validation, audit log
  // (order_status_history), and timeline event (order_events) are all applied
  // consistently — a direct Supabase update bypasses all three.
  return transitionOrderStatus(orderId, "Return in Transit", {
    triggerSource: "Admin: Approve Return Pickup",
    userOrAdmin: "admin",
    reason: "Admin approved return pickup; courier notified for collection.",
  });
}

export async function rejectReturn(orderId: string, rejectReason: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { error: reasonErr } = await supabase
    .from("orders")
    .update({
      return_reject_reason: rejectReason,
    })
    .eq("id", orderId);

  if (reasonErr) {
    console.error(`[rejectReturn] Failed to update reject reason for order ${orderId}:`, reasonErr);
    return false;
  }

  return transitionOrderStatus(orderId, "Return Rejected", {
    triggerSource: "Admin: Reject Return",
    userOrAdmin: "admin",
    reason: rejectReason,
  });
}

export async function getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("order_status_history")
    .select("id, order_id, status, notes, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching order status history:", error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    order_id: row.order_id,
    status: row.status,
    updated_by: row.updated_by || "system",
    metadata: row.metadata || {},
    created_at: row.created_at,
  }));
}

export async function addOrderStatusHistory(
  orderId: string,
  status: string,
  updatedBy?: string,
  metadata?: any
): Promise<OrderStatusHistory> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const entry = {
    order_id: orderId,
    status,
    updated_by: updatedBy || "system",
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("order_status_history")
    .insert(entry)
    .select()
    .single();

  if (error) {
    console.error("Error inserting order status history:", error);
    throw error;
  }
  return {
    id: data.id,
    order_id: data.order_id,
    status: data.status,
    updated_by: data.updated_by,
    metadata: data.metadata,
    created_at: data.created_at,
  };
}

export async function addOrderEvent(orderId: string, event: string): Promise<void> {
  await createOrderEvent(orderId, event);
}

export async function createOrderEvent(orderId: string, event: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event,
  });
  if (error) {
    console.error("Error inserting order event:", error);
    throw error;
  }
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "Pending": ["Payment Pending", "Cancelled"],
  "Payment Pending": ["Paid", "Cancelled", "FAILED", "Payment Review Required"],
  "Payment Review Required": ["Paid", "Cancelled", "FAILED"],
  "Paid": ["Processing", "Cancelled", "FAILED", "Refunded (Out of Stock)"],
  "Paid via Wallet": ["Processing", "Cancelled"],
  "paid via wallet": ["Processing", "Cancelled"],
  "Accepted": ["Packed", "Cancelled"],
  "Processing": ["Packed", "Shipped", "Cancelled"],
  "Packed": ["Shipped", "Cancelled"],
  "Waiting for Dispatch": ["Shipped", "Cancelled"],
  "Shipped": ["Delivered", "Returned", "Return Requested", "Return in Transit", "Cancelled", "Out for Delivery"],
  "Out for Delivery": ["Delivered", "Returned", "Cancelled"],
  "Delivered": ["Completed", "Returned", "Return Requested", "Cancelled"],
  "Completed": [],
  "Return Requested": ["Return in Transit", "Return Rejected", "Returned", "Cancelled", "Return Accepted"],
  "Return Accepted": ["Return Pickup Scheduled", "Cancelled"],
  "Return Pickup Scheduled": ["Return QC Pending", "Cancelled"],
  // FIX: Allow warehouse to mark a parcel as received (Return in Transit → Return QC Pending)
  "Return in Transit": ["Return QC Pending", "Returned", "Cancelled"],
  "Return QC Pending": ["Return Approved", "Return QC Failed", "Return QC Failed - Held", "Cancelled"],
  "Return Approved": ["Returned", "Cancelled"],
  // FIX: Allow admin to place QC-failed items on hold before final decision
  "Return QC Failed": ["Returned", "Return QC Failed - Held", "Cancelled"],
  // FIX: Return QC Failed - Held is now a valid state; can be escalated or finalized
  "Return QC Failed - Held": ["Return QC Failed", "Returned", "Cancelled"],
  "Reship Requested": ["Shipped", "Cancelled"],
  "Return Rejected": ["Return Requested", "Returned", "Cancelled"],
  "Cancelled": ["Refunded"],
  "Returned": ["Completed"],
  "FAILED": ["Paid", "Cancelled"]
};

export async function transitionOrderStatus(
  orderId: string,
  newStatus: string,
  context: {
    triggerSource: string;
    userOrAdmin: string;
    reason: string;
    allowBypass?: boolean;
    metadata?: any;
  }
): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }

  // 1. Fetch current order with payment_processing_state, razorpay_order_id, razorpay_payment_id
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("status, id, payment_processing_state, razorpay_order_id, razorpay_payment_id")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    paymentDebugLog({
      functionName: "transitionOrderStatus",
      orderId,
      newStatus,
      reason: "Order lookup failed inside transitionOrderStatus",
      error: orderErr?.message || "Order not found"
    });
    console.error(`[transitionOrderStatus] Order not found: ${orderId}`);
    return false;
  }

  const currentStatus = order.status;
  const traceId = (order.payment_processing_state as any)?.traceId || "transition-no-trace";

  paymentDebugLog({
    traceId,
    functionName: "transitionOrderStatus",
    orderId,
    razorpayOrderId: order.razorpay_order_id || undefined,
    razorpayPaymentId: order.razorpay_payment_id || undefined,
    oldStatus: currentStatus,
    newStatus,
    reason: `Initiating status transition check. Triggered by ${context.userOrAdmin} via ${context.triggerSource} for reason: ${context.reason}`
  });

  // 2. Validate transition
  if (!context.allowBypass) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (currentStatus !== newStatus && !allowed.includes(newStatus)) {
      paymentDebugLog({
        traceId,
        functionName: "transitionOrderStatus",
        orderId,
        oldStatus: currentStatus,
        newStatus,
        reason: "Invalid status transition path blocked",
        error: `Invalid transition path: ${currentStatus} -> ${newStatus}`
      });
      console.error(`[transitionOrderStatus] Invalid transition: ${currentStatus} -> ${newStatus} for order ${orderId}`);
      throw new Error(`Invalid state transition from ${currentStatus} to ${newStatus}`);
    }
  }

  if (currentStatus === newStatus) {
    paymentDebugLog({
      traceId,
      functionName: "transitionOrderStatus",
      orderId,
      oldStatus: currentStatus,
      newStatus,
      reason: "Status unchanged, target state is already current state"
    });
    return true; // Already in target state
  }

  // 3. Update order
  const updatePayload: any = { status: newStatus };
  
  if (newStatus === "Processing") {
    updatePayload.accepted_at = new Date().toISOString();
  } else if (newStatus === "Packed") {
    updatePayload.packed_at = new Date().toISOString();
  } else if (newStatus === "Delivered" || newStatus === "Completed" || newStatus === "Returned") {
    updatePayload.completed_at = new Date().toISOString();
    if (newStatus === "Delivered") {
      updatePayload.delivered_at = new Date().toISOString();
      updatePayload.points_credit_scheduled_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const { error: updateErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateErr) {
    paymentDebugLog({
      traceId,
      functionName: "transitionOrderStatus",
      orderId,
      oldStatus: currentStatus,
      newStatus,
      reason: "Failed to update order status in database",
      error: updateErr.message
    });
    console.error(`[transitionOrderStatus] Failed to update order ${orderId}:`, updateErr);
    return false;
  }

  // 4. Create Audit Log
  const { error: auditErr } = await supabase
    .from("order_status_history")
    .insert({
      order_id: orderId,
      status: newStatus,
      updated_by: context.userOrAdmin,
      trigger_source: context.triggerSource,
      reason: context.reason,
      metadata: { previous_status: currentStatus, ...context.metadata }
    });

  if (auditErr) {
    console.error(`[transitionOrderStatus] Failed to create audit log for ${orderId}:`, auditErr);
  }

  paymentDebugLog({
    traceId,
    functionName: "transitionOrderStatus",
    orderId,
    oldStatus: currentStatus,
    newStatus,
    reason: "Order status successfully transitioned"
  });

  // 5. Create basic event for timeline
  await createOrderEvent(orderId, `Status updated to ${newStatus}`);

  return true;
}

export async function getOrderEvents(orderId: string): Promise<Array<{ id: string; orderId: string; event: string; created_at: string }>> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }
  const { data, error } = await supabase
    .from("order_events")
    .select("id, order_id, event, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching order events:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    event: row.event,
    created_at: row.created_at,
  }));
}

export async function getOrderNotes(orderId: string): Promise<OrderNote[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("order_notes")
    .select("id, order_id, created_by, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error fetching order notes:", error);
    throw error;
  }
  return (data || []).map((n) => ({
    id: n.id,
    orderId: n.order_id,
    note: n.note,
    createdBy: n.created_by,
    createdAt: n.created_at,
  }));
}

export async function addOrderNote(orderId: string, note: string, createdBy: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("order_notes").insert({
    order_id: orderId,
    note,
    created_by: createdBy,
  });
  if (error) {
    console.error("Error saving order note:", error);
    throw error;
  }
}

export async function deleteOrderNote(noteId: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("order_notes").delete().eq("id", noteId);
  if (error) {
    console.error("Error deleting order note:", error);
    throw error;
  }
}

export async function getReturnByOrderId(orderId: string): Promise<{
  order: Order;
  events: OrderEvent[];
  notes: OrderNote[];
} | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("*, return_image_url, return_reason, refund_option, return_requested_at, return_awb")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderData) return null;
  const order = mapDbOrderToOrder(orderData);

  const { data: eventsData, error: eventsError } = await supabase
    .from("order_events")
    .select("id, order_id, event, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    console.error("Error fetching events for return details:", eventsError);
  }

  const filteredEvents: OrderEvent[] = (eventsData || [])
    .filter((e: any) => {
      const txt = (e.event || "").toLowerCase();
      return txt.includes("return") || txt.includes("qc") || txt.includes("pickup") || txt.includes("refund");
    })
    .map((e: any) => ({
      id: e.id,
      orderId: e.order_id,
      order_id: e.order_id,
      event: e.event,
      description: e.event,
      created_at: e.created_at,
      createdAt: e.created_at,
    }));

  const notes = await getOrderNotes(orderId);

  return {
    order,
    events: filteredEvents,
    notes,
  };
}

export async function generateOrderId(paymentMethod: "razorpay" | "wallet"): Promise<string> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }
  const { data, error } = await supabase.rpc("get_next_order_sequence");
  if (error) {
    console.error("Error generating sequence ID:", error);
    throw error;
  }
  const sequence = String(data).padStart(5, "0");
  const prefix = paymentMethod === "razorpay" ? "RPO" : "WPO";
  return `6K-${prefix}-${sequence}`;
}

export async function getNextOrderNumber(): Promise<string> {
  return generateOrderId("razorpay");
}

export const ordersDb = {
  getOrders,
  getUserOrders,
  getOrder,
  getOrderById,
  getOrderByIdempotencyKey,
  getOrderByAwb,
  saveOrder,
  requestManualReturn,
  approveReturnPickup,
  rejectReturn,
  getOrderStatusHistory,
  addOrderStatusHistory,
  addOrderEvent,
  createOrderEvent,
  getOrderEvents,
  getOrderNotes,
  addOrderNote,
  deleteOrderNote,
  getReturnByOrderId,
  generateOrderId,
  getNextOrderNumber,
  transitionOrderStatus,
};

