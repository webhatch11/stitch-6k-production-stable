"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getUserOrdersAction(userId: string) {
  try {
    const orders = await db.getUserOrders(userId);
    return { success: true, orders };
  } catch (error: any) {
    console.error("[getUserOrdersAction] Error:", error);
    return { success: false, error: error.message || "Failed to fetch orders" };
  }
}

export async function requestManualReturnAction(orderId: string, payload: {
  reason: string;
  details: string;
  image: string;
  refundOption: string;
}) {
  try {
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
    const order = await db.getOrderById(orderId);
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

