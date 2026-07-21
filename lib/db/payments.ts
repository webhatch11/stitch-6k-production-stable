import { mapDbOrderToOrder } from "./utils";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { ordersDb } from "./orders";
import { inventoryDb } from "./inventory";
import { loyaltyDb } from "./loyalty";
import { couponsDb } from "./coupons";
import { usersDb } from "./users";
import { settingsDb } from "./settings";
import { dispatchFulfillment } from "./shipments";
import { InventoryService } from "../services/inventory";
import { OrderStatusHistory } from "../types";

export interface ProRataRefundResult {
  returnedSubtotal: number;
  orderOriginalSubtotal: number;
  weightRatio: number;
  itemCouponShare: number;
  itemPointsShare: number;
  netRefundAmount: number;
  walletShare: number;
  gatewayShare: number;
  taxableAmount: number;
  gstAmount: number;
}

export function calculateProRataItemRefund(
  order: any,
  returnedItems: Array<{ price: number; quantity: number; gst_rate?: number; tax_rate?: number; taxRate?: number; gstRate?: number }>
): ProRataRefundResult {
  const returnedSubtotal = returnedItems.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  const orderOriginalSubtotal = Number(order.original_total || order.subtotal || order.total || 0);

  if (orderOriginalSubtotal <= 0 || returnedSubtotal <= 0) {
    return {
      returnedSubtotal: 0,
      orderOriginalSubtotal: 0,
      weightRatio: 0,
      itemCouponShare: 0,
      itemPointsShare: 0,
      netRefundAmount: 0,
      walletShare: 0,
      gatewayShare: 0,
      taxableAmount: 0,
      gstAmount: 0,
    };
  }

  const weightRatio = Math.min(1, Math.round((returnedSubtotal / orderOriginalSubtotal) * 10000) / 10000);
  const couponDiscount = Number(order.coupon_discount || 0);
  const pointsDiscount = Number(order.points_discount || 0);
  const walletPaid = Number(order.wallet_paid || 0);

  const itemCouponShare = Math.round((weightRatio * couponDiscount) * 100) / 100;
  const itemPointsShare = Math.round((weightRatio * pointsDiscount) * 100) / 100;
  const rawNetRefund = Math.max(0, returnedSubtotal - itemCouponShare - itemPointsShare);
  const netRefundAmount = Math.round(rawNetRefund * 100) / 100;

  // Wallet First Split Policy
  const maxWalletShare = Math.round((weightRatio * walletPaid) * 100) / 100;
  const walletShare = Math.min(netRefundAmount, maxWalletShare);
  const gatewayShare = Math.round(Math.min(netRefundAmount - walletShare, Number(order.gateway_paid || 0)) * 100) / 100;

  // Product-Specific GST Rate: Precedence Hierarchy
  const firstItem = returnedItems[0] || {};
  const itemGst = firstItem.gst_rate ?? firstItem.tax_rate ?? firstItem.taxRate ?? firstItem.gstRate;
  const unitPrice = Number(firstItem.price || returnedSubtotal);
  const gstRate = itemGst !== undefined && itemGst > 0
    ? (itemGst > 1 ? itemGst / 100 : itemGst)
    : (unitPrice <= 1000 ? 0.05 : 0.12);
  const gstDivisor = 1 + gstRate;
  const taxableAmount = Math.round((netRefundAmount / gstDivisor) * 100) / 100;
  const gstAmount = Math.round((netRefundAmount - taxableAmount) * 100) / 100;

  return {
    returnedSubtotal,
    orderOriginalSubtotal,
    weightRatio,
    itemCouponShare,
    itemPointsShare,
    netRefundAmount,
    walletShare,
    gatewayShare,
    taxableAmount,
    gstAmount,
  };
}

export async function createPaymentAuditLog(
  orderId: string,
  previousStatus: string | null,
  newStatus: string,
  source: string
): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("payment_audit_logs").insert({
    order_id: orderId,
    previous_status: previousStatus,
    new_status: newStatus,
    source: source,
  });
  if (error) {
    console.error("Error creating payment audit log:", error);
  }
}

export async function getPaymentAuditLogs(limit: number = 100): Promise<any[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("payment_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Error fetching payment audit logs:", error);
    return [];
  }
  return data || [];
}

export async function issueRefund(orderId: string, reason: string, customAmount?: number): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: orderData, error } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !orderData) return false;

  const { data: claimed, error: claimErr } = await supabase
    .from("orders")
    .update({ refund_status: "pending" })
    .eq("id", orderId)
    .is("refund_status", null)
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    return false;
  }

  const gatewayPaid = Number(orderData.gateway_paid || 0);
  const walletPaid = Number(orderData.wallet_paid || 0);
  const maxRefund = gatewayPaid + walletPaid;
  const totalRefund = customAmount !== undefined && customAmount > 0 ? Math.min(customAmount, maxRefund) : maxRefund;

  if (walletPaid > 0 && orderData.user_id) {
    const creditResult = await usersDb.applyWalletCredit(
      walletPaid,
      `Refund for Order #${orderId}: ${reason}`,
      orderId,
      orderData.user_id
    );
    if (!creditResult.success) {
      console.error("[issueRefund] wallet credit failed:", creditResult.error);
      throw new Error(`Wallet credit failed: ${creditResult.error}`);
    }
  }

  if (gatewayPaid > 0) {
    const razorpayPaymentId = orderData.razorpay_payment_id;

    if (!razorpayPaymentId) {
      await supabase
        .from("orders")
        .update({
          refund_status: "wallet_only",
          refund_amount: walletPaid,
          refund_reason: reason,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      return true;
    }

    try {
      const { razorpay } = require("../razorpay") as typeof import("../razorpay");
      const refundResult = await razorpay.payments.refund(razorpayPaymentId, {
        amount: Math.round(gatewayPaid * 100),
        speed: "normal",
        notes: { order_id: orderId, reason },
        receipt: `REF-${orderId}-${Date.now()}`,
      });

      await supabase
        .from("orders")
        .update({
          refund_id: refundResult.id,
          refund_status: "initiated",
          refund_amount: totalRefund,
          refund_reason: reason,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      return true;
    } catch (e: any) {
      console.error(`[Refund] Razorpay failed for ${orderId}:`, e.message);
      await supabase
        .from("orders")
        .update({
          refund_status: "failed",
          refund_amount: walletPaid,
          refund_reason: `${reason} | Error: ${e.message}`,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      return false;
    }
  } else {
    await supabase
      .from("orders")
      .update({
        refund_status: walletPaid > 0 ? "wallet_only" : "processed",
        refund_amount: walletPaid,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    return true;
  }
}

export async function verifyRazorpayPayment(orderId: string): Promise<{ success: boolean; status: string }> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const dbOrder = await ordersDb.getOrderById(orderId);
  if (!dbOrder) return { success: false, status: "ORDER_NOT_FOUND" };

  try {
    const { razorpay } = require("../razorpay") as typeof import("../razorpay");
    const rPayOrder = await razorpay.orders.fetch(dbOrder.id);
    if (rPayOrder.status === "paid") {
      const success = await approvePendingOrder(orderId);
      await inventoryDb.releaseReservation(dbOrder.idempotencyKey || orderId);
      await ordersDb.addOrderStatusHistory(dbOrder.idempotencyKey || orderId, "Paid", "Razorpay Hook (Verify)", {
        status_changed_to: "Paid",
      });
      return { success, status: "paid" };
    }
    return { success: false, status: rPayOrder.status };
  } catch (err: any) {
    console.error(`[verifyRazorpayPayment] Razorpay fetch failed for ${orderId}:`, err.message);
    return { success: false, status: "FETCH_FAILED" };
  }
}

export async function verifyRazorpayRefund(orderId: string): Promise<{ status: string; processedAt?: string }> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }
  const dbOrder = await ordersDb.getOrderById(orderId);
  if (!dbOrder || !dbOrder.refund_id) return { status: "NOT_FOUND" };

  try {
    const { razorpay } = require("../razorpay") as typeof import("../razorpay");
    const rPayRefund = await razorpay.refunds.fetch(dbOrder.refund_id);
    if (rPayRefund.status === "processed") {
      await supabase
        .from("orders")
        .update({ refund_status: "processed" })
        .eq("id", orderId);
      return { status: "processed", processedAt: new Date(rPayRefund.created_at * 1000).toISOString() };
    }
    return { status: rPayRefund.status };
  } catch (err: any) {
    console.error(`[verifyRazorpayRefund] Razorpay fetch failed for ${orderId}:`, err.message);
    return { status: "FETCH_FAILED" };
  }
}

export async function approvePendingOrder(orderId: string): Promise<boolean> {
  return runPostPaymentSideEffects(orderId);
}

export async function cancelOrderAndRefund(orderId: string, reason?: string): Promise<boolean> {
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
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderData) return false;
  if (orderData.status === "Cancelled") return false;

  const { data: claimed, error: claimErr } = await supabase
    .from("orders")
    .update({ refund_status: "pending" })
    .eq("id", orderId)
    .is("refund_status", null)
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    return false;
  }

  const walletPaid = Number(orderData.wallet_paid || 0);
  const gatewayPaid = Number(orderData.gateway_paid || 0);
  const totalRefundAmount = walletPaid + gatewayPaid;
  const refundReason = reason || "Order cancelled by admin";

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      refund_reason: refundReason,
      refund_amount: totalRefundAmount,
    })
    .eq("id", orderId);

  if (updateErr) {
    await supabase.from("orders").update({ refund_status: null }).eq("id", orderId);
    return false;
  }

  const { transitionOrderStatus } = await import("./orders");
  const transitionOk = await transitionOrderStatus(orderId, "Cancelled", {
    triggerSource: "Cancel & Refund Action",
    userOrAdmin: "admin",
    reason: refundReason,
  });

  if (!transitionOk) {
    console.error(`[cancelOrderAndRefund] Failed to transition order status to Cancelled for order ${orderId}`);
    return false;
  }

  await supabase
    .from("orders")
    .update({ points_credit_status: "cancelled" })
    .eq("id", orderId);

  try {
    const cancelledOrder = await ordersDb.getOrderById(orderId);
    if (cancelledOrder?.couponCode) {
      await couponsDb.decrementCouponUsage(cancelledOrder.couponCode);
    }
  } catch (e) {
    console.error("[cancelOrderAndRefund] coupon decrement failed:", e);
  }

  const cartItemsForRestock = orderData.cart_items;
  if (Array.isArray(cartItemsForRestock) && cartItemsForRestock.length > 0) {
    for (const item of cartItemsForRestock) {
      const productId = item.productId || item.product_id;
      const size = item.size;
      const color = item.color;
      const qty = item.quantity || 1;
      if (productId && size && color) {
        try {
          await InventoryService.restoreStockAtomic(productId, size, color, qty);
        } catch (e: any) {
          console.error(`[Restock] Cancel restock failed for ${productId} ${size}/${color}:`, e.message);
        }
      }
    }
  }

  if (orderData.refund_option === "wallet") {
    if (orderData.user_id) {
      const creditResult = await usersDb.applyWalletCredit(
        totalRefundAmount,
        `Refund for Cancelled Order #${orderId}`,
        orderId,
        orderData.user_id
      );
      if (!creditResult.success) {
        console.error("[cancelOrderAndRefund] wallet credit failed:", creditResult.error);
        throw new Error(`Wallet credit failed: ${creditResult.error}`);
      }
    }
    await supabase
      .from("orders")
      .update({ refund_status: "wallet_only", refunded_at: new Date().toISOString() })
      .eq("id", orderId);
  } else {
    if (walletPaid > 0 && orderData.user_id) {
      const creditResult = await usersDb.applyWalletCredit(
        walletPaid,
        `Refund of Wallet Portion for Cancelled Order #${orderId}`,
        orderId,
        orderData.user_id
      );
      if (!creditResult.success) {
        console.error("[cancelOrderAndRefund] wallet credit failed:", creditResult.error);
        throw new Error(`Wallet credit failed: ${creditResult.error}`);
      }
    }

    if (gatewayPaid > 0) {
      const razorpayPaymentId = orderData.razorpay_payment_id;

      if (!razorpayPaymentId) {
        console.warn(`[Refund] No razorpay_payment_id for order ${orderId}; skipping Razorpay refund.`);
        await supabase
          .from("orders")
          .update({ refund_status: "wallet_only", refunded_at: new Date().toISOString() })
          .eq("id", orderId);
      } else {
        try {
          const { razorpay } = require("../razorpay") as typeof import("../razorpay");
          const refundResult = await razorpay.payments.refund(razorpayPaymentId, {
            amount: Math.round(gatewayPaid * 100),
            speed: "normal",
            notes: { order_id: orderId, reason: refundReason },
            receipt: `REF-${orderId}-${Date.now()}`,
          });

          await supabase
            .from("orders")
            .update({
              refund_id: refundResult.id,
              refund_status: "initiated",
              refunded_at: new Date().toISOString(),
            })
            .eq("id", orderId);
        } catch (e: any) {
          console.error(`[Refund] Razorpay refund failed for ${orderId}:`, e.message);
          await supabase
            .from("orders")
            .update({
              refund_status: "failed",
              refund_reason: `${refundReason} | Razorpay error: ${e.message}`,
              refunded_at: new Date().toISOString(),
            })
            .eq("id", orderId);
        }
      }
    } else {
      await supabase
        .from("orders")
        .update({
          refund_status: walletPaid > 0 ? "wallet_only" : "processed",
          refunded_at: new Date().toISOString(),
        })
        .eq("id", orderId);
    }
  }

  const pointsEarned = Number(orderData.points_earned || 0);
  if (pointsEarned > 0 && orderData.user_id) {
    await loyaltyDb.applyLoyaltyDebit(pointsEarned, "REVOKE-CANCEL-" + orderId, orderData.user_id);
  }

  const pointsRedeemed = Number(orderData.points_redeemed || 0);
  if (pointsRedeemed > 0 && orderData.user_id) {
    await loyaltyDb.applyLoyaltyCredit(pointsRedeemed, `Restored for Cancelled Order #${orderId}`, "RESTORE-CANCEL-" + orderId, orderData.user_id);
  }

  return true;
}

export interface RefundSplit {
  walletRefundPaise: number;
  gatewayRefundPaise: number;
  targetRefundPaise: number;
}

export interface ValidationResult {
  isValid: boolean;
  errorReason?: string;
}

export function validateRefundSplit(split: RefundSplit): ValidationResult {
  if (split.walletRefundPaise < 0 || split.gatewayRefundPaise < 0) {
    return { isValid: false, errorReason: "Negative refund splits are not permitted." };
  }
  if ((split.walletRefundPaise + split.gatewayRefundPaise) !== split.targetRefundPaise) {
    return {
      isValid: false,
      errorReason: `Split mismatch. Wallet: ${split.walletRefundPaise} paise, Gateway: ${split.gatewayRefundPaise} paise, Target: ${split.targetRefundPaise} paise.`
    };
  }
  return { isValid: true };
}

export async function processReturnRefund(
  orderId: string,
  qualityCheckPassed = true,
  reason?: string,
  overrideAmount?: number,
  overrideReason?: string
): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  // 1. Fetch current order state
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount, points_credit_status, points_credit_scheduled_at, packed_at, accepted_at, returned_items")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderData) {
    throw new Error("Order not found.");
  }

  // Task 8 & Task 3 & Task 2: Server-Side Idempotency & Concurrency Locking
  const refStatus = (orderData.refund_status || "").toLowerCase();
  if (orderData.status === "Returned" || ["initiated", "success", "wallet_only", "processed", "wallet_credited", "completed"].includes(refStatus)) {
    throw new Error("Refund has already been processed or initiated for this order.");
  }

  // CAS Lock: Atomically claim refund execution by moving refund_status to 'pending'
  const { data: claimed, error: claimErr } = await supabase
    .from("orders")
    .update({ refund_status: "pending" })
    .eq("id", orderId)
    .or("refund_status.is.null,refund_status.eq.failed")
    .neq("status", "Returned")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    throw new Error("Refund operation in progress by another request or already completed.");
  }

  try {
    const order = mapDbOrderToOrder(orderData);
    const returnedItemsList = order.returnedItems || [];
    
    let totalRefundAmount = 0;
    let walletRefundAmount = 0;
    let gatewayRefundAmount = 0;
    let pointsToReverse = 0;
    let pointsToRestore = 0;

    if (returnedItemsList.length > 0) {
      for (const item of returnedItemsList) {
        totalRefundAmount += Number(item.refundAmount || item.calculatedRefund || 0);
        walletRefundAmount += Number(item.walletRefund || 0);
        gatewayRefundAmount += Number(item.gatewayRefund || 0);
        pointsToReverse += Number(item.pointsToReverse || 0);
        pointsToRestore += Number(item.pointsToRestore || 0);
      }
    } else {
      // Legacy order fallback: refund full order totals safely
      const walletPaid = Number(order.walletPaid || 0);
      const gatewayPaid = Number(order.gatewayPaid || 0);
      totalRefundAmount = walletPaid + gatewayPaid;
      walletRefundAmount = walletPaid;
      gatewayRefundAmount = gatewayPaid;
      pointsToReverse = Number(order.pointsEarned || 0);
      pointsToRestore = Number(order.pointsRedeemed || 0);
    }

    const originalWallet = Number(order.walletPaid || 0);
    const originalGateway = Number(order.gatewayPaid || 0);
    const maxRefundable = originalWallet + originalGateway;

    // Convert inputs to integer paise
    const originalWalletPaise = Math.round(originalWallet * 100);
    const originalGatewayPaise = Math.round(originalGateway * 100);
    const maxRefundablePaise = originalWalletPaise + originalGatewayPaise;

    let walletRefundPaise = Math.round(walletRefundAmount * 100);
    let gatewayRefundPaise = Math.round(gatewayRefundAmount * 100);
    let totalRefundPaise = Math.round(totalRefundAmount * 100);

    // Task 4: Refund Validation and override
    let enrichedReturnedItemsList = [...returnedItemsList];
    if (overrideAmount !== undefined) {
      const overrideAmountPaise = Math.round(overrideAmount * 100);
      if (overrideAmountPaise <= 0) {
        throw new Error("Refund override amount must be greater than zero.");
      }
      if (overrideAmountPaise > maxRefundablePaise) {
        throw new Error(`Refund override amount (₹${overrideAmount}) cannot exceed original payment total (₹${maxRefundable}).`);
      }
      if (totalRefundPaise > 0 && overrideAmountPaise > totalRefundPaise) {
        throw new Error(`Refund override amount (₹${overrideAmount}) cannot exceed calculated item refund (₹${totalRefundAmount}).`);
      }

      const totalCalculated = totalRefundPaise || 1;
      enrichedReturnedItemsList = returnedItemsList.map((item: any) => {
        const origCalculated = Math.round((item.calculatedRefund || item.refundAmount || 0) * 100);
        const ratio = totalCalculated > 0 ? (origCalculated / totalCalculated) : (1 / (returnedItemsList.length || 1));
        const itemOverrideRefundPaise = Math.round(overrideAmountPaise * ratio);
        const itemWalletOverridePaise = Math.round(Math.round((item.walletRefund || 0) * 100) * ratio);
        const itemGatewayOverridePaise = Math.round(Math.round((item.gatewayRefund || 0) * 100) * ratio);
        return {
          ...item,
          calculatedRefund: origCalculated / 100,
          refundAmount: itemOverrideRefundPaise / 100,
          walletRefund: itemWalletOverridePaise / 100,
          gatewayRefund: itemGatewayOverridePaise / 100,
          overrideReason: overrideReason || "Admin manual override"
        };
      });

      if (totalRefundPaise > 0) {
        const ratio = overrideAmountPaise / totalRefundPaise;
        walletRefundPaise = Math.round(walletRefundPaise * ratio);
        gatewayRefundPaise = Math.round(gatewayRefundPaise * ratio);
      } else {
        walletRefundPaise = overrideAmountPaise;
        gatewayRefundPaise = 0;
      }
      totalRefundPaise = overrideAmountPaise;
    } else {
      // Legacy / default safety: Ensure calculatedRefund key is initialized in snapshot
      enrichedReturnedItemsList = returnedItemsList.map((item: any) => ({
        ...item,
        calculatedRefund: item.calculatedRefund || item.refundAmount || 0
      }));
    }

    // Task 4: Cap & Validate Split Payments
    walletRefundPaise = Math.min(walletRefundPaise, originalWalletPaise);
    gatewayRefundPaise = Math.min(gatewayRefundPaise, originalGatewayPaise);
    totalRefundPaise = walletRefundPaise + gatewayRefundPaise;

    if (totalRefundPaise <= 0) {
      throw new Error("Calculated net refund amount must be greater than zero.");
    }

    // Enforce split assertions
    const validationResult = validateRefundSplit({
      walletRefundPaise,
      gatewayRefundPaise,
      targetRefundPaise: totalRefundPaise
    });
    if (!validationResult.isValid) {
      throw new Error(`[Ledger Invariant Violation] ${validationResult.errorReason}`);
    }

    // Convert back to Rupees
    walletRefundAmount = walletRefundPaise / 100;
    gatewayRefundAmount = gatewayRefundPaise / 100;
    totalRefundAmount = totalRefundPaise / 100;

    const refundReason = overrideReason 
      ? `Override: ${overrideReason}. Reason: ${reason || "None"}`
      : (reason || "Return approved by admin");

    // Fetch user profile and create or fetch database refund record to obtain a stable refundId
    let refundId = orderData.refund_id;
    if (!refundId) {
      const { data: newRefund, error: refundErr } = await supabase
        .from("refunds")
        .insert({
          order_id: orderId,
          user_id: orderData.user_id,
          wallet_amount: walletRefundAmount,
          gateway_amount: gatewayRefundAmount,
          total_refund_amount: totalRefundAmount,
          status: "PENDING",
          reason: refundReason
        })
        .select("id")
        .maybeSingle();

      if (refundErr || !newRefund) {
        throw new Error(`Failed to create database refund record: ${refundErr?.message || "unknown error"}`);
      }
      refundId = newRefund.id;
    }

    let refundSuccessful = false;
    let finalRefundStatus = "processed";
    let razorpayRefundId: string | null = null;

    // Split payment refund execution
    if (order.refundOption === "wallet") {
      if (order.userId) {
        const creditResult = await usersDb.applyWalletCredit(
          totalRefundAmount,
          `Return Credit for Order #${orderId}`,
          orderId,
          order.userId,
          `WALLET-CREDIT-${orderId}-REF-${refundId}`
        );
        if (!creditResult.success) {
          throw new Error(`Wallet credit failed: ${creditResult.error}`);
        }
      }
      refundSuccessful = true;
      finalRefundStatus = "wallet_only";
    } else {
      // Quality passed: split wallet vs bank refund
      if (qualityCheckPassed) {
        if (walletRefundAmount > 0 && order.userId) {
          const creditResult = await usersDb.applyWalletCredit(
            walletRefundAmount,
            `Refund for return — Order #${orderId}`,
            orderId,
            order.userId,
            `WALLET-CREDIT-${orderId}-REF-${refundId}`
          );
          if (!creditResult.success) {
            throw new Error(`Wallet credit failed: ${creditResult.error}`);
          }
        }

        if (gatewayRefundAmount > 0 && order.razorpayPaymentId) {
          try {
            const { razorpay } = require("../razorpay") as typeof import("../razorpay");
            const razorpayRefund = await razorpay.payments.refund(order.razorpayPaymentId, {
              amount: Math.round(gatewayRefundAmount * 100),
              notes: { orderId: orderId, reason: 'Return approved' }
            });
            razorpayRefundId = razorpayRefund.id;
            finalRefundStatus = "initiated";
            refundSuccessful = true;
          } catch (razorpayErr: any) {
            console.error('[processReturnRefund] Razorpay refund failed:', razorpayErr);
            throw new Error(`Razorpay gateway refund failed: ${razorpayErr.message}`);
          }
        } else {
          refundSuccessful = true;
          finalRefundStatus = walletRefundAmount > 0 ? "wallet_only" : "processed";
        }
      } else {
        refundSuccessful = true;
        finalRefundStatus = "qc_rejected";
      }
    }

    if (refundSuccessful) {
      // Update refund record status to PROCESSED
      await supabase
        .from("refunds")
        .update({
          status: finalRefundStatus === "qc_rejected" ? "FAILED" : "PROCESSED",
          gateway_refund_id: razorpayRefundId
        })
        .eq("id", refundId);

      // Record in Financial Ledger
      if (finalRefundStatus !== "qc_rejected") {
        await supabase
          .from("financial_ledger")
          .insert({
            order_id: orderId,
            event_type: "refund_issued",
            amount: totalRefundAmount,
            source_entity_type: "refund",
            source_entity_id: refundId,
            metadata: {
              wallet_refund: walletRefundAmount,
              gateway_refund: gatewayRefundAmount,
              reason: refundReason
            }
          });

        // Generate GST Credit Note
        try {
          const cnItems = enrichedReturnedItemsList.map((item: any) => ({
            product_id: item.productId || null,
            order_line_id: item.orderItemId || item.productId || "",
            sku: item.sku || item.size || "M",
            quantity: item.quantity || 1,
            gst_rate: item.gstRate || 12,
            taxable_value: item.taxableAmount || 0,
            cgst: item.cgst || 0,
            sgst: item.sgst || 0,
            igst: 0,
            hsn: item.hsn || "61091000",
            reason: item.reason || refundReason
          }));

          const originalInvoiceId = orderId.replace("6K-RPO-", "").replace("6K-WPO-", "");
          const originalInvoiceDate = orderData.created_at 
            ? new Date(orderData.created_at).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          const totalTaxable = enrichedReturnedItemsList.reduce((sum: number, item: any) => sum + (item.taxableAmount || 0), 0);
          const totalCgst = enrichedReturnedItemsList.reduce((sum: number, item: any) => sum + (item.cgst || 0), 0);
          const totalSgst = enrichedReturnedItemsList.reduce((sum: number, item: any) => sum + (item.sgst || 0), 0);

          const { data: cnResult, error: cnErr } = await supabase.rpc("create_credit_note_atomic", {
            p_order_id: orderId,
            p_return_request_id: null,
            p_original_invoice_id: originalInvoiceId,
            p_original_invoice_date: originalInvoiceDate,
            p_taxable: totalTaxable,
            p_cgst: totalCgst,
            p_sgst: totalSgst,
            p_igst: 0,
            p_refund: totalRefundAmount,
            p_reason_code: "Sales Return",
            p_issued_by: "system",
            p_items: cnItems
          });

          if (cnErr) {
            console.error("[processReturnRefund] Failed to generate credit note:", cnErr.message);
          } else {
            console.log("[processReturnRefund] Credit note result:", cnResult);
          }
        } catch (cnCatchErr: any) {
          console.error("[processReturnRefund] Credit note error catch:", cnCatchErr.message);
        }
      }
    }

    // Task 7 & Task 1: Inventory Restoration Guard
    // Inventory restoration MUST occur ONLY when QC Passed AND Refund Completed!
    if (qualityCheckPassed && refundSuccessful) {
      try {
        const restockItems = enrichedReturnedItemsList.length > 0 ? enrichedReturnedItemsList : (order.cartItems || []);
        if (restockItems.length > 0) {
          const itemsForRestock = restockItems.map((item: any) => ({
            productName: item.productName || item.productId || "",
            size: item.size || item.variant || "M",
            color: item.color || "Default",
            quantity: item.quantity || 1,
          }));
          await inventoryDb.restoreStock(itemsForRestock, orderId);
          console.log('[processReturnRefund] Stock restored for order', order.id);
        }
      } catch (stockErr) {
        console.error('[processReturnRefund] Stock restore warning:', stockErr);
      }
    }

    // Reversing loyalty points on return
    try {
      if (pointsToReverse > 0 && order.userId) {
        await loyaltyDb.applyLoyaltyDebit(
          pointsToReverse, 
          orderId, 
          order.userId,
          `LOYALTY-DEBIT-${orderId}-REF-${refundId}`
        );
      }
      if (pointsToRestore > 0 && order.userId) {
        await loyaltyDb.applyLoyaltyCredit(
          pointsToRestore, 
          `Redeemed points restored — Order #${orderId}`, 
          orderId, 
          order.userId,
          `LOYALTY-CREDIT-${orderId}-REF-${refundId}`
        );
      }
      if (returnedItemsList.length === 0 || totalRefundAmount >= maxRefundable) {
        await supabase.from('orders').update({ points_credit_status: 'cancelled' }).eq('id', orderId);
      }
    } catch (loyaltyErr) {
      console.error('[processReturnRefund] loyalty reversal warning:', loyaltyErr);
    }

    if (qualityCheckPassed && orderData?.coupon_code) {
      try { await couponsDb.decrementCouponUsage(orderData.coupon_code); } catch {}
    }

    // Final Order Status Update
    const returnDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const { error: orderUpdateErr } = await supabase
      .from("orders")
      .update({
        status: "Returned",
        return_date: returnDate,
        quality_check_passed: qualityCheckPassed,
        refund_reason: refundReason,
        refund_amount: totalRefundAmount,
        refund_status: finalRefundStatus,
        refund_id: razorpayRefundId || orderData.refund_id,
        refunded_at: new Date().toISOString(),
        returned_items: enrichedReturnedItemsList
      })
      .eq("id", orderId);

    if (orderUpdateErr) {
      throw new Error(`Failed to update final order status: ${orderUpdateErr.message}`);
    }

    return true;
  } catch (err: any) {
    // Transaction Rollback Guard: Revert refund_status from 'pending' back to 'failed' on error
    await supabase
      .from("orders")
      .update({
        refund_status: "failed",
        refund_reason: `Refund Failed: ${err.message}`
      })
      .eq("id", orderId);
    throw err;
  }
}

export async function claimPaymentAtomically(orderId: string, razorpayPaymentId: string): Promise<{ success: boolean; message: string; status?: string }> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }
  const { data, error } = await supabase.rpc('atomic_claim_payment', { p_order_id: orderId, p_payment_id: razorpayPaymentId });
  if (error) {
    console.error('[claimPaymentAtomically] RPC error:', error);
    return { success: false, message: 'RPC Error' };
  }
  return data as { success: boolean; message: string; status?: string };
}

export async function confirmOrderAndProcessPaymentsAtomic(params: {
  orderId: string;
  paymentId: string;
  walletDeduction: number;
  pointsRedeemed: number;
  couponCode: string;
  earnedPoints: number;
  method: "razorpay" | "wallet";
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }

  const { data, error } = await supabase.rpc("confirm_order_and_process_payments_atomic", {
    p_order_id: params.orderId,
    p_payment_id: params.paymentId,
    p_wallet_deduction: params.walletDeduction,
    p_points_redeemed: params.pointsRedeemed,
    p_coupon_code: params.couponCode || "",
    p_earned_points: params.earnedPoints,
    p_method: params.method
  });

  if (error) {
    console.error("[confirmOrderAndProcessPaymentsAtomic] RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

export async function runPostPaymentSideEffects(orderId: string, razorpayPaymentId?: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return false;

  const dbOrder = await ordersDb.getOrderById(orderId);
  if (!dbOrder) return false;

  if (dbOrder.paymentStatus?.toLowerCase() === "paid" || dbOrder.status?.toLowerCase() === "paid" || dbOrder.status?.toLowerCase() === "paid via wallet") {
    console.log(`[runPostPaymentSideEffects] Order ${orderId} is already processed as Paid. Skipping duplicate side effects.`);
    return true;
  }

  const loyaltyConfig = await settingsDb.getLoyaltyConfig();
  const earned = Math.floor(dbOrder.total / 100) * loyaltyConfig.pointsPer100;

  const res = await confirmOrderAndProcessPaymentsAtomic({
    orderId,
    paymentId: razorpayPaymentId || "manual",
    walletDeduction: dbOrder.walletPaid || 0,
    pointsRedeemed: dbOrder.pointsRedeemed || 0,
    couponCode: dbOrder.couponCode || "",
    earnedPoints: earned,
    method: razorpayPaymentId ? "razorpay" : "wallet"
  });

  return res.success;
}

export const paymentsDb = {
  createPaymentAuditLog,
  getPaymentAuditLogs,
  issueRefund,
  verifyRazorpayPayment,
  verifyRazorpayRefund,
  approvePendingOrder,
  cancelOrderAndRefund,
  processReturnRefund,
  runPostPaymentSideEffects,
  confirmOrderAndProcessPaymentsAtomic,
};
