"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  Product,
  Order,
  Coupon,
  WalletTransaction,
  LoyaltyTransaction,
} from "@/lib/types";

export async function getProductsAction(options?: { includeDeleted?: boolean; trashedOnly?: boolean; display_section?: string }): Promise<{
  success: boolean;
  products?: Product[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const products = await db.getProducts(options);
    return { success: true, products };
  } catch (e: any) {
    console.error('[admin-reads.ts]:', e);
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
    console.error('[admin-reads.ts]:', e);
    return { success: false, error: e.message || "Failed to load orders" };
  }
}

export async function getCustomerProfileAction(userId: string): Promise<{
  success: boolean;
  profile?: { name: string | null; email: string | null; phone: string | null };
  error?: string;
}> {
  try {
    await requireAdmin();
    const profile = await db.getCustomerProfile(userId);
    return { success: true, profile };
  } catch (e: any) {
    console.error('[admin-reads.ts]:', e);
    return { success: false, error: e.message || "Failed to load customer profile" };
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
    console.error('[admin-reads.ts]:', e);
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
    console.error('[admin-reads.ts]:', e);
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
    console.error('[admin-reads.ts]:', e);
    return { success: false, error: e.message || "Failed to load metrics" };
  }
}

export async function getBestSellersAction(dateRange: "7d" | "30d" | "all"): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { supabaseService, isServiceClientConfigured } = await import("@/lib/supabase-service");
    const supabase = supabaseService;
    const isSupabaseConfigured = isServiceClientConfigured;
    let orders: any[] = [];
    let products: any[] = [];

    if (!isSupabaseConfigured || !supabase) {
      const ordersRes = await db.getOrders();
      orders = ordersRes || [];
      const prodsRes = await db.getProducts();
      products = prodsRes || [];
    } else {
      const { data: dbProducts, error: prodErr } = await supabase
        .from("products")
        .select("*");
      if (prodErr) throw prodErr;
      products = dbProducts || [];

      let query = supabase.from("orders").select("*");
      if (dateRange === "7d") {
        const cutOff = new Date();
        cutOff.setDate(cutOff.getDate() - 7);
        query = query.gte("created_at", cutOff.toISOString());
      } else if (dateRange === "30d") {
        const cutOff = new Date();
        cutOff.setDate(cutOff.getDate() - 30);
        query = query.gte("created_at", cutOff.toISOString());
      }

      const { data: dbOrders, error: orderErr } = await query;
      if (orderErr) throw orderErr;
      orders = dbOrders || [];
    }

    const activeOrders = orders.filter((o) => {
      const status = (o.status || "").toLowerCase();
      const refundStatus = (o.refund_status || o.refundStatus || "").toLowerCase();
      return status !== "cancelled" && refundStatus !== "processed";
    });

    const bestSellersMap = new Map<string, {
      productId: string;
      title: string;
      image: string;
      unitsSold: number;
      revenue: number;
      stockStatus: string;
    }>();

    const productMap = new Map<string, any>();
    for (const p of products) {
      productMap.set(p.id, p);
    }

    for (const order of activeOrders) {
      if (dateRange !== "all") {
        const orderDateStr = order.created_at || order.createdAt || order.date;
        let orderTime = Date.parse(orderDateStr);
        if (isNaN(orderTime)) {
          const parts = orderDateStr.split("/");
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            orderTime = d.getTime();
          } else {
            orderTime = Date.now();
          }
        }
        
        const now = Date.now();
        const diffDays = (now - orderTime) / (1000 * 60 * 60 * 24);
        if (dateRange === "7d" && diffDays > 7) continue;
        if (dateRange === "30d" && diffDays > 30) continue;
      }

      const cartItems = order.cart_items || order.cartItems || [];
      if (!Array.isArray(cartItems)) continue;

      for (const item of cartItems) {
        const pId = item.productId || item.product_id;
        if (!pId) continue;

        const quantity = Number(item.quantity || 1);
        const prod = productMap.get(pId);
        
        const itemPrice = Number(item.price !== undefined ? item.price : (prod ? (prod.basePrice !== undefined ? prod.basePrice : prod.price) : 0));
        const itemRevenue = itemPrice * quantity;

        const title = prod ? prod.title : (item.title || pId);
        const image = prod ? (prod.image || (prod.images && prod.images[0])) : (item.image || "");
        
        let stockStatus = "In Stock";
        if (prod) {
          const variants = prod.variants || [];
          const totalStock = variants.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);
          if (totalStock === 0) {
            stockStatus = "Out of Stock";
          } else if (totalStock < 10) {
            stockStatus = "Low Stock";
          } else {
            stockStatus = "In Stock";
          }
        }

        const existing = bestSellersMap.get(pId);
        if (existing) {
          existing.unitsSold += quantity;
          existing.revenue += itemRevenue;
        } else {
          bestSellersMap.set(pId, {
            productId: pId,
            title,
            image: image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200",
            unitsSold: quantity,
            revenue: itemRevenue,
            stockStatus,
          });
        }
      }
    }

    const result = Array.from(bestSellersMap.values());
    result.sort((a, b) => b.unitsSold - a.unitsSold);
    const top50 = result.slice(0, 50);

    return { success: true, data: top50 };
  } catch (e: any) {
    console.error("Error in getBestSellersAction:", e);
    return { success: false, error: e.message || "Failed to calculate best sellers" };
  }
}
