"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  Product,
  Order,
  Coupon,
  WalletTransaction,
  LoyaltyTransaction,
} from "@/lib/registry";

export async function getProductsAction(): Promise<{
  success: boolean;
  products?: Product[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const products = await db.getProducts();
    return { success: true, products };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load products" };
  }
}

export async function getOrdersAction(userId?: string): Promise<{
  success: boolean;
  orders?: Order[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const orders = userId
      ? await db.getUserOrders(userId)
      : await db.getOrders();
    return { success: true, orders };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load orders" };
  }
}

export async function getCustomersAction(): Promise<{
  success: boolean;
  customers?: any[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const customers = await db.getCustomers();
    return { success: true, customers };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load customers" };
  }
}

export async function getCouponsAction(): Promise<{
  success: boolean;
  coupons?: Coupon[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const coupons = await db.getCoupons();
    return { success: true, coupons };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load coupons" };
  }
}

export async function getDashboardMetricsAction(): Promise<{
  success: boolean;
  metrics?: any;
  error?: string;
}> {
  try {
    await requireAdmin();
    const metrics = await db.getDashboardMetrics();
    return { success: true, metrics };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load metrics" };
  }
}
