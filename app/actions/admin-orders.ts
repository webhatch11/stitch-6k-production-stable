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
  "Packed",
  "Waiting for Dispatch",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Return Requested",
  "Return Accepted",
  "Return in Transit",
  "Returned",
  "Return Rejected",
  "Return Pickup Scheduled",
  "Return QC Pending",
  "Return QC Failed",
  "Refund Initiated",
  "Reship Requested",
  "Return Approved",
  "Return QC Failed - Held",
  "Payment Review Required",
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
    for (const oId of orderIds) {
      const order = await db.getOrderById(oId);
      if (!order) throw new Error(`Order ${oId} not found`);

      // Payment Confirmation Guard
      const isPaidViaGateway = order.paymentStatus?.toLowerCase() === 'paid';
      const isPaidViaWallet = (order.walletPaid ?? 0) > 0 && (order.gatewayPaid ?? 0) === 0;
      const isSplitPayment = (order.walletPaid ?? 0) > 0 && (order.gatewayPaid ?? 0) > 0;
      const isPaymentConfirmed = isPaidViaGateway || isPaidViaWallet || isSplitPayment;

      // Allow cancelling a pending payment
      if (newStatus !== "Cancelled" && !isPaymentConfirmed) {
        throw new Error(
          `Cannot process order #${oId}. Payment not confirmed. ` +
          'Verify payment status before proceeding.'
        );
      }
    }

    const allOrders = await db.getOrders();
    let count = 0;
    for (const o of allOrders) {
      if (orderIds.includes(o.id)) {
        // Enforce state transition checks (allowBypass: false)
        const success = await db.transitionOrderStatus(o.id, newStatus, {
          triggerSource: "Admin Panel - Bulk Update",
          userOrAdmin: "admin",
          reason: "Bulk update from admin panel",
          allowBypass: false
        });
        
        if (success) {
          count++;
        } else {
          throw new Error(`State machine rejected status transition to "${newStatus}" for Order #${o.id}`);
        }

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
    
    const isPaidViaGateway = 
      order.paymentStatus?.toLowerCase() === 'paid';

    const isPaidViaWallet = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) === 0;

    const isSplitPayment = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) > 0;

    const isPaymentConfirmed = 
      isPaidViaGateway || isPaidViaWallet || isSplitPayment;

    if (!isPaymentConfirmed) {
      throw new Error(
        'Cannot process order. Payment not confirmed. ' +
        'Verify payment status before proceeding.'
      );
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
    
    const isPaidViaGateway = 
      order.paymentStatus?.toLowerCase() === 'paid';

    const isPaidViaWallet = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) === 0;

    const isSplitPayment = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) > 0;

    const isPaymentConfirmed = 
      isPaidViaGateway || isPaidViaWallet || isSplitPayment;

    if (!isPaymentConfirmed) {
      throw new Error(
        'Cannot process order. Payment not confirmed. ' +
        'Verify payment status before proceeding.'
      );
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
  reason: string,
  overrideAmount?: number,
  overrideReason?: string
): Promise<{ success: boolean; error?: string }> {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!reason?.trim()) return { success: false, error: "Refund reason is required" };
  if (overrideAmount !== undefined && overrideAmount <= 0) {
    return { success: false, error: "Refund override amount must be greater than zero" };
  }
  try {
    // STEP 1: Payment & Status guard (Pre-CAS validation sequence)
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    const refStatus = (order.refundStatus || (order as any).refund_status || "").toLowerCase();
    if (order.status === "Returned" || ["pending", "initiated", "success", "wallet_only", "processed", "completed"].includes(refStatus)) {
      return { success: false, error: "Refund has already been processed or is currently in progress." };
    }

    const isPaidViaGateway = 
      order.paymentStatus?.toLowerCase() === 'paid';

    const isPaidViaWallet = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) === 0;

    const isSplitPayment = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) > 0;

    const isPaymentConfirmed = 
      isPaidViaGateway || isPaidViaWallet || isSplitPayment;

    if (!isPaymentConfirmed) {
      throw new Error(
        'Cannot process order. Payment not confirmed. ' +
        'Verify payment status before proceeding.'
      );
    }

    const success = await db.processReturnRefund(orderId, qualityPassed, reason.trim(), overrideAmount, overrideReason);
    if (success) {
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
            refundAmount: overrideAmount !== undefined ? overrideAmount : latestOrder.total,
            refundOption: (latestOrder as any).refund_option || (isWalletRefund ? "wallet" : "bank"),
          });
        }
      }).catch((err) => {
        console.error("[Email Dispatch Error] processReturnRefund:", err);
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
    
    const isPaidViaGateway = 
      order.paymentStatus?.toLowerCase() === 'paid';

    const isPaidViaWallet = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) === 0;

    const isSplitPayment = 
      (order.walletPaid ?? 0) > 0 && 
      (order.gatewayPaid ?? 0) > 0;

    const isPaymentConfirmed = 
      isPaidViaGateway || isPaidViaWallet || isSplitPayment;

    if (!isPaymentConfirmed) {
      throw new Error(
        'Cannot process order. Payment not confirmed. ' +
        'Verify payment status before proceeding.'
      );
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
        error: "No shipment record found for order. Dispatch fulfillment must run first."
      };
    }

    // Use latest shipment record
    const resolvedShipment = await db.getShipmentByOrderId(orderId);
    if (!resolvedShipment) {
      return {
        success: false,
        labelUrl: null,
        manifestUrl: null,
        cached: false,
        error: "Shipment record not found after dispatch attempt"
      };
    }

    if (resolvedShipment.label_url) {
      return {
        success: true,
        labelUrl: resolvedShipment.label_url,
        manifestUrl: resolvedShipment.manifest_url || null,
        cached: true
      };
    }

    const { shiprocket } = await import("@/lib/shiprocket");
    const shipmentIdNum = Number(resolvedShipment.shipment_id);

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

export async function acceptOrderAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const order = await db.getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const isPaid = ['paid', 'paid via wallet']
      .includes(order.status?.toLowerCase() || '')

    if (!isPaid) {
      return { 
        success: false, 
        error: 'Order must be in Paid status to accept'
      }
    }

    const res = await bulkUpdateOrderStatusAction([orderId], "Processing");
    if (!res.success) {
      return { success: false, error: res.error || "Failed to update status" };
    }

    await db.addOrderEvent(orderId, "Order accepted by admin");
    return { success: true };
  } catch (e: any) {
    console.error("[acceptOrderAction]", e);
    return { success: false, error: e.message || "Failed to accept order" };
  }
}

export async function markOrderPackedAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const order = await db.getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if ((order.status || "").toLowerCase() !== "processing") {
      return { success: false, error: "Only Processing orders can be marked as packed" };
    }

    await db.transitionOrderStatus(orderId, "Packed", {
      triggerSource: "Admin Panel - Mark Packed",
      userOrAdmin: "admin",
      reason: "Invoice printed — order packed"
    });

    return { success: true };
  } catch (e: any) {
    console.error("[markOrderPackedAction]", e);
    return { success: false, error: e.message || "Failed to mark order as packed" };
  }
}

export async function bulkAcceptOrdersAction(
  orderIds: string[]
): Promise<{ success: boolean; accepted: number; failed: number; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, accepted: 0, failed: orderIds.length, error: "Unauthorized" };
  }

  let accepted = 0;
  let failed = 0;

  for (const orderId of orderIds) {
    try {
      const order = await db.getOrderById(orderId);
      if (!order) {
        failed++;
        continue;
      }

      const statusLower = (order.status || "").toLowerCase();
      if (statusLower !== "paid" && statusLower !== "paid via wallet") {
        failed++;
        continue;
      }

      const success = await db.transitionOrderStatus(orderId, "Processing", {
        triggerSource: "Admin Panel - Bulk Accept",
        userOrAdmin: "admin",
        reason: "Order accepted by admin"
      });
      if (success) {
        accepted++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`Failed to bulk accept order ${orderId}:`, err);
      failed++;
    }
  }

  return { success: true, accepted, failed };
}

export async function bulkMarkPackedAction(
  orderIds: string[]
): Promise<{ success: boolean; packed: number; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, packed: 0, error: "Unauthorized" };
  }

  let packed = 0;

  for (const orderId of orderIds) {
    try {
      const order = await db.getOrderById(orderId);
      if (!order || (order.status || "").toLowerCase() !== "processing") {
        continue;
      }

      const success = await db.transitionOrderStatus(orderId, "Packed", {
        triggerSource: "Admin Panel - Bulk Packed",
        userOrAdmin: "admin",
        reason: "Invoice printed — order packed"
      });
      if (success) {
        packed++;
      }
    } catch (err) {
      console.error(`Failed to bulk mark packed ${orderId}:`, err);
    }
  }

  return { success: true, packed };
}

export async function generateBulkLabelsAction(
  orderIds: string[]
): Promise<{
  success: boolean;
  results: Array<{
    orderId: string;
    success: boolean;
    awb?: string;
    labelUrl?: string;
    error?: string;
  }>;
}> {
  try {
    await requireAdmin();
  } catch {
    return {
      success: false,
      results: orderIds.map(id => ({ orderId: id, success: false, error: "Unauthorized" }))
    };
  }

  const results: Array<{
    orderId: string;
    success: boolean;
    awb?: string;
    labelUrl?: string;
    error?: string;
  }> = [];

  const { shiprocket } = await import("@/lib/shiprocket");

  for (const orderId of orderIds) {
    try {
      let shipment = await db.getShipmentByOrderId(orderId);
      if (!shipment) {
        const dispatchRes = await db.dispatchFulfillment(orderId);
        if (!dispatchRes.success) {
          results.push({
            orderId,
            success: false,
            error: dispatchRes.error || "Fulfillment dispatch failed"
          });
          continue;
        }
        shipment = await db.getShipmentByOrderId(orderId);
      }

      if (!shipment) {
        results.push({
          orderId,
          success: false,
          error: "Failed to create or retrieve shipment"
        });
        continue;
      }

      if (shipment.label_url) {
        results.push({
          orderId,
          success: true,
          awb: shipment.awb_code,
          labelUrl: shipment.label_url
        });
        continue;
      }

      const shipmentIdNum = Number(shipment.shipment_id);
      if (!shipmentIdNum || isNaN(shipmentIdNum)) {
        results.push({
          orderId,
          success: false,
          error: "Invalid Shiprocket Shipment ID in database"
        });
        continue;
      }

      const labelRes = await shiprocket.generateShippingLabel(shipmentIdNum);
      if (!labelRes.success || !labelRes.labelUrl) {
        results.push({
          orderId,
          success: false,
          error: labelRes.error || "Failed to generate label from Shiprocket"
        });
        continue;
      }

      const labelUrl = labelRes.labelUrl;
      let manifestUrl: string | null = null;
      const manifestRes = await shiprocket.generateManifest(shipmentIdNum);
      if (manifestRes.success && manifestRes.manifestUrl) {
        manifestUrl = manifestRes.manifestUrl;
      }

      if (supabase) {
        await supabase
          .from("shipments")
          .update({
            label_url: labelUrl,
            manifest_url: manifestUrl,
            updated_at: new Date().toISOString()
          })
          .eq("order_id", orderId);
      }

      const success = await db.transitionOrderStatus(orderId, "Shipped", {
        triggerSource: "Admin Panel - Label Generation",
        userOrAdmin: "admin",
        reason: "Label generated, AWB: " + shipment.awb_code
      });
      if (success) {
        const order = await db.getOrderById(orderId);
        if (order) {
          const updatedOrder = {
            ...order,
            shiprocketId: shipment.awb_code || ""
          };
          await db.saveOrder(updatedOrder);
        }
      }

      results.push({
        orderId,
        success: true,
        awb: shipment.awb_code,
        labelUrl
      });
    } catch (err: any) {
      console.error(`Error generating label for order ${orderId}:`, err);
      results.push({
        orderId,
        success: false,
        error: err.message || "An unexpected error occurred"
      });
    }
  }

  return { success: true, results };
}

export async function printManifestAction(): Promise<{
  success: boolean;
  manifestUrls: string[];
  orderCount: number;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, manifestUrls: [], orderCount: 0, error: "Unauthorized" };
  }

  if (!supabase) {
    return { success: false, manifestUrls: [], orderCount: 0, error: "Database not configured" };
  }

  try {
    const { data: unprintedShipments, error: shipErr } = await supabase
      .from("shipments")
      .select("id, order_id, shipment_id, manifest_url, manifest_printed")
      .eq("manifest_printed", false);

    if (shipErr) {
      throw new Error(shipErr.message);
    }

    const shippedOrderIds = new Set<string>();
    const orders = await db.getOrders();
    for (const o of orders) {
      if ((o.status || "").toLowerCase() === "shipped") {
        shippedOrderIds.add(o.id);
      }
    }

    const targetShipments = (unprintedShipments || []).filter(s => shippedOrderIds.has(s.order_id));
    if (targetShipments.length === 0) {
      return { success: true, manifestUrls: [], orderCount: 0 };
    }

    const manifestUrls: string[] = [];
    const { shiprocket } = await import("@/lib/shiprocket");

    for (const shipment of targetShipments) {
      const shipmentIdNum = Number(shipment.shipment_id);
      if (!shipmentIdNum || isNaN(shipmentIdNum)) continue;

      const manifestRes = await shiprocket.generateManifest(shipmentIdNum);
      if (manifestRes.success && manifestRes.manifestUrl) {
        manifestUrls.push(manifestRes.manifestUrl);

        await supabase
          .from("shipments")
          .update({
            manifest_url: manifestRes.manifestUrl,
            manifest_printed: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", shipment.id);

        await db.addOrderEvent(shipment.order_id, "Fulfillment manifest printed");
      }
    }

    return {
      success: true,
      manifestUrls: Array.from(new Set(manifestUrls)),
      orderCount: targetShipments.length
    };
  } catch (e: any) {
    console.error("[printManifestAction]", e);
    return { success: false, manifestUrls: [], orderCount: 0, error: e.message || "Failed to print manifests" };
  }
}

export async function generateBulkInvoicePdfAction(
  orderIds: string[]
): Promise<{
  success: boolean;
  orders?: any[];
  products?: any[];
  gstin?: string;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const orders: any[] = [];
    for (const id of orderIds) {
      const order = await db.getOrderById(id);
      if (order) {
        orders.push(order);
      }
    }

    const products = await db.getProducts();
    const businessSettings = await db.getSetting("business");
    const gstin = businessSettings?.gst_no || "33BFOPT4938Q1ZE";

    return {
      success: true,
      orders,
      products,
      gstin
    };
  } catch (e: any) {
    console.error("[generateBulkInvoicePdfAction]", e);
    return { success: false, error: e.message || "Failed to fetch bulk invoice data" };
  }
}

export async function rejectReturnWithReasonAction(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const success = await db.transitionOrderStatus(orderId, "Return Rejected", {
      triggerSource: "Admin Panel - Reject Return",
      userOrAdmin: "admin",
      reason: `Return rejected: ${reason}`
    });

    if (success) {
      await db.saveOrder({
        id: orderId,
        returnRejectReason: reason,
      });

      const createdBy = user.email || "admin@the6k.com";
      await db.addOrderNote(orderId, `Return request rejected. Reason: ${reason}`, createdBy);

      const order = await db.getOrderById(orderId);
      if (order) {
        const email = await getCustomerEmailForOrder(order);
        if (email) {
          const { sendReturnDeclinedEmail } = await import("@/lib/email");
          await sendReturnDeclinedEmail({
            id: orderId,
            customerName: order.customer || "Valued Customer",
            customerEmail: email,
            reason: reason,
          });
        }
      }

      await db.addOrderEvent(orderId, `Return rejected: ${reason}`);

      return { success: true };
    } else {
      return { success: false, error: "Failed to transition order status" };
    }
  } catch (e: any) {
    console.error("[rejectReturnWithReasonAction] Error:", e);
    return { success: false, error: e.message || "Failed to reject return" };
  }
}

export async function assignShiprocketReturnPickupAction(
  orderId: string,
  awbCode: string,
  courierName: string,
  trackingUrl?: string
): Promise<{ success: boolean; awb?: string; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!awbCode?.trim()) return { success: false, error: "AWB tracking code is required" };
  if (!courierName?.trim()) return { success: false, error: "Courier name is required" };
  if (trackingUrl && trackingUrl.trim().length > 0) {
    const trimmedUrl = trackingUrl.trim();
    if (!trimmedUrl.startsWith("https://")) {
      return { success: false, error: "Tracking URL must be a valid HTTPS link (e.g. https://shiprocket.co/tracking/...)" };
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== "https:") {
        return { success: false, error: "Tracking URL must use HTTPS protocol" };
      }
    } catch {
      return { success: false, error: "Invalid tracking URL format" };
    }
  }

  try {
    const order = await db.getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const success = await db.transitionOrderStatus(orderId, "Return in Transit", {
      triggerSource: "Admin Panel - Manual Return Shipment Linkage",
      userOrAdmin: "admin",
      reason: `Return shipment manually scheduled. Courier: ${courierName}, AWB: ${awbCode}`
    });

    if (success) {
      await db.saveOrder({
        id: orderId,
        returnAwb: awbCode.trim(),
        courierName: courierName.trim(),
        trackingUrl: trackingUrl?.trim() || `https://www.delhivery.com/track/package/${awbCode.trim()}`,
        returnPickupScheduled: new Date().toISOString(),
      });

      const email = await getCustomerEmailForOrder(order);
      if (email) {
        try {
          const { sendReturnPickupAssignedEmail } = await import("@/lib/email");
          await sendReturnPickupAssignedEmail({
            id: orderId,
            customerName: order.customer || "Valued Customer",
            customerEmail: email,
            awb: awbCode.trim(),
            courierName: courierName.trim(),
          });
        } catch (emailErr) {
          console.error("[Email Dispatch Error] sendReturnPickupAssignedEmail failed:", emailErr);
        }
      }

      return { success: true, awb: awbCode.trim() };
    } else {
      return { success: false, error: "Failed to transition status to Return in Transit." };
    }
  } catch (e: any) {
    console.error("[assignShiprocketReturnPickupAction] Error:", e);
    return { success: false, error: e.message || "Failed to assign manual reverse pickup" };
  }
}

export async function markReturnReceivedAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.transitionOrderStatus(orderId, "Return QC Pending", {
      triggerSource: "Admin Panel - Mark Return Received",
      userOrAdmin: "admin",
      reason: "Item received at warehouse. QC in progress."
    });
    return { success: true };
  } catch (e: any) {
    console.error("[markReturnReceivedAction] Error:", e);
    return { success: false, error: e.message || "Failed to mark return received" };
  }
}

export async function processQcResultAction(
  orderId: string,
  qcPassed: boolean,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (qcPassed) {
      const success = await db.transitionOrderStatus(orderId, "Return Approved", {
        triggerSource: "Admin Panel - QC Passed",
        userOrAdmin: "admin",
        reason: reason || "QC passed — pending admin refund approval"
      });
      if (success) {
        await db.saveOrder({
          id: orderId,
          qualityCheckPassed: true,
        });
      } else {
        return { success: false, error: "Failed to transition status to Return Approved." };
      }
    } else {
      const success = await db.transitionOrderStatus(orderId, "Return QC Failed", {
        triggerSource: "Admin Panel - QC Failed",
        userOrAdmin: "admin",
        reason: `QC failed: ${reason}`
      });

      if (success) {
        await db.saveOrder({
          id: orderId,
          returnRejectReason: reason,
        });

        const order = await db.getOrderById(orderId);
        if (order) {
          try {
            const { sendQcFailedEmail } = await import("@/lib/email");
            await sendQcFailedEmail({
              to: (order as any).addressSnapshot?.email || order.address_snapshot?.email || '',
              customerName: (order as any).addressSnapshot?.name || order.address_snapshot?.name || order.customer || 'Customer',
              orderId: order.id,
              reason: reason,
              refundOption: order.refundOption || 'bank'
            });
          } catch (emailErr) {
            console.error(
              '[processQcResultAction] QC failed email error:',
              emailErr
            );
          }
        }
      } else {
        return { success: false, error: "Failed to transition status to Return QC Failed." };
      }
    }
    return { success: true };
  } catch (e: any) {
    console.error("[processQcResultAction] Error:", e);
    return { success: false, error: e.message || "Failed to process QC result" };
  }
}

export async function reshipReturnItemAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.transitionOrderStatus(orderId, "Reship Requested", {
      triggerSource: "Admin Panel - Reship Return",
      userOrAdmin: "admin",
      reason: "Item to be reshipped to customer"
    });
    return { success: true };
  } catch (e: any) {
    console.error("[reshipReturnItemAction] Error:", e);
    return { success: false, error: e.message || "Failed to request reship" };
  }
}

export async function acceptReturnRequestAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.transitionOrderStatus(orderId, "Return Accepted", {
      triggerSource: "Admin Panel - Accept Return",
      userOrAdmin: "admin",
      reason: "Return request accepted by admin"
    });
    return { success: true };
  } catch (e: any) {
    console.error("[acceptReturnRequestAction] Error:", e);
    return { success: false, error: e.message || "Failed to accept return" };
  }
}

export async function addOrderEventAction(
  orderId: string,
  event: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.addOrderEvent(orderId, event);
    return { success: true };
  } catch (e: any) {
    console.error("[addOrderEventAction] Error:", e);
    return { success: false, error: e.message || "Failed to add event" };
  }
}

export async function manualDeliveryOverrideAction(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized. Admin privileges required." };
  }

  if (!orderId?.trim()) return { success: false, error: "Invalid order ID" };
  if (!reason?.trim()) return { success: false, error: "Reason for manual override is required" };

  try {
    const order = await db.getOrderById(orderId);
    if (!order) return { success: false, error: "Order not found" };

    // Widen the eligibility check: Shiprocket webhooks can fail at any point
    // after packing, so the order may be stuck in Packed, Shipped, or Out for
    // Delivery. Blocking the admin override to only "Shipped" prevents recovery
    // from webhook failures that occur before the shipped webhook fires.
    const OVERRIDABLE_STATUSES = [
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Waiting for Dispatch",
    ];
    if (!OVERRIDABLE_STATUSES.includes(order.status)) {
      return {
        success: false,
        error: `Manual delivery override is only permitted for in-transit orders. Current status: "${order.status}"`,
      };
    }

    // allowBypass: true — this is an admin emergency override, intentionally
    // skipping the state machine so stuck orders can always be recovered.
    const success = await db.transitionOrderStatus(orderId, "Delivered", {
      triggerSource: "Manual Admin Override",
      userOrAdmin: "admin",
      reason: `Manual delivery override: ${reason.trim()} (Confirmed by ${adminUser.email || "admin"})`,
      allowBypass: true,
      metadata: {
        admin_email: adminUser.email,
        override_reason: reason.trim(),
        previous_status: order.status,
      }
    });

    if (success) {
      // Trigger confirmation email
      try {
        const { sendOrderDeliveredEmail } = await import("@/lib/email");
        const returnDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        const email = order.address_snapshot?.email;
        if (email) {
          await sendOrderDeliveredEmail({
            to: email,
            customerName: order.address_snapshot?.name || order.customer || 'Customer',
            orderId: order.id,
            items: (order.cartItems || []).map((item: any) => ({
              name: item.productName || item.name,
              quantity: item.quantity || 1
            })),
            total: order.total,
            deliveredAt: new Date().toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric'
            }),
            returnDeadline
          });
        }
      } catch (emailErr) {
        console.error("[Manual Delivery Action] Delivery confirmation email failed:", emailErr);
      }
      return { success: true };
    }

    return { success: false, error: "Failed to transition order status." };
  } catch (err: any) {
    console.error("[manualDeliveryOverrideAction] Error:", err);
    return { success: false, error: err.message || "Failed to confirm manual delivery" };
  }
}

export async function manualReturnArrivedOverrideAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized. Admin privileges required." };
  }

  try {
    const success = await db.transitionOrderStatus(orderId, 'Return in Transit', {
      triggerSource: "Warehouse Manual Override",
      userOrAdmin: "admin",
      reason: "Package returned to warehouse (manual confirmation)"
    });
    if (success) {
      await db.addOrderEvent(
        orderId,
        'Return item arrived at warehouse'
      );
      return { success: true };
    }
    return { success: false, error: "Transition rejected by state machine" };
  } catch (err: any) {
    console.error("[manualReturnArrivedOverrideAction] Error:", err);
    return { success: false, error: err.message || "Failed to mark return as arrived" };
  }
}



