"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function getRevenueTrendAction(days: number) {
  try {
    await requireAdmin();
    const trend = await db.getRevenueTrend(days);
    return { success: true, data: trend };
  } catch (err: any) {
    console.error('[admin-analytics.ts]:', err);
    return { success: false, error: err.message || "Failed to load revenue trend" };
  }
}

export async function getTopProductsAction(days: number) {
  try {
    await requireAdmin();
    const products = await db.getTopProducts(days, 8);
    return { success: true, data: products };
  } catch (err: any) {
    console.error('[admin-analytics.ts]:', err);
    return { success: false, error: err.message || "Failed to load top products" };
  }
}

// -------------------------------------------------------------
// ANALYTICS SUITE ACTIONS
// -------------------------------------------------------------

import { supabaseService as supabase, isServiceClientConfigured as isSupabaseConfigured } from "@/lib/supabase-service";

export async function getMarketingAnalyticsAction() {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: true,
        utmSources: [
          { name: "Instagram", value: 450 },
          { name: "Google Ads", value: 300 },
          { name: "Facebook", value: 180 },
          { name: "Direct / Email", value: 120 },
          { name: "Organic Search", value: 90 },
        ],
        campaigns: [
          { name: "summer_sale_2026", source: "instagram", medium: "social", orders: 48, revenue: 69600 },
          { name: "festive_apparel", source: "google", medium: "cpc", orders: 35, revenue: 50750 },
          { name: "brand_awareness", source: "facebook", medium: "display", orders: 12, revenue: 17400 },
          { name: "newsletter_july", source: "email", medium: "newsletter", orders: 8, revenue: 11600 },
        ],
        adSpend: [
          { channel: "google_ads", month: "2026-06-01", spendAmount: 12000, campaignName: "summer_sale", notes: "Google Ads cost" },
          { channel: "meta_ads", month: "2026-06-01", spendAmount: 8000, campaignName: "festive_apparel", notes: "Facebook Ads cost" }
        ],
        roasReport: [
          { channel: "google_ads", month: "2026-06-01", spend: 12000, revenue: 45600, roas: 3.8, roasFormatted: "3.8x" },
          { channel: "meta_ads", month: "2026-06-01", spend: 8000, revenue: 32800, roas: 4.1, roasFormatted: "4.1x" }
        ],
      };
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select("total, utm_source, utm_medium, utm_campaign, status")
      .not("utm_source", "is", null);

    if (error) throw error;

    const validOrders = (orders || []).filter(o => o.status !== "Cancelled" && o.status !== "Expired");
    
    const sourcesMap: Record<string, number> = {};
    const campaignsMap: Record<string, { orders: number; revenue: number; source: string; medium: string }> = {};

    for (const o of validOrders) {
      const src = o.utm_source || "unknown";
      sourcesMap[src] = (sourcesMap[src] || 0) + 1;

      if (o.utm_campaign) {
        const key = `${o.utm_campaign}:${src}`;
        if (!campaignsMap[key]) {
          campaignsMap[key] = {
            orders: 0,
            revenue: 0,
            source: src,
            medium: o.utm_medium || "unknown",
          };
        }
        campaignsMap[key].orders += 1;
        campaignsMap[key].revenue += Number(o.total || 0);
      }
    }

    const utmSources = Object.entries(sourcesMap).map(([name, value]) => ({ name, value }));
    const campaigns = Object.entries(campaignsMap).map(([key, val]) => {
      const name = key.split(":")[0];
      return {
        name,
        source: val.source,
        medium: val.medium,
        orders: val.orders,
        revenue: Math.round(val.revenue),
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const adSpend = await db.getAdSpend(3);
    const roasReport = await db.getROASReport(3);

    return { success: true, utmSources, campaigns, adSpend, roasReport };
  } catch (err: any) {
    console.error("Marketing action error:", err);
    return { success: false, error: err.message };
  }
}

export async function getLiveAnalyticsAction() {
  try {
    await requireAdmin();

    const onlineVisitors = await db.getOnlineVisitorsCount();
    const activeCarts = await db.getActiveCartsCount();
    
    let todayOrdersCount = 5;
    let todayRevenue = 7250;
    let todayPendingOrders = 2;
    let recentOrders: { id: string; customer: string; total: number; created_at: string }[] = [
      { id: "ORD-001", customer: "Sample Customer", total: 1499, created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
      { id: "ORD-002", customer: "Demo User", total: 2199, created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString() },
    ];
    
    if (isSupabaseConfigured && supabase) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();
      
      // Today's order totals
      const { data: todayOrders, error } = await supabase
        .from("orders")
        .select("total, status")
        .gte("created_at", todayStartIso);
      
      if (!error && todayOrders) {
        const validToday = todayOrders.filter(
          (o) => o.status !== "Cancelled" && o.status !== "Expired"
        );
        todayOrdersCount = validToday.length;
        todayRevenue = validToday.reduce(
          (sum, o) => sum + Number(o.total || 0),
          0
        );

        // Pending orders = paid today, waiting for admin acceptance
        todayPendingOrders = validToday.filter((o) => {
          const s = (o.status || "").toLowerCase();
          return s === "paid" || s === "paid via wallet";
        }).length;
      }

      // Fetch last 5 recent orders for the live feed
      const { data: recent, error: recentErr } = await supabase
        .from("orders")
        .select("id, customer, total, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!recentErr && recent) {
        recentOrders = recent.map((o) => ({
          id: o.id,
          customer: o.customer || "Unknown",
          total: Number(o.total || 0),
          created_at: o.created_at,
        }));
      }
    }

    const cityOrders = await db.getCityOrders();

    return {
      success: true,
      onlineVisitors,
      activeCarts,
      todayOrdersCount,
      todayRevenue,
      todayPendingOrders,
      recentOrders,
      cityOrders,
    };
  } catch (err: any) {
    console.error("Live action error:", err);
    return { success: false, error: err.message };
  }
}


export async function getFinanceAnalyticsAction(year: number, month: number) {
  try {
    await requireAdmin();

    const summary = await db.getMonthlyFinanceSummary(year, month);
    const gstReport = await db.getGSTReport(6);

    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const gstReportRange = await db.getGSTReport(startOfMonth, endOfMonth);
    const liability = await db.getLiabilityReport();
    const netRevenueReport = await db.getNetRevenueReport(startOfMonth, endOfMonth);

    let paymentsBreakdown = [
      { name: "Razorpay (Online)", value: 85 },
      { name: "Cash on Delivery", value: 13 },
    ];

    if (isSupabaseConfigured && supabase) {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("wallet_paid, gateway_paid, status")
        .gte("created_at", startOfMonth)
        .lte("created_at", endOfMonth);

      if (!error && orders) {
        const valid = orders.filter(o => o.status !== "Cancelled" && o.status !== "Expired");
        let codCount = 0;
        let onlineCount = 0;
        for (const o of valid) {
          if (o.gateway_paid > 0) {
            onlineCount++;
          } else {
            codCount++;
          }
        }
        paymentsBreakdown = [
          { name: "Razorpay (Online)", value: onlineCount },
          { name: "Cash on Delivery", value: codCount },
        ];
      }
    }

    return {
      success: true,
      summary,
      gstReport,
      gstReportRange,
      liability,
      netRevenueReport,
      paymentsBreakdown,
    };
  } catch (err: any) {
    console.error("Finance action error:", err);
    return { success: false, error: err.message };
  }
}

export async function getSalesAnalyticsAction(days: number = 30) {
  try {
    await requireAdmin();

    const todaySales = await db.getTodaySalesKPI();
    const kpiMetrics = await db.getDashboardKPIMetrics();
    const revenueTrend = await db.getRevenueTrend(days);
    const categoryStats = await db.getSalesByCategory(days);
    const topProducts = await db.getTopProducts(days, 8);
    const repeatPurchaseStats = await db.getRepeatPurchaseRate(days);
    const cityOrders = await db.getCityOrders();

    return {
      success: true,
      todaySales,
      kpiMetrics,
      revenueTrend,
      categoryStats,
      topProducts,
      repeatPurchaseStats,
      cityOrders,
    };
  } catch (err: any) {
    console.error("Sales action error:", err);
    return { success: false, error: err.message || "Failed to load sales analytics data" };
  }
}

export async function saveAdSpendAction(data: {
  channel: string;
  month: string;
  spendAmount: number;
  campaignName?: string;
  notes?: string;
}) {
  try {
    await requireAdmin();
    await db.saveAdSpend(data);
    return { success: true };
  } catch (err: any) {
    console.error("Save ad spend action error:", err);
    return { success: false, error: err.message || "Failed to save ad spend" };
  }
}

export async function getRevenueByCategoryAction(
  startDate: string,
  endDate: string
) {
  try {
    await requireAdmin();
    const data = await db.getRevenueByCategory(startDate, endDate);
    return { success: true, data };
  } catch (err: any) {
    console.error("getRevenueByCategoryAction error:", err);
    return { success: false, error: err.message || "Failed to load category revenue", data: [] };
  }
}

