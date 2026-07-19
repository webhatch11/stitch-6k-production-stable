/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { ordersDb } from "./orders";
import { productsDb } from "./products";
import { CategorySales, RepeatPurchaseStats, AdSpend, ROASReport } from "./types";
import { InventoryService } from "../services/inventory";

export async function getTodaySalesKPI(): Promise<{
  todaySales: number;
  todayOrders: number;
  salesChangePercent: number;
  ordersChangePercent: number;
  salesTrendStatus: "up" | "down" | "none" | "first";
  ordersTrendStatus: "up" | "down" | "none" | "first";
}> {
  try {
    const orders = (await ordersDb.getOrders()) as any[];
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    nowIST.setUTCHours(0, 0, 0, 0);
    const todayStart = nowIST.getTime() - IST_OFFSET_MS;
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    let todaySales = 0;
    let todayOrders = 0;
    let yesterdaySales = 0;
    let yesterdayOrders = 0;

    const parseOrderDate = (o: any): number => {
      const orderDateStr = o.created_at || o.createdAt || o.date;
      if (!orderDateStr) return Date.now();
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
      return orderTime;
    };

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      if (
        status === "cancelled" ||
        status === "returned" ||
        status === "failed" ||
        status === "payment pending" ||
        status === "expired" ||
        status === "payment review required"
      ) {
        continue;
      }

      const orderTime = parseOrderDate(o);
      if (orderTime >= todayStart) {
        todaySales += Number(o.total || 0);
        todayOrders += 1;
      } else if (orderTime >= yesterdayStart && orderTime < todayStart) {
        yesterdaySales += Number(o.total || 0);
        yesterdayOrders += 1;
      }
    }

    let salesChangePercent = 0;
    let salesTrendStatus: "up" | "down" | "none" | "first" = "none";
    if (yesterdaySales === 0) {
      salesTrendStatus = todaySales > 0 ? "first" : "none";
    } else {
      const diff = todaySales - yesterdaySales;
      salesChangePercent = Math.round((diff / yesterdaySales) * 100);
      salesTrendStatus = diff > 0 ? "up" : diff < 0 ? "down" : "none";
    }

    let ordersChangePercent = 0;
    let ordersTrendStatus: "up" | "down" | "none" | "first" = "none";
    if (yesterdayOrders === 0) {
      ordersTrendStatus = todayOrders > 0 ? "first" : "none";
    } else {
      const diff = todayOrders - yesterdayOrders;
      ordersChangePercent = Math.round((diff / yesterdayOrders) * 100);
      ordersTrendStatus = diff > 0 ? "up" : diff < 0 ? "down" : "none";
    }

    return {
      todaySales,
      todayOrders,
      salesChangePercent,
      ordersChangePercent,
      salesTrendStatus,
      ordersTrendStatus,
    };
  } catch (e) {
    console.error("Error in getTodaySalesKPI:", e);
    return {
      todaySales: 0,
      todayOrders: 0,
      salesChangePercent: 0,
      ordersChangePercent: 0,
      salesTrendStatus: "none",
      ordersTrendStatus: "none",
    };
  }
}

export async function getDashboardKPIMetrics(): Promise<{
  aov: number;
  pendingShipments: number;
  refundRequests: number;
  customerGrowth: number;
  conversionRate: number;
  conversionRatePrev: number;
}> {
  try {
    const orders = (await ordersDb.getOrders()) as any[];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const parseOrderDate = (o: any): number => {
      const orderDateStr = o.created_at || o.createdAt || o.date;
      if (!orderDateStr) return Date.now();
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
      return orderTime;
    };

    let recentTotal = 0;
    let recentCount = 0;
    let pendingCount = 0;
    let refundCount = 0;

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      const orderTime = parseOrderDate(o);

      if (
        status !== "cancelled" &&
        status !== "returned" &&
        status !== "failed" &&
        status !== "payment pending" &&
        status !== "expired" &&
        status !== "payment review required" &&
        orderTime >= thirtyDaysAgo
      ) {
        recentTotal += Number(o.total || 0);
        recentCount += 1;
      }

      if (["paid", "paid via wallet", "order placed", "confirmed", "processing", "packed"].includes(status)) {
        pendingCount += 1;
      }

      const refundStatus = (o.refund_status || "").toLowerCase();
      if (
        status === "return requested" ||
        status === "return in transit" ||
        refundStatus === "pending" ||
        refundStatus === "processing"
      ) {
        refundCount += 1;
      }
    }

    const aov = recentCount > 0 ? Math.round(recentTotal / recentCount) : 0;

    let customerGrowth = 0;
    const { supabase, isSupabaseConfigured } = loadService();
    if (isSupabaseConfigured && supabase) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "customer")
        .gte("created_at", cutoff.toISOString());
      if (!error && count !== null) {
        customerGrowth = count;
      }
    }
    if (customerGrowth === 0) {
      const recentCustomers = new Set<string>();
      for (const o of orders) {
        if (parseOrderDate(o) >= thirtyDaysAgo) {
          recentCustomers.add(o.customer);
        }
      }
      customerGrowth = Math.max(1, recentCustomers.size);
    }

    let conversionRate = 0;
    let conversionRatePrev = 0;

    if (isSupabaseConfigured && supabase) {
      const date30DaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const date60DaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

      const { count: checkoutAttempts } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", date30DaysAgo);

      const { count: completedOrders } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "Paid")
        .gte("created_at", date30DaysAgo);

      conversionRate =
        checkoutAttempts && checkoutAttempts > 0
          ? Math.round(((completedOrders || 0) / checkoutAttempts) * 100)
          : 0;

      const { count: prevCheckoutAttempts } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", date60DaysAgo)
        .lt("created_at", date30DaysAgo);

      const { count: prevCompletedOrders } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "Paid")
        .gte("created_at", date60DaysAgo)
        .lt("created_at", date30DaysAgo);

      conversionRatePrev =
        prevCheckoutAttempts && prevCheckoutAttempts > 0
          ? Math.round(((prevCompletedOrders || 0) / prevCheckoutAttempts) * 100)
          : 0;
    } else {
      conversionRate = 14;
      conversionRatePrev = 12;
    }

    return {
      aov,
      pendingShipments: pendingCount,
      refundRequests: refundCount,
      customerGrowth,
      conversionRate,
      conversionRatePrev,
    };
  } catch (e) {
    console.error("Error in getDashboardKPIMetrics:", e);
    return {
      aov: 0,
      pendingShipments: 0,
      refundRequests: 0,
      customerGrowth: 0,
      conversionRate: 0,
      conversionRatePrev: 0,
    };
  }
}

export async function getRevenueTrend(
  days: number = 30
): Promise<
  Array<{
    date: string;
    revenue: number;
    order_count: number;
    gateway_revenue: number;
    wallet_revenue: number;
  }>
> {
  const cacheKey = `analytics:revenue_trend:${days}`;
  try {
    const cached = await CacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const orders = (await ordersDb.getOrders()) as any[];
    const dateMap = new Map<string, any>();

    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const key = d.toISOString().split("T")[0];
      dateMap.set(key, {
        date: dateStr,
        revenue: 0,
        order_count: 0,
        gateway_revenue: 0,
        wallet_revenue: 0,
      });
    }

    const parseOrderDate = (o: any): number => {
      const orderDateStr = o.created_at || o.createdAt || o.date;
      if (!orderDateStr) return Date.now();
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
      return orderTime;
    };

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      if (
        status === "cancelled" ||
        status === "returned" ||
        status === "failed" ||
        status === "payment pending" ||
        status === "expired" ||
        status === "payment review required"
      ) {
        continue;
      }

      const orderTime = parseOrderDate(o);
      const orderDate = new Date(orderTime);
      const key = orderDate.toISOString().split("T")[0];

      if (dateMap.has(key)) {
        const entry = dateMap.get(key);
        entry.revenue += Number(o.total || 0);
        entry.order_count += 1;
        entry.gateway_revenue += Number(o.gatewayPaid || o.gateway_paid || 0);
        entry.wallet_revenue += Number(o.walletPaid || o.wallet_paid || 0);
      }
    }

    const result = Array.from(dateMap.values());
    await CacheService.set(cacheKey, result, 300);
    return result;
  } catch (e) {
    console.error("Error in getRevenueTrend:", e);
    return [];
  }
}

export async function getTopProducts(
  days: number = 30,
  limit: number = 8
): Promise<
  Array<{
    productName: string;
    unitsSold: number;
    revenue: number;
  }>
> {
  const cacheKey = `analytics:top_products:${days}:${limit}`;
  try {
    const cached = await CacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const orders = (await ordersDb.getOrders()) as any[];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const parseOrderDate = (o: any): number => {
      const orderDateStr = o.created_at || o.createdAt || o.date;
      if (!orderDateStr) return Date.now();
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
      return orderTime;
    };

    const productMap = new Map<string, { productName: string; unitsSold: number; revenue: number }>();

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      if (
        status === "cancelled" ||
        status === "returned" ||
        status === "failed" ||
        status === "payment pending" ||
        status === "expired" ||
        status === "payment review required"
      ) {
        continue;
      }

      const orderTime = parseOrderDate(o);
      if (orderTime < cutoff) continue;

      const rawItems = o.cartItems || o.cart_items || [];
      if (Array.isArray(rawItems)) {
        for (const item of rawItems) {
          let pName = "";
          let qty = 1;
          let price = 0;
          if (typeof item === "object" && item !== null) {
            pName = item.productName || item.title || item.productId || "Unnamed Product";
            qty = Number(item.quantity || item.qty || 1);
            price = Number(item.price || 0);
          } else if (typeof item === "string") {
            pName = item;
            qty = 1;
            price = 0;
          }
          if (!pName) continue;
          const existing = productMap.get(pName);
          if (existing) {
            existing.unitsSold += qty;
            existing.revenue += price * qty;
          } else {
            productMap.set(pName, { productName: pName, unitsSold: qty, revenue: price * qty });
          }
        }
      } else if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const pName = String(item);
          const existing = productMap.get(pName);
          if (existing) {
            existing.unitsSold += 1;
          } else {
            productMap.set(pName, { productName: pName, unitsSold: 1, revenue: 0 });
          }
        }
      }
    }

    const result = Array.from(productMap.values());
    result.sort((a, b) => b.unitsSold - a.unitsSold);
    const sliced = result.slice(0, limit);
    await CacheService.set(cacheKey, sliced, 300);
    return sliced;
  } catch (e) {
    console.error("Error in getTopProducts:", e);
    return [];
  }
}

export async function getCouponPerformance(
  days: number = 30
): Promise<
  Array<{
    coupon_code: string;
    times_used: number;
    total_savings: number;
    avg_order_value: number;
  }>
> {
  const cacheKey = `analytics:coupons:${days}`;
  try {
    const cached = await CacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const orders = (await ordersDb.getOrders()) as any[];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const parseOrderDate = (o: any): number => {
      const orderDateStr = o.created_at || o.createdAt || o.date;
      if (!orderDateStr) return Date.now();
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
      return orderTime;
    };

    const performanceMap = new Map<
      string,
      { coupon_code: string; times_used: number; total_savings: number; total_order_value: number }
    >();

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      if (
        status === "cancelled" ||
        status === "returned" ||
        status === "failed" ||
        status === "payment pending" ||
        status === "expired" ||
        status === "payment review required"
      ) {
        continue;
      }

      const orderTime = parseOrderDate(o);
      if (orderTime < cutoff) continue;

      const cCode = (o.couponCode || o.coupon_code || "").trim().toUpperCase();
      if (!cCode) continue;

      const savings = Number(o.couponDiscount || o.coupon_discount || 0);

      const existing = performanceMap.get(cCode);
      if (existing) {
        existing.times_used += 1;
        existing.total_savings += savings;
        existing.total_order_value += Number(o.total || 0);
      } else {
        performanceMap.set(cCode, {
          coupon_code: cCode,
          times_used: 1,
          total_savings: savings,
          total_order_value: Number(o.total || 0),
        });
      }
    }

    const result = Array.from(performanceMap.values()).map((cp) => ({
      coupon_code: cp.coupon_code,
      times_used: cp.times_used,
      total_savings: cp.total_savings,
      avg_order_value: Math.round(cp.total_order_value / cp.times_used),
    }));

    result.sort((a, b) => b.times_used - a.times_used);
    const sliced = result.slice(0, 10);
    await CacheService.set(cacheKey, sliced, 300);
    return sliced;
  } catch (e) {
    console.error("Error in getCouponPerformance:", e);
    return [];
  }
}

export async function recordPageView(path: string, sessionId: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase
    .from("page_views")
    .upsert(
      { path, session_id: sessionId },
      { onConflict: "session_id", ignoreDuplicates: false }
    );
  if (error) {
    console.error("Error recording page view:", error);
  }
}

export async function getOnlineVisitorsCount(): Promise<number> {
  const { supabase, isSupabaseConfigured } = loadService();
  const ninetySecondsAgo = new Date(Date.now() - 90000).toISOString();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { count, error } = await supabase
    .from("visitor_sessions")
    .select("session_id", { count: "exact", head: true })
    .gte("last_seen", ninetySecondsAgo);

  if (error) {
    console.error("Error getting online visitors:", error);
    return 0;
  }
  return count || 0;
}

export async function getActiveCartsCount(): Promise<number> {
  const { supabase, isSupabaseConfigured } = loadService();
  const thirtyMinsAgo = new Date(Date.now() - 1800000).toISOString();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { count, error } = await supabase
    .from("visitor_sessions")
    .select("session_id", { count: "exact", head: true })
    .gte("last_seen", thirtyMinsAgo)
    .gt("cart_count", 0);

  if (error) {
    console.error("Error fetching active carts count:", error);
    return 0;
  }
  return count || 0;
}

export async function getActiveProductViewers(): Promise<Array<{ page: string; viewers: number; productName: string }>> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];

  const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();

  const { data, error } = await supabase
    .from("visitor_sessions")
    .select("current_page, session_id")
    .gte("last_seen", fiveMinutesAgo)
    .like("current_page", "/product/%");

  if (error || !data) {
    console.error("Error loading active product viewers:", error);
    return [];
  }

  const pageGroups: Record<string, Set<string>> = {};
  for (const row of data) {
    if (row.current_page && row.session_id) {
      if (!pageGroups[row.current_page]) {
        pageGroups[row.current_page] = new Set();
      }
      pageGroups[row.current_page].add(row.session_id);
    }
  }

  const viewersList = Object.entries(pageGroups)
    .map(([page, sessions]) => ({
      page,
      viewers: sessions.size
    }))
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5);

  const result: Array<{ page: string; viewers: number; productName: string }> = [];

  for (const item of viewersList) {
    const parts = item.page.split("/");
    const slug = parts[parts.length - 1];
    if (slug) {
      try {
        const product = await productsDb.getProductBySlug(slug);
        if (product) {
          result.push({
            page: item.page,
            viewers: item.viewers,
            productName: product.title
          });
        } else {
          const formattedSlug = slug
            .replace(/-/g, " ")
            .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
          result.push({
            page: item.page,
            viewers: item.viewers,
            productName: formattedSlug
          });
        }
      } catch (err) {
        const formattedSlug = slug
          .replace(/-/g, " ")
          .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
        result.push({
          page: item.page,
          viewers: item.viewers,
          productName: formattedSlug
        });
      }
    }
  }

  return result;
}



export async function getMonthlyFinanceSummary(
  year: number,
  month: number
): Promise<{
  grossRevenue: number;
  netRevenue: number;
  totalRefunds: number;
  gstCollected: number;
  ordersCount: number;
  avgOrderValue: number;
}> {
  const { supabase, isSupabaseConfigured } = loadService();

  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("total, refund_amount, status, cart_items")
    .gte("created_at", startOfMonth)
    .lte("created_at", endOfMonth);

  if (error) {
    console.error("Error loading monthly finance summary:", error);
    throw error;
  }

  const validOrders = (orders || []).filter((o) => {
    const s = (o.status || "").toLowerCase();
    return s !== "cancelled" && s !== "expired" && s !== "payment pending" && s !== "failed" && s !== "payment review required";
  });
  const grossRevenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalRefunds = validOrders.reduce((sum, o) => sum + Number(o.refund_amount || 0), 0);
  const netRevenue = grossRevenue - totalRefunds;

  let gstCollected = 0;
  for (const o of validOrders) {
    let orderGst = 0;
    const cartItemsList = o.cart_items || [];
    if (Array.isArray(cartItemsList) && cartItemsList.length > 0 && typeof cartItemsList[0] === "object") {
      for (const item of cartItemsList) {
        const price = Number(item.price || 0);
        const qty = Number(item.quantity || item.qty || 1);
        const rate = Number(item.gstRate || item.gst_rate || 12);
        const itemTotal = price * qty;
        orderGst += itemTotal - itemTotal / (1 + rate / 100);
      }
    } else {
      const total = Number(o.total || 0);
      const gstRate = total <= 1000 ? 5 : 12;
      orderGst = total - total / (1 + gstRate / 100);
    }
    gstCollected += orderGst;
  }

  const ordersCount = validOrders.length;
  const avgOrderValue = ordersCount > 0 ? Math.round(grossRevenue / ordersCount) : 0;

  return {
    grossRevenue,
    netRevenue,
    totalRefunds,
    gstCollected: Math.round(gstCollected),
    ordersCount,
    avgOrderValue,
  };
}

export async function getGSTReport(
  monthsCountOrStartDate: number | string,
  endDate?: string
): Promise<any> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  if (typeof monthsCountOrStartDate === "number") {
    const monthsCount = monthsCountOrStartDate;
    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - monthsCount);
    const startLimit = dateLimit.toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("total, created_at, status, cart_items")
      .gte("created_at", startLimit);

    if (error) {
      console.error("Error loading GST report:", error);
      throw error;
    }

    const validOrders = (orders || []).filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s !== "cancelled" && s !== "expired" && s !== "payment pending" && s !== "failed" && s !== "payment review required";
    });

    const groups: Record<string, { grossSales: number; gstCollected: number; netSales: number }> = {};
    for (const order of validOrders) {
      const orderDate = new Date(order.created_at);
      const key = orderDate.toLocaleString("en-US", { month: "short", year: "numeric" });
      if (!groups[key]) {
        groups[key] = { grossSales: 0, gstCollected: 0, netSales: 0 };
      }
      const total = Number(order.total || 0);

      let orderGst = 0;
      const cartItemsList = order.cart_items || [];
      if (Array.isArray(cartItemsList) && cartItemsList.length > 0 && typeof cartItemsList[0] === "object") {
        for (const item of cartItemsList) {
          const price = Number(item.price || 0);
          const qty = Number(item.quantity || item.qty || 1);
          const rate = Number(item.gstRate || item.gst_rate || 12);
          const itemTotal = price * qty;
          orderGst += itemTotal - itemTotal / (1 + rate / 100);
        }
      } else {
        const gstRate = total <= 1000 ? 5 : 12;
        orderGst = total - total / (1 + gstRate / 100);
      }

      groups[key].grossSales += total;
      groups[key].gstCollected += orderGst;
      groups[key].netSales += total - orderGst;
    }

    return Object.entries(groups)
      .map(([monthName, val]) => ({
        monthName,
        grossSales: Math.round(val.grossSales),
        gstCollected: Math.round(val.gstCollected),
        netSales: Math.round(val.netSales),
      }))
      .sort((a, b) => new Date(b.monthName).getTime() - new Date(a.monthName).getTime());
  } else {
    const startDate = monthsCountOrStartDate;
    const { data, error } = await supabase
      .from("orders")
      .select("id, total, cart_items, created_at, status, address_snapshot")
      .gte("created_at", startDate)
      .lte("created_at", endDate!)
      .not("status", "in", '("Cancelled","Failed","FAILED","Payment Pending","Expired","EXPIRED","Payment Review Required")');

    if (error) {
      console.error("Error loading GST report range:", error);
      throw error;
    }
    
    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGSTAmount = 0;
    
    for (const order of data || []) {
      const items = order.cart_items || [];
      const snap = typeof order.address_snapshot === "string"
        ? JSON.parse(order.address_snapshot)
        : order.address_snapshot;
      const stateStr = snap?.state || "";
      const isInterstate = stateStr && !["tamil nadu", "tamilnadu", "tn"].includes(stateStr.trim().toLowerCase());
      
      for (const item of items) {
        const price = Number(item.price || 0);
        const qty = Number(item.quantity || 1);
        const gstRate = item.gstRate || 
          item.gst_rate || 
          (price <= 1000 ? 5 : 12);
        
        const itemTotal = price * qty;
        const taxable = itemTotal / (1 + gstRate/100);
        const gst = itemTotal - taxable;
        
        totalTaxableValue += taxable;
        totalGSTAmount += gst;
        
        if (isInterstate) {
          totalIGST += gst;
        } else {
          totalCGST += gst / 2;
          totalSGST += gst / 2;
        }
      }
    }
    
    return {
      totalOrders: data?.length || 0,
      totalTaxableValue: Math.round(totalTaxableValue),
      totalCGST: Math.round(totalCGST),
      totalSGST: Math.round(totalSGST),
      totalIGST: Math.round(totalIGST),
      totalGSTAmount: Math.round(totalGSTAmount),
      totalRevenue: Math.round(
        totalTaxableValue + totalGSTAmount
      )
    };
  }
}

export async function getCityOrders(): Promise<Array<{ city: string; count: number; revenue: number; state?: string }>> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // orders table does NOT have a deleted_at column (soft-delete is products-only).
  // Status filtering below handles exclusion of non-revenue orders.
  const { data, error } = await supabase
    .from("orders")
    .select("address_snapshot, total, status, cart_items")
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    console.error("Error loading city orders:", error);
    return [];
  }

  return processCityOrdersData(data);
}

function processCityOrdersData(data: any[]): Array<{ city: string; count: number; revenue: number; state?: string }> {
  const cityData: Record<string, { count: number; revenue: number; state: string }> = {};
  for (const row of data || []) {
    
    const statusLower = (row.status || "").toLowerCase();
    if (
      statusLower === "cancelled" ||
      statusLower === "failed" ||
      statusLower === "payment pending" ||
      statusLower === "expired" ||
      statusLower === "payment review required"
    ) {
      continue;
    }
    
    const cartItems = row.cart_items;
    if (cartItems) {
      const itemsArr = typeof cartItems === "string" ? JSON.parse(cartItems) : cartItems;
      if (Array.isArray(itemsArr) && itemsArr.length === 0) {
        continue;
      }
    }

    const snap = row.address_snapshot;
    if (snap && snap.city) {
      const city = snap.city
        .trim()
        .replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      const state = snap.state
        ? snap.state.trim().replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
        : "";
      
      const key = `${city}:${state}`;
      if (!cityData[key]) {
        cityData[key] = { count: 0, revenue: 0, state };
      }
      cityData[key].count += 1;
      cityData[key].revenue += Number(row.total || 0);
    }
  }

  return Object.entries(cityData)
    .map(([key, val]) => {
      const [city] = key.split(":");
      return { city, count: val.count, revenue: Math.round(val.revenue), state: val.state };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function getSalesByCategory(days: number = 30): Promise<CategorySales[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  const cacheKey = `analytics:sales-category:${days}`;
  const cached = await CacheService.get<CategorySales[]>(cacheKey);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: productsData, error: prodErr } = await supabase.from("products").select("id, title, category");

  if (prodErr) {
    console.error("Error fetching products for category stats:", prodErr);
    return [];
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: ordersData, error: ordersErr } = await supabase
    .from("orders")
    .select("id, total, status, cart_items")
    .gte("created_at", cutoff);

  if (ordersErr) {
    console.error("Error fetching orders for category stats:", ordersErr);
    return [];
  }

  const productById: Record<string, any> = {};
  const productByTitle: Record<string, any> = {};
  const productByTitleLower: Record<string, any> = {};

  if (productsData) {
    for (const p of productsData) {
      if (p.id) productById[p.id] = p;
      if (p.title) {
        productByTitle[p.title] = p;
        productByTitleLower[p.title.toLowerCase().trim()] = p;
      }
    }
  }

  const categoryStatsMap: Record<
    string,
    { category: string; revenue: number; orderCount: number; unitsSold: number; orderIds: Set<string> }
  > = {};

  for (const order of ordersData || []) {
    const statusLower = (order.status || "").toLowerCase();
    if (
      statusLower === "cancelled" ||
      statusLower === "returned" ||
      statusLower === "expired" ||
      statusLower === "failed" ||
      statusLower === "payment pending" ||
      statusLower === "payment review required"
    ) {
      continue;
    }

    const cartItems = order.cart_items || [];
    if (!Array.isArray(cartItems)) continue;

    for (const item of cartItems) {
      const cartItemName = item.productName || item.title || "";
      const cartItemId = item.productId || item.product_id;

      let matchedProduct = null;
      if (cartItemId && productById[cartItemId]) {
        matchedProduct = productById[cartItemId];
      } else if (cartItemName) {
        if (productByTitle[cartItemName]) {
          matchedProduct = productByTitle[cartItemName];
        } else {
          const keyLower = cartItemName.toLowerCase().trim();
          if (productByTitleLower[keyLower]) {
            matchedProduct = productByTitleLower[keyLower];
          }
        }
      }

      const category = matchedProduct ? matchedProduct.category || "Uncategorized" : "Uncategorized";

      if (!categoryStatsMap[category]) {
        categoryStatsMap[category] = {
          category,
          revenue: 0,
          orderCount: 0,
          unitsSold: 0,
          orderIds: new Set<string>(),
        };
      }

      const itemQty = Number(item.quantity || item.qty || 1);
      categoryStatsMap[category].unitsSold += itemQty;
      categoryStatsMap[category].orderIds.add(order.id);
      categoryStatsMap[category].revenue += Number(item.price || 0) * itemQty;
    }
  }

  const result: CategorySales[] = Object.values(categoryStatsMap).map((c) => ({
    category: c.category,
    revenue: Math.round(c.revenue),
    orderCount: c.orderIds.size,
    unitsSold: c.unitsSold,
    percentage: 0,
  }));

  const totalRevenue = result.reduce((sum, item) => sum + item.revenue, 0);
  for (const item of result) {
    item.percentage = totalRevenue > 0 ? Number(((item.revenue / totalRevenue) * 100).toFixed(1)) : 0;
  }

  result.sort((a, b) => b.revenue - a.revenue);
  const finalResult = result.slice(0, 6);

  await CacheService.set(cacheKey, finalResult, 300);
  return finalResult;
}

export async function getRepeatPurchaseRate(days: number = 30): Promise<RepeatPurchaseStats> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, status")
    .gte("created_at", cutoff);

  if (error) {
    console.error("Error in getRepeatPurchaseRate:", error);
    return { totalCustomers: 0, repeatCustomers: 0, repeatRate: 0 };
  }

  const userOrderCounts: Record<string, number> = {};
  for (const order of data || []) {
    const uId = order.user_id;
    if (!uId) continue;
    const statusLower = (order.status || "").toLowerCase();
    if (
      statusLower === "cancelled" ||
      statusLower === "returned" ||
      statusLower === "expired" ||
      statusLower === "failed" ||
      statusLower === "payment pending" ||
      statusLower === "payment review required"
    ) {
      continue;
    }
    userOrderCounts[uId] = (userOrderCounts[uId] || 0) + 1;
  }

  let totalCustomers = 0;
  let repeatCustomers = 0;
  for (const count of Object.values(userOrderCounts)) {
    totalCustomers++;
    if (count > 1) {
      repeatCustomers++;
    }
  }

  const repeatRate = totalCustomers > 0 ? Number(((repeatCustomers * 100) / totalCustomers).toFixed(1)) : 0;

  return {
    totalCustomers,
    repeatCustomers,
    repeatRate,
  };
}

export async function getAdSpend(months: number = 3): Promise<AdSpend[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setDate(1);
  const { data, error } = await supabase
    .from("ad_spend")
    .select("id, channel, month, spend_amount, campaign_name, notes, created_at")
    .gte("month", cutoff.toISOString().split("T")[0])
    .order("month", { ascending: false });

  if (error) {
    console.error("Error in getAdSpend:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    channel: row.channel,
    month: row.month,
    spendAmount: Number(row.spend_amount),
    campaignName: row.campaign_name,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function saveAdSpend(data: {
  channel: string;
  month: string;
  spendAmount: number;
  campaignName?: string;
  notes?: string;
}): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { channel, month, spendAmount, campaignName, notes } = data;
  const targetMonth = month.endsWith("-01") ? month : `${month}-01`;
  const campaign = campaignName || null;

  let query = supabase
    .from("ad_spend")
    .select("id")
    .eq("channel", channel)
    .eq("month", targetMonth);

  if (campaign) {
    query = query.eq("campaign_name", campaign);
  } else {
    query = query.is("campaign_name", null);
  }

  const { data: existing, error: selectErr } = await query;
  if (selectErr) throw selectErr;

  if (existing && existing.length > 0) {
    const { error: updateErr } = await supabase
      .from("ad_spend")
      .update({ spend_amount: spendAmount, notes: notes || null })
      .eq("id", existing[0].id);
    if (updateErr) throw updateErr;
  } else {
    const { error: insertErr } = await supabase.from("ad_spend").insert({
      channel,
      month: targetMonth,
      spend_amount: spendAmount,
      campaign_name: campaign,
      notes: notes || null,
    });
    if (insertErr) throw insertErr;
  }
}

export async function getROASReport(months: number = 3): Promise<ROASReport[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const spendRecords = await getAdSpend(months);

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setDate(1);
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("total, utm_source, created_at, status")
    .gte("created_at", cutoff.toISOString());

  if (ordersErr) {
    console.error("Error in getROASReport orders fetch:", ordersErr);
    return [];
  }

  const validOrders = (orders || []).filter((o: any) => {
    const statusLower = (o.status || "").toLowerCase();
    return (
      statusLower !== "cancelled" &&
      statusLower !== "returned" &&
      statusLower !== "expired" &&
      statusLower !== "failed"
    );
  });

  const spendMap: Record<string, number> = {};
  for (const s of spendRecords) {
    const mStr = s.month.substring(0, 10);
    const key = `${s.channel}_${mStr}`;
    spendMap[key] = (spendMap[key] || 0) + s.spendAmount;
  }

  const instagramSpendMonths = new Set<string>();
  for (const s of spendRecords) {
    if (s.channel === "instagram") {
      instagramSpendMonths.add(s.month.substring(0, 10));
    }
  }

  const revenueMap: Record<string, number> = {};
  for (const o of validOrders) {
    const orderDate = new Date(o.created_at);
    const yyyy = orderDate.getFullYear();
    const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
    const mStr = `${yyyy}-${mm}-01`;

    const utmSource = (o.utm_source || "").toLowerCase();
    let channel = "other";

    if (utmSource.includes("google")) {
      channel = "google_ads";
    } else if (utmSource.includes("facebook")) {
      channel = "meta_ads";
    } else if (utmSource.includes("instagram")) {
      if (instagramSpendMonths.has(mStr)) {
        channel = "instagram";
      } else {
        channel = "meta_ads";
      }
    } else if (utmSource !== "") {
      channel = "other";
    } else {
      continue;
    }

    const key = `${channel}_${mStr}`;
    revenueMap[key] = (revenueMap[key] || 0) + Number(o.total || 0);
  }

  const reportMap = new Map<string, ROASReport>();

  const allKeys = new Set([...Object.keys(spendMap), ...Object.keys(revenueMap)]);
  for (const key of allKeys) {
    const [channel, month] = key.split("_");
    if (!channel || !month) continue;

    const spend = spendMap[key] || 0;
    const revenue = revenueMap[key] || 0;
    if (spend === 0 && revenue === 0) continue;

    const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;
    const roasFormatted = spend > 0 ? `${roas}x` : "0.0x";

    reportMap.set(key, {
      channel,
      month,
      spend,
      revenue: Math.round(revenue),
      roas,
      roasFormatted,
    });
  }

  return Array.from(reportMap.values()).sort(
    (a, b) => b.month.localeCompare(a.month) || a.channel.localeCompare(b.channel)
  );
}

export async function getDashboardMetrics(): Promise<any> {
  const { supabase, isSupabaseConfigured } = loadService();
  const cacheKey = "analytics:dashboard";
  const cached = await CacheService.get<any>(cacheKey);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data, error } = await supabase.rpc("get_dashboard_aggregates");
  if (error) {
    console.error("Error fetching dashboard aggregates via RPC:", error);
    return {
      totalOrders: 0,
      totalRevenue: 0,
      cashRevenue: 0,
      creditRevenue: 0,
      inventoryCount: 0,
      totalStock: 0,
      walletLiability: 0,
      conversion: "4.2%",
    };
  }

  await CacheService.set(cacheKey, data, 300);
  return data;
}

export async function getLiabilityReport() {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }

  const { data: walletData, error: wErr } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .gt('wallet_balance', 0);
  
  if (wErr) {
    console.error("Error fetching wallet liability:", wErr);
  }

  const totalWalletLiability = walletData?.reduce(
    (sum, p) => sum + Number(p.wallet_balance || 0), 0
  ) || 0;

  const { data: loyaltyData, error: lErr } = await supabase
    .from('profiles')
    .select('loyalty_points')
    .gt('loyalty_points', 0);

  if (lErr) {
    console.error("Error fetching loyalty liability:", lErr);
  }
  
  const totalPoints = loyaltyData?.reduce(
    (sum, p) => sum + Number(p.loyalty_points || 0), 0
  ) || 0;

  const { data: settings } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'loyalty_config')
    .maybeSingle();
  
  const config = (settings?.value as any) || {};
  const rupeesPerPoint = config.rupees_per_point || 0.5;
  const totalLoyaltyLiability = totalPoints * rupeesPerPoint;

  return {
    totalWalletLiability,
    totalLoyaltyLiability,
    totalPoints,
    totalLiability: totalWalletLiability + totalLoyaltyLiability
  };
}

export async function getNetRevenueReport(
  startDate: string, 
  endDate: string
) {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select('total, refund_amount, status, wallet_paid, gateway_paid, coupon_discount, points_discount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    console.error("Error fetching net revenue report:", error);
    throw error;
  }

  let grossRevenue = 0;
  let totalRefunds = 0;
  let totalDiscounts = 0;
  let walletRevenue = 0;
  let gatewayRevenue = 0;

  for (const order of orders || []) {
    const statusLower = (order.status || "").toLowerCase();
    const isExcluded = ["cancelled", "failed", "payment pending", "expired", "payment review required"].includes(statusLower);
    
    if (!isExcluded) {
      grossRevenue += Number(order.total || 0);
      walletRevenue += Number(order.wallet_paid || 0);
      gatewayRevenue += Number(order.gateway_paid || 0);
      totalDiscounts += Number(order.coupon_discount || 0) + Number(order.points_discount || 0);
      if (order.refund_amount) {
        totalRefunds += Number(order.refund_amount || 0);
      }
    }
  }

  return {
    grossRevenue,
    totalRefunds,
    totalDiscounts,
    netRevenue: grossRevenue - totalRefunds,
    walletRevenue,
    gatewayRevenue
  };
}

export async function getRevenueByCategory(
  startDate: string,
  endDate: string
): Promise<Array<{
  category: string;
  orders: number;
  revenue: number;
  percentage: number;
}>> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    // Mock data for sandbox mode
    return [
      { category: "Featured", orders: 42, revenue: 63000, percentage: 45 },
      { category: "New Arrivals", orders: 28, revenue: 42000, percentage: 30 },
      { category: "Best Sellers", orders: 18, revenue: 27000, percentage: 19 },
      { category: "General", orders: 8, revenue: 8400, percentage: 6 },
    ];
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("total, cart_items, status, created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .not("status", "in", '("Cancelled","Failed","FAILED","Payment Pending","Expired","EXPIRED","Payment Review Required")');

  if (error) {
    console.error("[getRevenueByCategory] error:", error);
    return [];
  }

  const categoryMap: Record<string, { orders: number; revenue: number }> = {};

  for (const order of orders || []) {
    const items: any[] = order.cart_items || [];
    for (const item of items) {
      // Derive category from display_section on the cart item
      const rawCategory: string =
        item.displaySection ||
        item.display_section ||
        (Array.isArray(item.displaySections) && item.displaySections[0]) ||
        (Array.isArray(item.display_sections) && item.display_sections[0]) ||
        "General";

      // Format: underscores → spaces, title-case each word
      const categoryName = rawCategory
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());

      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = { orders: 0, revenue: 0 };
      }
      categoryMap[categoryName].orders++;
      categoryMap[categoryName].revenue +=
        Number(item.price || 0) * Number(item.quantity || 1);
    }
  }

  const totalRevenue = Object.values(categoryMap).reduce(
    (sum, c) => sum + c.revenue,
    0
  );

  return Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      orders: data.orders,
      revenue: Math.round(data.revenue),
      percentage:
        totalRevenue > 0
          ? Math.round((data.revenue / totalRevenue) * 100)
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export const analyticsDb = {
  getTodaySalesKPI,
  getDashboardKPIMetrics,
  getDashboardMetrics,
  getRevenueTrend,
  getTopProducts,
  getCouponPerformance,
  recordPageView,
  getOnlineVisitorsCount,
  getActiveCartsCount,
  getActiveProductViewers,
  getMonthlyFinanceSummary,
  getGSTReport,
  getCityOrders,
  getSalesByCategory,
  getRepeatPurchaseRate,
  getAdSpend,
  saveAdSpend,
  getROASReport,
  getLiabilityReport,
  getNetRevenueReport,
  getRevenueByCategory,
};
