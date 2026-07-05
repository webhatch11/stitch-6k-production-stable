"use server";

import { db } from "@/lib/db";
import { getServerUser } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Returns the orders of the CALLER (session user). The userId argument is
 * kept for backward compatibility but is only honored when it matches the
 * session user, or when the caller is an admin.
 */
export async function getUserOrdersAction(userId: string) {
  try {
    const user = await getServerUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }
    const targetUserId = user.role === "admin" && userId ? userId : user.id;
    const orders = await db.getUserOrders(targetUserId);
    return { success: true, orders };
  } catch (error: any) {
    console.error("[getUserOrdersAction] Error:", error);
    return { success: false, error: error.message || "Failed to fetch orders" };
  }
}

async function assertOrderOwnership(orderId: string) {
  const user = await getServerUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  const order = await db.getOrderById(orderId);
  if (!order) return { ok: false as const, error: "Order not found" };

  const orderUserId = (order as any).userId || (order as any).user_id;
  if (user.role !== "admin" && orderUserId && orderUserId !== user.id) {
    return { ok: false as const, error: "Order not found" };
  }
  return { ok: true as const, order };
}

export async function requestManualReturnAction(orderId: string, payload: {
  reason: string;
  details: string;
  image: string;
  refundOption: string;
}) {
  try {
    const ownership = await assertOrderOwnership(orderId);
    if (!ownership.ok) {
      return { success: false, error: ownership.error };
    }
    const order = ownership.order;
    if (order.status.toLowerCase() !== "delivered") {
      return { success: false, error: "Only delivered orders are eligible for return." };
    }
    const deliveredAtStr = (order as any).deliveredAt || (order as any).delivered_at;
    if (deliveredAtStr) {
      const deliveredAt = new Date(deliveredAtStr);
      const daysSinceDelivery = Math.floor(
        (Date.now() - deliveredAt.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      const RETURN_WINDOW_DAYS = 7;
      if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
        return {
          success: false,
          error: `Return window closed. Returns must be requested within 7 days of delivery. This order was delivered ${daysSinceDelivery} days ago.`
        };
      }
    }
    const success = await db.requestManualReturn(orderId, payload);
    if (success) {
      revalidatePath("/orderhistory");
      return { success: true };
    }
    return { success: false, error: "Order may not be eligible for return" };
  } catch (error: any) {
    console.error("[requestManualReturnAction] Error:", error);
    return { success: false, error: error.message || "Failed to submit return request" };
  }
}

export async function updateOrderToProcessingAction(orderId: string) {
  try {
    const ownership = await assertOrderOwnership(orderId);
    if (!ownership.ok) {
      return { success: false, error: ownership.error };
    }
    const order = ownership.order;
    if (order && order.status === "Paid") {
      const updated = { ...order, status: "Processing" as const };
      await db.saveOrder(updated);
      revalidatePath("/orderhistory");
      return { success: true, order: updated };
    }
    return { success: false, error: "Order not found or not in Paid status" };
  } catch (error: any) {
    console.error("[updateOrderToProcessingAction] Error:", error);
    return { success: false, error: error.message || "Failed to update order status" };
  }
}
