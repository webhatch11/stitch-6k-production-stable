"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import * as Sentry from "@sentry/nextjs";
import { supabaseService as supabase } from "@/lib/supabase-service";

async function getCustomerEmailForOrder(order: any): Promise<string> {
  let customerEmail = "";
  if (order.address_snapshot) {
    const snap = typeof order.address_snapshot === "string"
      ? JSON.parse(order.address_snapshot)
      : order.address_snapshot;
    customerEmail = snap.email || "";
  }
  if (!customerEmail && (order.userId || order.user_id) && supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", order.userId || order.user_id)
      .maybeSingle();
    if (profile?.email) {
      customerEmail = profile.email;
    }
  }
  return customerEmail;
}

const ALLOWED_STATUSES = [
  "Payment Pending",
  "Paid",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Return Requested",
  "Return in Transit",
  "Returned",
  "Return Rejected",
];

export async function bulkUpdateOrderStatusAction(
  orderIds: string[],
  newStatus: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return { success: false, error: `Status "${newStatus}" is not permitted` };
  }
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { success: false, error: "No orders specified" };
  }

  try {
    const allOrders = await db.getOrders();
    let count = 0;
    for (const o of allOrders) {
      if (orderIds.includes(o.id)) {
        count++;
        o.status = newStatus;
        await db.saveOrder(o);

        // Fail-safe email dispatch triggered by status transition
        if (newStatus === "Cancelled") {
          db.getOrderById(o.id).then(async (order) => {
            if (!order) return;
            const email = await getCustomerEmailForOrder(order);
            if (email) {
              const { sendOrderCancelledEmail } = await import("@/lib/email");
              const wPaid = order.walletPaid || 0;
              const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
              const refundDetails = gPaid > 0 && wPaid > 0
                ? `₹${gPaid.toLocaleString("en-IN")} bank refund and ₹${wPaid.toLocaleString("en-IN")} store wallet credit`
                : (gPaid > 0 ? `₹${gPaid.toLocaleString("en-IN")} bank refund` : `₹${wPaid.toLocaleString("en-IN")} store wallet credit`);

              await sendOrderCancelledEmail({
                id: order.id,
                customerName: order.customer || "Valued Customer",
                customerEmail: email,
                cancelReason: "Status updated to Cancelled by admin",
                refundAmount: order.total,
                refundDetails,
              });
            }
          }).catch((err) => {
            console.error(`[Email Dispatch Error] bulkCancel for ${o.id}:`, err);
            Sentry.captureException(err, { extra: { orderId: o.id, emailType: "order_cancelled_bulk" } });
          });
        } else if (newStatus === "Returned") {
          db.getOrderById(o.id).then(async (order) => {
            if (!order) return;
            const email = await getCustomerEmailForOrder(order);
            if (email) {
              const { sendReturnAcceptedEmail } = await import("@/lib/email");
              await sendReturnAcceptedEmail({
                id: order.id,
                customerName: order.customer || "Valued Customer",
                customerEmail: email,
                refundAmount: order.total,
                refundOption: (order as any).refund_option || "bank",
              });
            }
          }).catch((err) => {
            console.error(`[Email Dispatch Error] bulkReturn for ${o.id}:`, err);
            Sentry.captureException(err, { extra: { orderId: o.id, emailType: "return_accepted_bulk" } });
          });
        } else if (newStatus === "Return Rejected") {
          db.getOrderById(o.id).then(async (order) => {
            if (!order) return;
            const email = await getCustomerEmailForOrder(order);
            if (email) {
              const { sendReturnRejectedEmail } = await import("@/lib/email");
              await sendReturnRejectedEmail({
                id: order.id,
                customerName: order.customer || "Valued Customer",
                customerEmail: email,
                rejectReason: "Status updated to Return Rejected by admin",
              });
            }
          }).catch((err) => {
            console.error(`[Email Dispatch Error] bulkReject for ${o.id}:`, err);
            Sentry.captureException(err, { extra: { orderId: o.id, emailType: "return_rejected_bulk" } });
          });
        }
      }
    }
    return { success: true, count };
  } catch (e: any) {
    console.error("[bulkUpdateOrderStatusAction]", e);
    return { success: false, error: e.message || "Bulk update failed" };
  }
}

export async function approvePendingOrderAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  try {
    const success = await db.approvePendingOrder(orderId);
    if (success) {
      db.getOrderById(orderId).then(async (order) => {
        if (!order) return;
        const email = await getCustomerEmailForOrder(order);
        if (email) {
          const { sendOrderConfirmationEmail } = await import("@/lib/email");
          const rawItems = order.cartItems || (order as any).cart_items || [];
          const groupedMap = new Map<string, { productName: string; size: string; quantity: number; price: number }>();
          for (const item of rawItems) {
            const key = `${item.productName || item.title || "Product"}-${item.size || "Free Size"}`;
            if (groupedMap.has(key)) {
              groupedMap.get(key)!.quantity += 1;
            } else {
              groupedMap.set(key, {
                productName: item.productName || item.title || "Product",
                size: item.size || "Free Size",
                quantity: item.quantity || 1,
                price: item.price || 0,
              });
            }
          }
          const emailItems = Array.from(groupedMap.values());
          const addr = order.address_snapshot;
          const addressStr = addr
            ? [
                addr.name,
                addr.phone,
                addr.address_line_1 || addr.address,
                addr.address_line_2,
                addr.city,
                addr.postal_code || addr.pincode,
                addr.state,
                addr.country
              ]
                .filter(Boolean)
                .join(", ")
            : "No address details available";

          await sendOrderConfirmationEmail({
            id: order.id,
            customerName: order.customer || "Valued Customer",
            customerEmail: email,
            items: emailItems,
            total: order.total,
            address: addressStr,
          });
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] approvePendingOrder:", err);
        Sentry.captureException(err, {
          extra: { orderId, emailType: "order_approved_confirmation" }
        });
      });
    }
    return { success: !!success };
  } catch (e: any) {
    console.error("[approvePendingOrderAction]", e);
    return { success: false, error: e.message || "Approve failed" };
  }
}

export async function cancelOrderAndRefundAction(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!reason?.trim()) return { success: false, error: "Refund reason is required" };
  try {
    const success = await db.cancelOrderAndRefund(orderId, reason.trim());
    if (success) {
      db.getOrderById(orderId).then(async (order) => {
        if (!order) return;
        const email = await getCustomerEmailForOrder(order);
        if (email) {
          const { sendOrderCancelledEmail } = await import("@/lib/email");
          const wPaid = order.walletPaid || 0;
          const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
          const refundDetails = gPaid > 0 && wPaid > 0
            ? `₹${gPaid.toLocaleString("en-IN")} bank refund and ₹${wPaid.toLocaleString("en-IN")} store wallet credit`
            : (gPaid > 0 ? `₹${gPaid.toLocaleString("en-IN")} bank refund` : `₹${wPaid.toLocaleString("en-IN")} store wallet credit`);

          await sendOrderCancelledEmail({
            id: order.id,
            customerName: order.customer || "Valued Customer",
            customerEmail: email,
            cancelReason: reason.trim(),
            refundAmount: order.total,
            refundDetails,
          });
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] cancelOrderAndRefund:", err);
        Sentry.captureException(err, {
          extra: { orderId, emailType: "order_cancelled" }
        });
      });
    }
    return { success: !!success };
  } catch (e: any) {
    console.error("[cancelOrderAndRefundAction]", e);
    return { success: false, error: e.message || "Cancel failed" };
  }
}

export async function approveReturnPickupAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };

  try {
    const order = await db.getOrderById(orderId);
    if (!order) return { success: false, error: "Order not found" };

    const success = await db.approveReturnPickup(orderId);
    if (success) {
      const { shiprocket } = await import("@/lib/shiprocket");
      
      // Fallback address snapshot
      const customerAddress = order.address_snapshot || {
        name: order.customer || "Guest Customer",
        phone: "9999999999",
        address: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      };

      const items = (order.cartItems && order.cartItems.length > 0)
        ? order.cartItems.map((item: any) => ({
            name: item.productName || item.title || "Shirt",
            sku: item.productId || "sku",
            units: item.quantity || 1,
            price: item.price || 0
          }))
        : [{ name: "Designer Shirt", sku: "sku-stitch", units: 1, price: order.total }];

      const pickup = await shiprocket.createReversePickup(orderId, customerAddress, items);

      let finalAwb = pickup.awb || "";
      let finalPickupScheduled = pickup.pickupScheduled || new Date().toISOString();

      if (pickup.success && pickup.awb) {
        await db.saveOrder({
          id: orderId,
          returnAwb: pickup.awb,
          returnPickupScheduled: pickup.pickupScheduled || new Date().toISOString()
        });
        finalAwb = pickup.awb;
        finalPickupScheduled = pickup.pickupScheduled || finalPickupScheduled;
      }

      // Send pickup scheduled email to customer
      db.getOrderById(orderId).then(async (latestOrder) => {
        if (!latestOrder) return;
        const email = await getCustomerEmailForOrder(latestOrder);
        if (email) {
          const { sendReturnPickupScheduledEmail } = await import("@/lib/email");
          await sendReturnPickupScheduledEmail({
            id: latestOrder.id,
            customerName: latestOrder.customer || "Valued Customer",
            customerEmail: email,
            awb: latestOrder.returnAwb || finalAwb || "Scheduled",
            pickupDate: latestOrder.returnPickupScheduled || finalPickupScheduled,
          });
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] approveReturnPickup:", err);
        Sentry.captureException(err, {
          extra: { orderId, emailType: "return_pickup_scheduled" }
        });
      });
    }
    return { success: !!success };
  } catch (e: any) {
    console.error("[approveReturnPickupAction]", e);
    return { success: false, error: e.message || "Approve pickup failed" };
  }
}

export async function processReturnRefundAction(
  orderId: string,
  qualityPassed: boolean,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!reason?.trim()) return { success: false, error: "Refund reason is required" };
  try {
    const success = await db.processReturnRefund(orderId, qualityPassed, reason.trim());
    if (success) {
      db.getOrderById(orderId).then(async (order) => {
        if (!order) return;
        const email = await getCustomerEmailForOrder(order);
        if (email) {
          const { sendReturnAcceptedEmail } = await import("@/lib/email");
          await sendReturnAcceptedEmail({
            id: order.id,
            customerName: order.customer || "Valued Customer",
            customerEmail: email,
            refundAmount: order.total,
            refundOption: (order as any).refund_option || "bank",
          });
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] processReturnRefund:", err);
        Sentry.captureException(err, {
          extra: { orderId, emailType: "return_accepted" }
        });
      });
    }
    return { success: !!success };
  } catch (e: any) {
    console.error("[processReturnRefundAction]", e);
    return { success: false, error: e.message || "Process refund failed" };
  }
}

export async function issueRefundAction(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!reason?.trim()) return { success: false, error: "Refund reason is required" };
  try {
    const success = await db.issueRefund(orderId, reason.trim());
    return { success: !!success };
  } catch (e: any) {
    console.error("[issueRefundAction]", e);
    return { success: false, error: e.message || "Refund failed" };
  }
}

export async function rejectReturnAction(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!reason?.trim()) return { success: false, error: "Rejection reason is required" };
  try {
    const success = await db.rejectReturn(orderId, reason);
    if (success) {
      db.getOrderById(orderId).then(async (order) => {
        if (!order) return;
        const email = await getCustomerEmailForOrder(order);
        if (email) {
          const { sendReturnRejectedEmail } = await import("@/lib/email");
          await sendReturnRejectedEmail({
            id: order.id,
            customerName: order.customer || "Valued Customer",
            customerEmail: email,
            rejectReason: reason,
          });
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] rejectReturn:", err);
        Sentry.captureException(err, {
          extra: { orderId, emailType: "return_rejected" }
        });
      });
    }
    return { success: !!success };
  } catch (e: any) {
    console.error("[rejectReturnAction]", e);
    return { success: false, error: e.message || "Reject return failed" };
  }
}

export async function getOrderEventsAction(orderId: string): Promise<{
  success: boolean;
  events?: any[];
  error?: string;
}> {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  try {
    const events = await db.getOrderEvents(orderId);
    return { success: true, events };
  } catch (e: any) {
    console.error('[admin-orders.ts]:', e);
    return { success: false, error: e.message };
  }
}

export async function getOrderNotesAction(orderId: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  try {
    const notes = await db.getOrderNotes(orderId);
    return { success: true, notes };
  } catch (e: any) {
    console.error('[admin-orders.ts]:', e);
    return { success: false, error: e.message };
  }
}

export async function addOrderNoteAction(orderId: string, note: string) {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!note?.trim()) return { success: false, error: "Note cannot be empty" };
  try {
    const createdBy = user.email || "admin@the6k.com";
    await db.addOrderNote(orderId, note, createdBy);
    return { success: true };
  } catch (e: any) {
    console.error('[admin-orders.ts]:', e);
    return { success: false, error: e.message };
  }
}

export async function deleteOrderNoteAction(noteId: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!noteId?.trim()) return { success: false, error: "Invalid note ID" };
  try {
    await db.deleteOrderNote(noteId);
    return { success: true };
  } catch (e: any) {
    console.error('[admin-orders.ts]:', e);
    return { success: false, error: e.message };
  }
}
