"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, Product } from "@/lib/types";
import { deleteProductAction } from "@/app/actions/admin-products";
import { bulkUpdateOrderStatusAction, processReturnRefundAction } from "@/app/actions/admin-orders";
import { restockVariantAction } from "@/app/actions/admin-products";
import { getRevenueTrendAction, getTopProductsAction } from "@/app/actions/admin-analytics";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory-config";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

interface AdminDashboardClientProps {
  initialMetrics: any;
  todaySales: any;
  kpiMetrics: any;
  initialRevenueTrend: any[];
  initialTopProducts: any[];
  initialCouponPerformance: any[];
  initialOrders: Order[];
  initialProducts: Product[];
  initialCategoryStats: any[];
  initialRepeatPurchaseStats: any;
  initialCityOrders: any[];
}

export default function AdminDashboardClient({
  initialMetrics,
  todaySales,
  kpiMetrics,
  initialRevenueTrend,
  initialTopProducts,
  initialCouponPerformance,
  initialOrders,
  initialProducts,
  initialCategoryStats,
  initialRepeatPurchaseStats,
  initialCityOrders,
}: AdminDashboardClientProps) {
  const router = useRouter();

  // Metrics & Data States
  const [metrics, setMetrics] = useState(initialMetrics);
  const [todayKPI, setTodayKPI] = useState(todaySales);
  const [kpis, setKpis] = useState(kpiMetrics);
  const [revenueTrend, setRevenueTrend] = useState(initialRevenueTrend);
  const [topProducts, setTopProducts] = useState(initialTopProducts);
  const [couponPerformance] = useState(initialCouponPerformance);
  const [orders, setOrders] = useState(initialOrders);
  const [products, setProducts] = useState(initialProducts);
  const [categoryStats, setCategoryStats] = useState(initialCategoryStats);
  const [repeatPurchaseStats, setRepeatPurchaseStats] = useState(initialRepeatPurchaseStats);
  const [cityOrders, setCityOrders] = useState(initialCityOrders);

  // Active Date Range states
  const [revenueDays, setRevenueDays] = useState<7 | 30 | 90>(30);
  const [productsDays, setProductsDays] = useState<7 | 30 | 90>(30);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Toast Alerts
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Modal States
  const [modalType, setModalType] = useState<"delete" | "restock" | null>(null);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<"S" | "M" | "L" | "XL" | "XXL">("S");
  const [restockQty, setRestockQty] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Date Range Switches
  const handleRevenueRangeChange = async (days: 7 | 30 | 90) => {
    setRevenueDays(days);
    setLoadingRevenue(true);
    const res = await getRevenueTrendAction(days);
    if (res.success && res.data) {
      setRevenueTrend(res.data);
    } else {
      triggerToast(res.error || "Failed to load trend");
    }
    setLoadingRevenue(false);
  };

  const handleProductsRangeChange = async (days: 7 | 30 | 90) => {
    setProductsDays(days);
    setLoadingProducts(true);
    const res = await getTopProductsAction(days);
    if (res.success && res.data) {
      setTopProducts(res.data);
    } else {
      triggerToast(res.error || "Failed to load top products");
    }
    setLoadingProducts(false);
  };

  // Order Transition Handlers
  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    const res = await bulkUpdateOrderStatusAction([orderId], nextStatus);
    if (res.success) {
      triggerToast(`Order #${orderId} status set to ${nextStatus}`);
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update status");
    }
  };

  const handleApproveReturn = async (orderId: string) => {
    const res = await processReturnRefundAction(orderId, true, "Return approved by admin");
    if (res.success) {
      triggerToast(`Return Refund Processed for #${orderId}`);
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to process refund");
    }
  };

  const confirmDeleteProduct = async () => {
    if (!targetProduct) return;
    const res = await deleteProductAction(targetProduct.id);
    if (!res.success) {
      triggerToast(res.error || "Failed to remove product");
      return;
    }
    triggerToast("Item removed");
    setModalType(null);
    setTargetProduct(null);
    router.refresh();
  };

  const confirmRestockProduct = async () => {
    if (!targetProduct || isSubmitting) return;
    setModalError("");
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty <= 0) {
      setModalError("Please enter a valid positive number.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await restockVariantAction(targetProduct.id, selectedSize, qty);
      if (!res.success) {
        setModalError(res.error || "Restock failed");
      } else {
        window.dispatchEvent(new Event("storage"));
        triggerToast(`Restocked +${qty} units to size ${selectedSize}`);
        setModalType(null);
        setTargetProduct(null);
        router.refresh();
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helpers for Payment splits
  const paymentSplitData = [
    { name: "Gateway (Razorpay)", value: metrics.cashRevenue || 0, color: "#BA7517" },
    { name: "Wallet Credits", value: metrics.creditRevenue || 0, color: "#1a1a1a" },
  ];

  // Helper for trend visualizer
  const renderTrendText = (trend: "up" | "down" | "none" | "first", percent: number) => {
    if (trend === "up") {
      return <span className="text-xs font-bold text-green-700 ml-2">↑ +{percent}%</span>;
    }
    if (trend === "down") {
      return <span className="text-xs font-bold text-red-600 ml-2">↓ -{Math.abs(percent)}%</span>;
    }
    if (trend === "first") {
      return <span className="text-xs font-bold text-gray-400 ml-2">— First day</span>;
    }
    return <span className="text-xs font-bold text-gray-400 ml-2">→ No change</span>;
  };

  // Status badge style helper
  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === "confirmed") return "bg-blue-50 text-blue-700 border border-blue-200/50";
    if (s === "processing" || s === "packed") return "bg-yellow-50 text-yellow-700 border border-yellow-200/50 font-bold";
    if (s === "shipped") return "bg-purple-50 text-purple-700 border border-purple-200/50";
    if (s === "delivered") return "bg-green-50 text-green-700 border border-green-200/50";
    if (s === "cancelled") return "bg-red-50 text-red-700 border border-red-200/50";
    if (s.includes("refund")) return "bg-orange-50 text-orange-700 border border-orange-200/50";
    return "bg-gray-50 text-gray-700 border border-gray-200/50";
  };

  // stock > 0 guard: out-of-stock products belong in a separate alert,
  // not in the "Low Stock Warnings" panel (which is a restock nudge).
  const lowStockProducts = products.filter(
    (p) => (p.stock || 0) > 0 && (p.stock || 0) <= LOW_STOCK_THRESHOLD
  );

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Shop Overview</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Dashboard</h2>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto font-bold">
          <div className="bg-white border border-gray-200 px-6 py-3 shadow-sm flex items-center gap-4 whitespace-nowrap">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Current Cycle</p>
              <p className="text-xs font-bold font-headline text-[#0a0a0a]">
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <span className="material-symbols-outlined text-gray-500">calendar_today</span>
          </div>
        </div>
      </header>

      {/* PART 1: New KPI Cards Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {/* Card 1: Today's Sales */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Today's Sales</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
              ₹{(todayKPI.todaySales || 0).toLocaleString("en-IN")}
            </h3>
            {renderTrendText(todayKPI.salesTrendStatus, todayKPI.salesChangePercent)}
          </div>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Compared to yesterday</span>
        </div>

        {/* Card 2: Today's Orders */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Today's Orders</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
              {todayKPI.todayOrders || 0}
            </h3>
            {renderTrendText(todayKPI.ordersTrendStatus, todayKPI.ordersChangePercent)}
          </div>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Compared to yesterday</span>
        </div>

        {/* Card 3: AOV */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Average Order Value (AOV)</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
            ₹{(kpis.aov || 0).toLocaleString("en-IN")}
          </h3>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Calculated over last 30 days</span>
        </div>

        {/* Card 4: Pending Shipments */}
        <Link
          href="/admindashboard/orders?filter=confirmed"
          className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group block hover:border-primary transition-all text-left"
        >
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Pending Shipments</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
              {kpis.pendingShipments || 0}
            </h3>
            <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">local_shipping</span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Click to view pending orders</span>
        </Link>

        {/* Card 5: Refund Requests */}
        <Link
          href="/admindashboard/orders?filter=returns"
          className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group block hover:border-primary transition-all text-left"
        >
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Refund Requests</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-headline font-black tracking-tighter text-primary flex items-center gap-2">
              {kpis.refundRequests || 0}
              {kpis.refundRequests > 0 && (
                <span className="size-2 rounded-full bg-red-600 animate-ping"></span>
              )}
            </h3>
            <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">assignment_return</span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Click to review refunds</span>
        </Link>

        {/* Card 6: Customer Growth */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Customer Growth</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
            +{kpis.customerGrowth || 0}
          </h3>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">New customer signups this month</span>
        </div>

        {/* Card 7: Conversion Rate */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Conversion Rate</p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
                {kpis.conversionRate || 0}%
              </h3>
              {(() => {
                const diff = (kpis.conversionRate || 0) - (kpis.conversionRatePrev || 0);
                const trend = diff > 0 ? "up" : diff < 0 ? "down" : "none";
                return renderTrendText(trend, Math.abs(diff));
              })()}
            </div>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Checkout → Payment (30 days)</span>
        </div>

        {/* Card 8: Repeat Customers */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Repeat Customers</p>
            <h3 className="text-3xl font-headline font-black tracking-tighter text-primary">
              {repeatPurchaseStats?.repeatRate || 0}%
            </h3>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mt-2 block">Customers with 2+ orders</span>
            <span className="text-[8px] font-black text-gray-600 block mt-0.5">
              {repeatPurchaseStats?.repeatCustomers || 0} of {repeatPurchaseStats?.totalCustomers || 0} customers returned
            </span>
          </div>
        </div>
      </section>

      {/* PART 2 & PART 3: Charts Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Revenue Trend Line Chart */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm lg:col-span-2 flex flex-col justify-between h-[420px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">Revenue Trend</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Aggregate daily sales value & order count</p>
            </div>
            {/* Toggles */}
            <div className="flex gap-2">
              {([7, 30, 90] as const).map((r) => (
                <button
                  key={r}
                  disabled={loadingRevenue}
                  onClick={() => handleRevenueRangeChange(r)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all rounded-none cursor-pointer ${
                    revenueDays === r
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent text-gray-500 border-gray-200 hover:border-[#0a0a0a]"
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>
          <div className="flex-grow w-full relative">
            {loadingRevenue ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Loading trend...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#ccc" />
                  <YAxis yAxisId="left" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#BA7517" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#888" />
                  <Tooltip
                    contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 0 }}
                    formatter={(value: any, name: any) => {
                      if (name === "revenue") return [`₹${value.toLocaleString()}`, "Revenue"];
                      return [value, "Orders"];
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke="#BA7517"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="order_count"
                    name="orders"
                    stroke="#888"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Split Donut Chart */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm flex flex-col justify-between h-[420px]">
          <div>
            <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">Payment Methods</h4>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Share of gateway and wallet pay</p>
          </div>
          <div className="flex-grow flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentSplitData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {paymentSplitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e5e5e5" }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, "Share"]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute text-center">
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Total Sales</p>
              <p className="text-lg font-headline font-black text-primary mt-0.5">
                ₹{metrics.totalRevenue?.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
            {paymentSplitData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                <div className="flex items-center gap-2">
                  <span className="size-2" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-600 uppercase tracking-wider">{item.name}</span>
                </div>
                <span className="text-[#0a0a0a]">₹{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PART 4 & PART 5: Top Selling & Coupon Performance */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Top Selling Products Horizontal Bar Chart */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm lg:col-span-2 flex flex-col justify-between h-[450px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">Top Products</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Best selling designs by units sold</p>
            </div>
            {/* Toggles */}
            <div className="flex gap-2">
              {([7, 30, 90] as const).map((r) => (
                <button
                  key={r}
                  disabled={loadingProducts}
                  onClick={() => handleProductsRangeChange(r)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all rounded-none cursor-pointer ${
                    productsDays === r
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent text-gray-500 border-gray-200 hover:border-[#0a0a0a]"
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>
          <div className="flex-grow w-full relative">
            {loadingProducts ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Loading list...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#fed488" />
                      <stop offset="100%" stopColor="#BA7517" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f5f5f5" />
                  <XAxis type="number" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#ccc" />
                  <YAxis
                    dataKey="productName"
                    type="category"
                    tick={{ fontSize: 9, fontFamily: "monospace" }}
                    stroke="#ccc"
                    width={90}
                    tickFormatter={(val) => (val.length > 15 ? val.slice(0, 15) + "..." : val)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e5e5e5" }}
                    formatter={(value: any, name: any, props: any) => {
                      if (name === "unitsSold") {
                        return [
                          `${value} units`,
                          `Units Sold (Revenue: ₹${props.payload.revenue.toLocaleString()})`,
                        ];
                      }
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="unitsSold" fill="url(#goldGradient)" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Coupon Performance Table */}
        <div className="bg-white border border-gray-200 shadow-sm flex flex-col justify-between h-[450px]">
          <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
            <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">Coupons</h4>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Times used and savings this month</p>
          </div>
          <div className="flex-grow overflow-y-auto">
            {couponPerformance.length === 0 ? (
              <div className="h-full flex items-center justify-center italic text-xs text-gray-400">
                No coupon usages recorded.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-white">
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Uses</th>
                    <th className="px-6 py-4 text-right">Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[10px] font-bold uppercase tracking-wider">
                  {couponPerformance.map((c, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-black text-primary">{c.coupon_code}</td>
                      <td className="px-6 py-4 text-gray-600">{c.times_used} uses</td>
                      <td className="px-6 py-4 text-right text-gray-900">₹{c.total_savings.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* SALES BY CATEGORY & TOP CITIES */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        {/* Sales by Category horizontal bar chart */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm flex flex-col justify-between h-[380px]">
          <div>
            <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">Sales by Category</h4>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Revenue distribution by product type</p>
          </div>
          <div className="flex-grow w-full relative h-[250px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} layout="vertical" margin={{ top: 10, right: 10, left: 35, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f5f5f5" />
                <XAxis type="number" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#ccc" tickFormatter={(val) => `₹${val}`} />
                <YAxis
                  dataKey="category"
                  type="category"
                  tick={{ fontSize: 9, fontFamily: "monospace" }}
                  stroke="#ccc"
                  width={90}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e5e5e5" }}
                  formatter={(value: any, name: any, props: any) => {
                    if (name === "revenue") {
                      return [
                        `₹${value.toLocaleString()}`,
                        `Revenue (${props.payload.percentage}% of total, ${props.payload.unitsSold} units)`,
                      ];
                    }
                    return [value, name];
                  }}
                />
                <Bar dataKey="revenue" fill="#BA7517" barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Cities section */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm flex flex-col justify-between h-[380px]">
          <div>
            <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">Top Cities by Orders</h4>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Last 30 days order distribution</p>
          </div>
          <div className="flex-grow overflow-y-auto mt-6 space-y-4 pr-2">
            {cityOrders && cityOrders.length > 0 ? (
              (() => {
                const maxCount = Math.max(...cityOrders.map((c: any) => c.count || 1));
                return cityOrders.slice(0, 5).map((item: any, index: number) => {
                  const pct = Math.round(((item.count || 0) / maxCount) * 100);
                  return (
                    <div key={item.city} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-gray-700">{index + 1}. {item.city}</span>
                        <div className="flex gap-4 font-mono text-gray-900">
                          <span>{item.count} orders</span>
                          <span>₹{(item.revenue || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-none overflow-hidden">
                        <div
                          className="h-full bg-[#BA7517] transition-all duration-1000 ease-out"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-8">No order data available</p>
            )}
          </div>
        </div>
      </section>

      {/* PART 6: Low Stock Alert — Enhanced */}
      <section className="bg-white border border-gray-200 shadow-sm overflow-hidden mb-16 rounded-none">
        <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-[#fafafa]">
          <div>
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-[#0a0a0a]">Low Stock Warnings</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
              Active products requiring immediate restock ({LOW_STOCK_THRESHOLD} or fewer units remaining).
            </p>
          </div>
          <Link
            href="/admindashboard/inventory"
            className="text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#0a0a0a] flex items-center gap-1 transition-colors"
          >
            Manage Inventory <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="px-8 py-6">Product</th>
                <th className="px-8 py-6">Category</th>
                <th className="px-8 py-6">Price</th>
                <th className="px-8 py-6">Stock Status & Levels</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs font-label">
              {lowStockProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-green-700 font-bold bg-green-50/20 italic">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                      <span>All active products are well stocked (greater than 15 units).</span>
                    </div>
                  </td>
                </tr>
              ) : (
                lowStockProducts.slice(0, 8).map((p) => {
                  const stock = p.stock || 0;
                  const percent = Math.min(100, Math.round((stock / 20) * 100));

                  // Color coding rules
                  let barColor = "bg-yellow-500";
                  if (stock === 0) barColor = "bg-red-600";
                  else if (stock <= 5) barColor = "bg-red-500";
                  else if (stock <= 10) barColor = "bg-orange-500";

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="size-10 bg-gray-50 overflow-hidden border border-gray-200 grayscale p-1 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.image} className="w-full h-full object-cover" alt={p.title} />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-tight font-bold">{p.title}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-gray-500 uppercase tracking-widest font-bold text-[9px]">{p.category}</td>
                      <td className="px-8 py-6 font-bold">₹{p.price.toLocaleString("en-IN")}</td>
                      <td className="px-8 py-6 max-w-[200px]">
                        <div className="w-full bg-gray-100 h-2 overflow-hidden flex">
                          <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 mt-1.5 block">
                          {stock === 0 ? (
                            <span className="text-red-600 font-black">OUT OF STOCK</span>
                          ) : (
                            `${stock}/20 units (${percent}%)`
                          )}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setTargetProduct(p);
                              setSelectedSize("S");
                              setRestockQty("10");
                              setModalType("restock");
                            }}
                            className="bg-primary hover:bg-secondary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[10px]">add</span> Restock
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PART 7: Recent Orders — Enhanced */}
      <section className="bg-white border border-gray-200 shadow-sm overflow-hidden mb-16">
        <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-[#fafafa]">
          <div>
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-[#0a0a0a]">Recent Orders</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
              Managing your latest sales activity.
            </p>
          </div>
          <Link
            href="/admindashboard/orders"
            className="text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#0a0a0a] flex items-center gap-1 transition-colors"
          >
            View All Orders <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="px-8 py-6">Order ID</th>
                <th className="px-8 py-6">Customer Name</th>
                <th className="px-8 py-6">Valuation</th>
                <th className="px-8 py-6">Payment Method</th>
                <th className="px-8 py-6">Current Logistics Status</th>
                <th className="px-8 py-6 text-right">Quick State Transitions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs font-label">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">
                    No orders recorded in database registry.
                  </td>
                </tr>
              ) : (
                orders.slice(0, 10).map((order) => {
                  const hasGateway = order.gatewayPaid > 0;
                  const hasWallet = order.walletPaid > 0;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6 font-bold font-headline text-[#0a0a0a]">#{order.id}</td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold">{order.customer}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase">Store user</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 font-bold">₹{order.total.toLocaleString("en-IN")}</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-gray-600">
                          {hasGateway && (
                            <span className="material-symbols-outlined text-sm" title="Paid via Razorpay/Card">
                              credit_card
                            </span>
                          )}
                          {hasWallet && (
                            <span className="material-symbols-outlined text-sm" title="Paid via Wallet credits">
                              account_balance_wallet
                            </span>
                          )}
                          <span className="text-[9px] font-black uppercase tracking-wider">
                            {hasGateway && hasWallet
                              ? "Split"
                              : hasGateway
                              ? "Card/Gateway"
                              : hasWallet
                              ? "Wallet"
                              : "COD/Other"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-block px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-none border ${getStatusBadgeStyle(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {order.status === "Paid" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "Delivered")}
                              className="bg-green-600 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 cursor-pointer"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {order.status === "Return Requested" && (
                            <button
                              onClick={() => handleApproveReturn(order.id)}
                              className="bg-red-600 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 cursor-pointer"
                            >
                              Process Refund Return
                            </button>
                          )}
                          <Link
                            href={`/admindashboard/order-details?orderId=${order.id}`}
                            className="border border-gray-300 hover:border-[#0a0a0a] text-gray-700 hover:text-[#0a0a0a] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 flex items-center gap-1"
                          >
                            Details <span className="material-symbols-outlined text-xs">arrow_forward</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Restock Variant Modal */}
      {modalType === "restock" && targetProduct && (() => {
        const currentStock = targetProduct.sizeStock?.[selectedSize] || 0;
        const inputQty = parseInt(restockQty) || 0;

        const current = currentStock;
        const addQty = inputQty >= 0 ? inputQty : 0;
        const maxScale = Math.max(current + addQty, current * 2, 10);
        const currentWidth = (current / maxScale) * 100 + "%";
        const addWidth = (addQty / maxScale) * 100 + "%";

        return (
          <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-left rounded-none animate-zoom-in">
              <div className="space-y-1.5 text-center">
                <h3 className="text-[15px] font-medium tracking-wide text-primary uppercase">Restock variant</h3>
                <p className="text-[12px] text-gray-400 lowercase tracking-wide italic">Adjust incoming stock for this size only</p>
              </div>

              {modalError && (
                <div className="bg-red-50 text-red-600 border border-red-100 p-2 text-[10px] font-bold uppercase tracking-wider text-center">
                  {modalError}
                </div>
              )}

              {/* Meta chips row */}
              <div className="flex gap-2 justify-center flex-wrap">
                <span className="bg-[#faf9f8] border border-[#d1c5b4]/50 rounded-[6px] px-2.5 py-1 text-[12px] font-bold text-gray-600">
                  Product: {targetProduct.title}
                </span>
                <span className="bg-[#faf9f8] border border-[#d1c5b4]/50 rounded-[6px] px-2.5 py-1 text-[12px] font-bold text-gray-600">
                  Current: {currentStock}
                </span>
              </div>

              {/* Size Select Dropdown */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Select Variant Size</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value as any)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none bg-white cursor-pointer"
                >
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>

              {/* Input Qty */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Add Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                  placeholder="10"
                />
              </div>

              {/* Stock progress visualizer */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                  <span>Current stock</span>
                  <span>After restock</span>
                </div>
                <div className="w-full h-2 rounded-[6px] bg-[#faf9f8] border border-gray-100 flex overflow-hidden">
                  <div
                    className="h-full bg-gray-300"
                    style={{ width: currentWidth, transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                  <div
                    className="h-full"
                    style={{ backgroundColor: "#BA7517", width: addWidth, transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setModalType(null);
                    setTargetProduct(null);
                  }}
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={confirmRestockProduct}
                  className="flex-1 px-4 py-3 bg-primary text-white hover:bg-secondary text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none border-none font-bold"
                >
                  {isSubmitting ? "Restocking..." : "Restock"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
