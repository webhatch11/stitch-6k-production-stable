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
    // STEP 1: State-machine transition validation & Payment guard on bulkUpdateOrderStatusAction
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      "Payment Pending": ["Paid", "Cancelled"],
      "Paid": ["Processing", "Cancelled"],
      "Paid via Wallet": ["Processing", "Cancelled"],
      "paid via wallet": ["Processing", "Cancelled"],
      "Processing": ["Packed", "Shipped", "Cancelled"],
      "Packed": ["Shipped", "Cancelled"],
      "Waiting for Dispatch": ["Shipped", "Cancelled"],
      "Shipped": ["Delivered", "Cancelled"],
      "Delivered": ["Return Requested", "Returned", "Cancelled"],
      "Return Requested": ["Return in Transit", "Return Rejected", "Cancelled"],
      "Return in Transit": ["Returned", "Cancelled"],
      "Cancelled": [],
      "Returned": [],
      "Return Rejected": []
    };

    for (const oId of orderIds) {
      const order = await db.getOrderById(oId);
      if (!order) throw new Error(`Order ${oId} not found`);

      const currentStatus = order.status || "Payment Pending";
      if (currentStatus !== newStatus) {
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
          console.warn(`[admin] Invalid transition attempted: #${oId} from "${currentStatus}" to "${newStatus}"`);
        }
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
      // No shipment exists yet — dispatch to Shiprocket now.
      // This handles wallet orders (and any order where dispatchFulfillment was not
      // called at checkout). Dispatch creates the Shiprocket order, assigns the AWB,
      // and creates a row in the shipments table.
      console.log(`[generateShipmentLabelAction] No shipment found for #${orderId} — dispatching to Shiprocket now.`);
      try {
        await db.dispatchFulfillment(orderId);
      } catch (dispatchErr: any) {
        console.error(`[generateShipmentLabelAction] dispatchFulfillment failed for #${orderId}:`, dispatchErr);
        return {
          success: false,
          labelUrl: null,
          manifestUrl: null,
          cached: false,
          error: `Shiprocket dispatch failed: ${dispatchErr.message || "Unknown error"}`
        };
      }

      // Re-fetch the shipment now that it has been created
      const newShipment = await db.getShipmentByOrderId(orderId);
      if (!newShipment) {
        return {
          success: false,
          labelUrl: null,
          manifestUrl: null,
          cached: false,
          error: "Shiprocket dispatch succeeded but shipment record was not created"
        };
      }
    }

    // Use latest shipment record (either existing or freshly created via dispatchFulfillment)
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

    await db.saveOrder({
      id: orderId,
      acceptedAt: new Date().toISOString()
    });

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

    const updated = {
      ...order,
      status: "Packed",
      packedAt: new Date().toISOString()
    };
    await db.saveOrder(updated);

    await db.addOrderEvent(orderId, "Invoice printed — order packed");
    await db.addOrderStatusHistory(orderId, "Packed", "Admin (Invoice Print)");

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

      const updated = {
        ...order,
        status: "Processing",
        acceptedAt: new Date().toISOString()
      };
      await db.saveOrder(updated);

      await db.addOrderEvent(orderId, "Order accepted by admin");
      await db.addOrderStatusHistory(orderId, "Processing", "Admin (Bulk)");
      accepted++;
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

      const updated = {
        ...order,
        status: "Packed",
        packedAt: new Date().toISOString()
      };
      await db.saveOrder(updated);
      await db.addOrderEvent(orderId, "Invoice printed — order packed");
      await db.addOrderStatusHistory(orderId, "Packed", "Admin (Bulk Invoice Print)");
      packed++;
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

      const order = await db.getOrderById(orderId);
      if (order) {
        const updatedOrder = {
          ...order,
          status: "Shipped",
          shiprocketId: shipment.awb_code || ""
        };
        await db.saveOrder(updatedOrder);
        await db.addOrderEvent(orderId, "Label generated, AWB: " + shipment.awb_code);
        await db.addOrderStatusHistory(orderId, "Shipped", "Admin (Bulk Label Generation)", {
          awb: shipment.awb_code || ""
        });
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
    const order = await db.getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    await db.saveOrder({
      id: orderId,
      status: "Return Rejected",
      returnRejectReason: reason,
    });

    const createdBy = user.email || "admin@the6k.com";
    await db.addOrderNote(orderId, `Return request rejected. Reason: ${reason}`, createdBy);

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

    await db.addOrderEvent(orderId, `Return rejected: ${reason}`);

    return { success: true };
  } catch (e: any) {
    console.error("[rejectReturnWithReasonAction] Error:", e);
    return { success: false, error: e.message || "Failed to reject return" };
  }
}

export async function assignShiprocketReturnPickupAction(
  orderId: string
): Promise<{ success: boolean; awb?: string; error?: string }> {
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

    const { shiprocket } = await import("@/lib/shiprocket");

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

    if (pickup.success && pickup.awb) {
      await db.saveOrder({
        id: orderId,
        returnAwb: pickup.awb,
        returnPickupScheduled: pickup.pickupScheduled || new Date().toISOString(),
        status: "Return Pickup Scheduled",
      });

      await db.addOrderEvent(orderId, `Return pickup scheduled. AWB: ${pickup.awb}`);

      const email = await getCustomerEmailForOrder(order);
      if (email) {
        const { sendReturnPickupAssignedEmail } = await import("@/lib/email");
        await sendReturnPickupAssignedEmail({
          id: orderId,
          customerName: order.customer || "Valued Customer",
          customerEmail: email,
          awb: pickup.awb,
        });
      }

      return { success: true, awb: pickup.awb };
    } else {
      return { success: false, error: pickup.error || "Shiprocket reverse pickup failed." };
    }
  } catch (e: any) {
    console.error("[assignShiprocketReturnPickupAction] Error:", e);
    return { success: false, error: e.message || "Failed to assign reverse pickup" };
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
    await db.saveOrder({
      id: orderId,
      status: "Return QC Pending",
    });

    await db.addOrderEvent(orderId, "Item received at warehouse. QC in progress.");
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
      await db.saveOrder({
        id: orderId,
        status: "Return Approved",
      });

      const refundRes = await processReturnRefundAction(orderId, true, reason || "Return QC Passed");
      if (!refundRes.success) {
        return { success: false, error: refundRes.error || "Failed to process refund" };
      }

      await db.addOrderEvent(orderId, "QC passed — refund initiated");
    } else {
      await db.saveOrder({
        id: orderId,
        status: "Return QC Failed",
        returnRejectReason: reason,
      });

      await db.addOrderEvent(orderId, `QC failed: ${reason}`);

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
    await db.saveOrder({
      id: orderId,
      status: "Reship Requested",
    });

    await db.addOrderEvent(orderId, "Item to be reshipped to customer");
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
    await db.saveOrder({
      id: orderId,
      status: "Return Accepted",
    });

    await db.addOrderEvent(orderId, "Return request accepted by admin");
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

export async function mockShipOrderAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await bulkUpdateOrderStatusAction([orderId], 'Shipped');
    if (result.success) {
      await db.saveOrder({
        id: orderId,
        shiprocketId: 'MOCK-AWB-' + Date.now()
      });
      await db.addOrderEvent(
        orderId,
        'Order shipped (mock/test)'
      );
      return { success: true };
    }
    return result;
  } catch (err: any) {
    console.error("[mockShipOrderAction] Error:", err);
    return { success: false, error: err.message || "Failed to mark shipped" };
  }
}

export async function mockReturnArrivedAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await bulkUpdateOrderStatusAction([orderId], 'Return in Transit');
    if (result.success) {
      await db.addOrderEvent(
        orderId,
        'Return item arrived at warehouse (mock/test)'
      );
      return { success: true };
    }
    return result;
  } catch (err: any) {
    console.error("[mockReturnArrivedAction] Error:", err);
    return { success: false, error: err.message || "Failed to mark return arrived" };
  }
}



