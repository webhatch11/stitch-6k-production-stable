import React from "react";
import { db } from "@/lib/db";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";

export const revalidate = 0; // Disable static cache, force dynamic SSR

export default async function AdminDashboardPage() {
  const metrics = await db.getDashboardMetrics();
  const todaySales = await db.getTodaySalesKPI();
  const kpiMetrics = await db.getDashboardKPIMetrics();
  const initialRevenueTrend = await db.getRevenueTrend(30);
  const initialTopProducts = await db.getTopProducts(30, 8);
  const initialCouponPerformance = await db.getCouponPerformance(30);
  const initialOrders = await db.getOrders();
  const initialProducts = await db.getProducts({ includeDeleted: false });

  return (
    <AdminDashboardClient
      initialMetrics={metrics}
      todaySales={todaySales}
      kpiMetrics={kpiMetrics}
      initialRevenueTrend={initialRevenueTrend}
      initialTopProducts={initialTopProducts}
      initialCouponPerformance={initialCouponPerformance}
      initialOrders={initialOrders}
      initialProducts={initialProducts}
    />
  );
}
