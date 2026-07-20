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

export async function issueRefund(orderId: string, reason: string): Promise<boolean> {
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
  const totalRefund = gatewayPaid + walletPaid;

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

export async function processReturnRefund(orderId: string, qualityCheckPassed = true, reason?: string): Promise<boolean> {
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
  if (orderData.status === "Returned") return false;

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

  const order = mapDbOrderToOrder(orderData);
  const walletPaid = order.walletPaid || 0;
  const gatewayPaid = order.gatewayPaid || 0;
  const totalRefundAmount = walletPaid + gatewayPaid;
  const refundReason = reason || "Return approved by admin";

  // FIX 3: Reversing loyalty points on return
  try {
    // 1. Reverse earned points (points customer earned from this order)
    // Note: applyLoyaltyDebit takes 3 parameters: points, orderId, userId
    if (order.pointsEarned && order.pointsEarned > 0 && order.userId) {
      await loyaltyDb.applyLoyaltyDebit(
        order.pointsEarned,
        orderId,
        order.userId
      );
    }

    // 2. Restore redeemed points (points customer SPENT at checkout)
    // Note: applyLoyaltyCredit takes 4 parameters: points, description, orderId, userId
    if (order.pointsRedeemed && order.pointsRedeemed > 0 && order.userId) {
      await loyaltyDb.applyLoyaltyCredit(
        order.pointsRedeemed,
        `Redeemed points restored — Order #${orderId}`,
        orderId,
        order.userId
      );
    }

    // 3. Cancel pending points credit
    await supabase
      .from('orders')
      .update({ points_credit_status: 'cancelled' })
      .eq('id', orderId);
  } catch (loyaltyErr) {
    console.error('[processReturnRefund] loyalty reversal failed:', loyaltyErr);
  }

  if (qualityCheckPassed) {
    try {
      const codeToDecrement = orderData?.coupon_code;
      if (codeToDecrement) {
        await couponsDb.decrementCouponUsage(codeToDecrement);
      }
    } catch (e) {
      console.error("[processReturnRefund] coupon decrement failed:", e);
    }
  }

  // FIX 4: Split payment refund
  if (order.refundOption === "wallet") {
    if (order.userId) {
      const creditResult = await usersDb.applyWalletCredit(
        totalRefundAmount,
        `Return Credit for Order #${orderId}`,
        orderId,
        order.userId
      );
      if (!creditResult.success) {
        console.error("[processReturnRefund] wallet credit failed:", creditResult.error);
        throw new Error(`Wallet credit failed: ${creditResult.error}`);
      }
    }
    await supabase
      .from("orders")
      .update({ refund_status: "wallet_only", refunded_at: new Date().toISOString() })
      .eq("id", orderId);
  } else {
    if (qualityCheckPassed) {
      // Refund wallet portion back to wallet
      if (walletPaid > 0 && order.userId) {
        const creditResult = await usersDb.applyWalletCredit(
          walletPaid,
          `Refund for return — Order #${orderId}`,
          orderId,
          order.userId
        );
        if (!creditResult.success) {
          console.error("[processReturnRefund] wallet credit failed:", creditResult.error);
          throw new Error(`Wallet credit failed: ${creditResult.error}`);
        }
      }

      // Refund Razorpay portion back to bank
      if (gatewayPaid > 0 && order.razorpayPaymentId) {
        try {
          const { razorpay } = require("../razorpay") as typeof import("../razorpay");
          const razorpayRefund = await razorpay.payments.refund(order.razorpayPaymentId, {
            amount: Math.round(gatewayPaid * 100), // paise
            notes: {
              orderId: orderId,
              reason: 'Return approved'
            }
          });
          
          await supabase
            .from('orders')
            .update({
              refund_id: razorpayRefund.id,
              refund_status: 'initiated',
              refund_amount: totalRefundAmount,
              refunded_at: new Date().toISOString()
            })
            .eq('id', orderId);
        } catch (razorpayErr: any) {
          console.error('[processReturnRefund] Razorpay refund failed:', razorpayErr);
          await supabase
            .from('orders')
            .update({
              refund_status: 'failed',
              refund_reason: `Razorpay refund failed: ${razorpayErr.message}`,
              refunded_at: new Date().toISOString()
            })
            .eq('id', orderId);
        }
      }

      // If wallet-only order
      if (walletPaid > 0 && gatewayPaid === 0) {
        await supabase
          .from('orders')
          .update({
            refund_status: 'wallet_only',
            refund_amount: walletPaid,
            refunded_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }
    }
  }

  // Restore stock for returned items only if quality check passed.
  // Use the array overload so each item's `color` is forwarded to the atomic
  // RPC — the single-item overload hard-codes "Default" and would miss named
  // colour variants (e.g. "Navy", "Crimson") stored in product_variants.
  try {
    if (qualityCheckPassed && order.cartItems && order.cartItems.length > 0) {
      // Map to the shape expected by the array overload:
      //   { productName, size, color, quantity }
      // productName is matched against the products table inside restoreStock.
      // Fallback to product ID when productName is absent (legacy orders).
      const itemsForRestock = order.cartItems.map((item: any) => ({
        productName: item.productName || item.productId || "",
        size: item.size || item.variant || "M",
        color: item.color || "Default",
        quantity: item.quantity || 1,
      }));
      // Pass orderId as the sessionId so the idempotency key is order-scoped.
      await inventoryDb.restoreStock(itemsForRestock, orderId);
      console.log(
        '[processReturnRefund] Stock restored for order',
        order.id
      );
    }
  } catch (stockErr) {
    console.error(
      '[processReturnRefund] Stock restore failed (non-fatal, requires manual review):',
      stockErr
    );
    // Do not abort the refund if stock restore fails; log for ops review.
  }

  // Update order status to Returned
  const returnDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const { error: orderUpdateErr } = await supabase
    .from("orders")
    .update({
      status: "Returned",
      return_date: returnDate,
      quality_check_passed: qualityCheckPassed,
      refund_reason: refundReason,
      refund_amount: totalRefundAmount,
    })
    .eq("id", orderId);

  if (orderUpdateErr) {
    console.error("[processReturnRefund] Failed to update final status to Returned:", orderUpdateErr.message);
  }

  return true;
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
