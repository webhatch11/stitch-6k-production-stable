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
    // STEP 1: Payment guard on bulkUpdateOrderStatusAction (validate each order is paid)
    for (const oId of orderIds) {
      const order = await db.getOrderById(oId);
      if (!order) throw new Error(`Order ${oId} not found`);
      if (order.paymentStatus?.toLowerCase() !== 'paid') {
        throw new Error('Cannot process order. Payment not confirmed. Verify payment status before proceeding.');
      }
    }

    const allOrders = await db.getOrders();
    let count = 0;
    for (const o of allOrders) {
      if (orderIds.includes(o.id)) {
        count++;
        o.status = newStatus;
        await db.saveOrder(o);
        await db.addOrderEvent(o.id, "Status changed to: " + newStatus);

        // Fail-safe email dispatch triggered by status transition
        if (newStatus === "Cancelled") {
          db.getOrderById(o.id).then(async (order) => {
            if (!order) return;
            const email = await getCustomerEmailForOrder(order);
            if (email) {
              const { sendOrderCancelledEmail } = await import("@/lib/email");
              const wPaid = order.walletPaid || 0;
              const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
              
              const isWalletRefund = order.refundOption === 'wallet' || (wPaid > 0 && gPaid === 0);
              const suffix = isWalletRefund ? '-W' : '-B';
              
              const refundDetails = gPaid > 0 && wPaid > 0
                ? `₹${gPaid.toLocaleString("en-IN")} bank refund and ₹${wPaid.toLocaleString("en-IN")} store wallet credit`
                : (gPaid > 0 ? `₹${gPaid.toLocaleString("en-IN")} bank refund` : `₹${wPaid.toLocaleString("en-IN")} store wallet credit`);

              await sendOrderCancelledEmail({
                id: order.id + suffix,
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
              const wPaid = order.walletPaid || 0;
              const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
              const isWalletRefund = order.refundOption === 'wallet' || (wPaid > 0 && gPaid === 0);
              const suffix = isWalletRefund ? '-W' : '-B';

              await sendReturnAcceptedEmail({
                id: order.id + suffix,
                customerName: order.customer || "Valued Customer",
                customerEmail: email,
                refundAmount: order.total,
                refundOption: (order as any).refund_option || (isWalletRefund ? "wallet" : "bank"),
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
    // STEP 1: Payment guard
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus?.toLowerCase() !== 'paid') {
      throw new Error('Cannot process order. Payment not confirmed. Verify payment status before proceeding.');
    }

    const success = await db.cancelOrderAndRefund(orderId, reason.trim());
    if (success) {
      await db.addOrderEvent(orderId, "Order cancelled and refunded");
      db.getOrderById(orderId).then(async (latestOrder) => {
        if (!latestOrder) return;
        const email = await getCustomerEmailForOrder(latestOrder);
        if (email) {
          try {
            const { sendOrderCancelledByAdminEmail } = await import("@/lib/email");
            const wPaid = latestOrder.walletPaid || 0;
            const gPaid = latestOrder.gatewayPaid !== undefined ? latestOrder.gatewayPaid : Math.max(0, latestOrder.total - wPaid);
            const refundMethod = latestOrder.refundOption || (gPaid > 0 ? "bank" : "wallet");

            await sendOrderCancelledByAdminEmail({
              to: email,
              customerName: latestOrder.customer || "Valued Customer",
              orderId: latestOrder.id,
              refundAmount: latestOrder.total,
              refundMethod,
              reason: reason.trim()
            });
          } catch (emailErr: any) {
            console.error("[Email Dispatch Error] sendOrderCancelledByAdminEmail:", emailErr);
            Sentry.captureException(emailErr, {
              extra: { orderId, emailType: "order_cancelled_admin" }
            });
          }
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] cancelOrderAndRefund fetch:", err);
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
    // STEP 1: Payment guard
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus?.toLowerCase() !== 'paid') {
      throw new Error('Cannot process order. Payment not confirmed. Verify payment status before proceeding.');
    }

    const success = await db.approveReturnPickup(orderId);
    if (success) {
      await db.addOrderEvent(orderId, "Return pickup scheduled");
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
    // STEP 1: Payment guard
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus?.toLowerCase() !== 'paid') {
      throw new Error('Cannot process order. Payment not confirmed. Verify payment status before proceeding.');
    }

    const success = await db.processReturnRefund(orderId, qualityPassed, reason.trim());
    if (success) {
      // Loyalty point reversal is handled atomically inside db.processReturnRefund
      // (applyLoyaltyDebit for pointsEarned, applyLoyaltyCredit for pointsRedeemed).
      // Do NOT call loyalty RPCs here to avoid double-counting.

      db.getOrderById(orderId).then(async (latestOrder) => {
        if (!latestOrder) return;
        const email = await getCustomerEmailForOrder(latestOrder);
        if (email) {
          const { sendReturnAcceptedEmail } = await import("@/lib/email");
          const wPaid = latestOrder.walletPaid || 0;
          const gPaid = latestOrder.gatewayPaid !== undefined ? latestOrder.gatewayPaid : Math.max(0, latestOrder.total - wPaid);
          const isWalletRefund = latestOrder.refundOption === 'wallet' || (wPaid > 0 && gPaid === 0);
          const suffix = isWalletRefund ? '-W' : '-B';

          await sendReturnAcceptedEmail({
            id: latestOrder.id + suffix,
            customerName: latestOrder.customer || "Valued Customer",
            customerEmail: email,
            refundAmount: latestOrder.total,
            refundOption: (latestOrder as any).refund_option || (isWalletRefund ? "wallet" : "bank"),
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
    // STEP 1: Payment guard
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus?.toLowerCase() !== 'paid') {
      throw new Error('Cannot process order. Payment not confirmed. Verify payment status before proceeding.');
    }

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

// STEP 2 & 3: verifyPaymentAction and verifyRefundAction Server Actions
export async function verifyPaymentAction(
  orderId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  try {
    const res = await db.verifyRazorpayPayment(orderId);
    return res;
  } catch (e: any) {
    console.error("[verifyPaymentAction]", e);
    return { success: false, error: e.message || "Payment verification failed" };
  }
}

export async function verifyRefundAction(
  orderId: string
): Promise<{ success: boolean; status?: string; processedAt?: string; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  try {
    const res = await db.verifyRazorpayRefund(orderId);
    return { success: true, ...res };
  } catch (e: any) {
    console.error("[verifyRefundAction]", e);
    return { success: false, error: e.message || "Refund verification failed" };
  }
}

export async function generateShipmentLabelAction(
  orderId: string
): Promise<{
  success: boolean;
  labelUrl: string | null;
  manifestUrl: string | null;
  cached: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, labelUrl: null, manifestUrl: null, cached: false, error: "Unauthorized" };
  }

  try {
    const shipment = await db.getShipmentByOrderId(orderId);
    if (!shipment) {
      return {
        success: false,
        labelUrl: null,
        manifestUrl: null,
        cached: false,
        error: "No shipment found for this order"
      };
    }

    if (shipment.label_url) {
      return {
        success: true,
        labelUrl: shipment.label_url,
        manifestUrl: shipment.manifest_url || null,
        cached: true
      };
    }

    const { shiprocket } = await import("@/lib/shiprocket");
    const shipmentIdNum = Number(shipment.shipment_id);

    if (!shipmentIdNum || isNaN(shipmentIdNum)) {
      return {
        success: false,
        labelUrl: null,
        manifestUrl: null,
        cached: false,
        error: "Invalid Shiprocket Shipment ID saved in database"
      };
    }

    const labelRes = await shiprocket.generateShippingLabel(shipmentIdNum);
    if (!labelRes.success || !labelRes.labelUrl) {
      return {
        success: false,
        labelUrl: null,
        manifestUrl: null,
        cached: false,
        error: labelRes.error || "Failed to generate label from Shiprocket"
      };
    }

    const labelUrl = labelRes.labelUrl;
    let manifestUrl: string | null = null;

    const manifestRes = await shiprocket.generateManifest(shipmentIdNum);
    if (manifestRes.success && manifestRes.manifestUrl) {
      manifestUrl = manifestRes.manifestUrl;
    }

    // Update shipments table in database
    if (supabase) {
      const { error } = await supabase
        .from("shipments")
        .update({
          label_url: labelUrl,
          manifest_url: manifestUrl,
          updated_at: new Date().toISOString()
        })
        .eq("order_id", orderId);

      if (error) {
        console.error("[generateShipmentLabelAction] Suppress DB update error:", error);
      }
    }

    return {
      success: true,
      labelUrl,
      manifestUrl,
      cached: false
    };
  } catch (err: any) {
    console.error("[generateShipmentLabelAction] unhandled exception:", err);
    return {
      success: false,
      labelUrl: null,
      manifestUrl: null,
      cached: false,
      error: err.message || "An unexpected error occurred"
    };
  }
}

export async function getShipmentByOrderIdAction(
  orderId: string
): Promise<{
  success: boolean;
  shipment: any | null;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, shipment: null, error: "Unauthorized" };
  }
  try {
    const shipment = await db.getShipmentByOrderId(orderId);
    return { success: true, shipment };
  } catch (err: any) {
    console.error("[getShipmentByOrderIdAction] error:", err);
    return { success: false, shipment: null, error: err.message || "Failed to fetch shipment" };
  }
}


