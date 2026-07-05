"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function getRevenueTrendAction(days: number) {
  try {
    await requireAdmin();
    const trend = await db.getRevenueTrend(days);
    return { success: true, data: trend };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load revenue trend" };
  }
}

export async function getTopProductsAction(days: number) {
  try {
    await requireAdmin();
    const products = await db.getTopProducts(days, 8);
    return { success: true, data: products };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load top products" };
  }
}
