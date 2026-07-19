"use client";

import React, { useState, useEffect } from "react";
import { getSalesAnalyticsAction, getRevenueByCategoryAction } from "@/app/actions/admin-analytics";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function SalesAnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [useCustom, setUseCustom] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let daysQuery: number = days;
      if (useCustom && startDate && endDate) {
        const start = new Date(startDate);
        const diffFromToday = Math.abs(Date.now() - start.getTime());
        daysQuery = Math.max(days, Math.ceil(diffFromToday / (1000 * 60 * 60 * 24)));
      }
      const res = await getSalesAnalyticsAction(daysQuery);
      if (res.success) {
        setData(res);
      }
      setLoading(false);
    }
    load();
  }, [days, useCustom, startDate, endDate]);

  // Category revenue — uses same days window converted to ISO dates
  const [categoryData, setCategoryData] = useState<Array<{
    category: string;
    orders: number;
    revenue: number;
    percentage: number;
  }>>([]);

  useEffect(() => {
    const startISO = useCustom && startDate
      ? new Date(startDate).toISOString()
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const endISO = useCustom && endDate
      ? new Date(endDate).toISOString()
      : new Date().toISOString();

    getRevenueByCategoryAction(startISO, endISO).then((res) => {
      if (res.success && res.data) {
        setCategoryData(res.data);
      }
    });
  }, [days, useCustom, startDate, endDate]);

  const handleExportDetailedReport = () => {
    if (!data) return;

    const todayKPI = data.todaySales || {};
    const kpiMetrics = data.kpiMetrics || {};
    const repeatStats = data.repeatPurchaseStats || {};
    const cityOrders = data.cityOrders || [];
    const categoryStats = data.categoryStats || [];
    const topProducts = data.topProducts || [];
    const trend = data.revenueTrend || [];

    let csvContent = "data:text/csv;charset=utf-8,";

    // 1. Executive Summary
    csvContent += "=== 6K SALES ANALYTICS REPORT ===\n";
    csvContent += `Report Generated At,${new Date().toLocaleString()}\n`;
    csvContent += `Period Selected,Last ${days} Days\n\n`;

    csvContent += "=== KPI SUMMARY ===\n";
    csvContent += `Today's Sales (INR),${todayKPI.todaySales || 0}\n`;
    csvContent += `Today's Orders,${todayKPI.todayOrders || 0}\n`;
    csvContent += `Average Order Value (AOV - INR),${kpiMetrics.aov || 0}\n`;
    csvContent += `Conversion Rate,${kpiMetrics.conversionRate || 0}%\n`;
    csvContent += `Repeat Customers Rate,${repeatStats.repeatRate || 0}%\n`;
    csvContent += `Repeat Customers,${repeatStats.repeatCustomers || 0}\n`;
    csvContent += `Total Customers,${repeatStats.totalCustomers || 0}\n\n`;

    // 2. Sales by Category
    csvContent += "=== SALES BY CATEGORY ===\n";
    csvContent += "Category,Revenue (INR),Order Count,Units Sold,Percentage\n";
    categoryStats.forEach((row: any) => {
      csvContent += `"${row.category}",${row.revenue},${row.orderCount},${row.unitsSold},${row.percentage}%\n`;
    });
    csvContent += "\n";

    // 3. Top Products
    csvContent += "=== TOP PRODUCTS ===\n";
    csvContent += "Product Name,Units Sold,Revenue (INR)\n";
    topProducts.forEach((row: any) => {
      csvContent += `"${row.productName}",${row.unitsSold},${row.revenue}\n`;
    });
    csvContent += "\n";

    // 4. Geographic Breakdown
    csvContent += "=== TOP CITIES ===\n";
    csvContent += "City,Orders,Revenue (INR)\n";
    cityOrders.forEach((row: any) => {
      csvContent += `"${row.city}",${row.count},${row.revenue || 0}\n`;
    });
    csvContent += "\n";

    // 5. Daily Sales Trend
    csvContent += "=== DAILY SALES TREND ===\n";
    csvContent += "Date,Revenue (INR),Order Count\n";
    trend.forEach((row: any) => {
      csvContent += `"${row.date}",${row.revenue},${row.order_count}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `6K_Sales_Report_${days}D.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const salesData = revenueTrend || [];
    if (salesData.length === 0) return;
    const rows = salesData.map((d: any) => ({
      Date: d.date,
      Orders: d.order_count || 0,
      Revenue: d.revenue || 0,
      AOV: d.order_count > 0 ? Math.round(d.revenue / d.order_count) : 0,
      Refunds: 0,
      'Net Revenue': d.revenue
    }));
    
    const csv = [
      Object.keys(rows[0]).join(','),
      ...rows.map((r: any) => Object.values(r).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `6k-sales-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="size-8 rounded-full border-2 border-white/20 border-t-[#fed488] animate-spin"></div>
      </div>
    );
  }

  const todayKPI = data?.todaySales || {};
  const kpis = data?.kpiMetrics || {};
  const rawRevenueTrend = data?.revenueTrend || [];
  const categoryStats = data?.categoryStats || [];
  const topProducts = data?.topProducts || [];
  const repeatPurchaseStats = data?.repeatPurchaseStats || {};
  const cityOrders = data?.cityOrders || [];

  const filterByDateRange = (trendData: any[]) => {
    if (!useCustom || !startDate || !endDate) return trendData;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return trendData.filter((item: any) => {
      const currentYear = new Date().getFullYear();
      const parsedDate = new Date(`${item.date} ${currentYear}`);
      parsedDate.setHours(12, 0, 0, 0);
      return parsedDate >= start && parsedDate <= end;
    });
  };

  const revenueTrend = filterByDateRange(rawRevenueTrend);

  return (
    <div className="p-8 max-w-7xl mx-auto text-white font-body">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/10 pb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#fed488]">Sales Intelligence</span>
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight mt-1 text-white">Sales Analytics Dashboard</h1>
          <p className="text-[11px] text-white/50 mt-1 uppercase tracking-wider">Monitor direct store conversion rates, category aggregates, and geographic ordering trends</p>
        </div>

        {/* Date Filter & Export */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex bg-white/5 border border-white/10 p-1 flex-wrap items-center gap-2">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setDays(r);
                  setUseCustom(false);
                }}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer border-none ${
                  !useCustom && days === r
                    ? "bg-[#fed488] text-[#0a0a0a]"
                    : "bg-transparent text-zinc-300 hover:text-white"
                }`}
              >
                {r}D
              </button>
            ))}
            
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
              <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">Custom:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setUseCustom(true);
                }}
                className="bg-[#171717] border border-white/15 text-white text-[9px] px-2 py-1 outline-none rounded-none focus:border-[#fed488]"
              />
              <span className="text-[9px] text-zinc-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setUseCustom(true);
                }}
                className="bg-[#171717] border border-white/15 text-white text-[9px] px-2 py-1 outline-none rounded-none focus:border-[#fed488]"
              />
            </div>
          </div>

          <button
            onClick={handleExportDetailedReport}
            className="px-5 py-2.5 bg-[#fed488] text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-[#e0bb70] transition-all flex items-center gap-2 border-none rounded-none cursor-pointer select-none"
          >
            <span className="material-symbols-outlined text-[13px] font-black">download</span>
            <span>Export Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm cursor-pointer select-none hover:bg-neutral-900 border-none transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white border border-white/10 py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl animate-pulse">
          Refreshing data...
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Today's Sales */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-36">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Today's Sales</h3>
            <p className="text-2xl font-headline font-black text-white mt-2">
              ₹{(todayKPI.todaySales || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-bold block">Refreshes in real-time</span>
        </div>

        {/* Card 2: Today's Orders */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-36">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Today's Orders</h3>
            <p className="text-2xl font-headline font-black text-white mt-2">
              {todayKPI.todayOrders || 0}
            </p>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-bold block">Direct purchases logged</span>
        </div>

        {/* Card 3: Conversion Rate */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-36">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Conversion Rate</h3>
            <div className="flex items-baseline justify-between mt-2">
              <p className="text-2xl font-headline font-black text-white">
                {kpis.conversionRate || 0}%
              </p>
              {(() => {
                const diff = (kpis.conversionRate || 0) - (kpis.conversionRatePrev || 0);
                if (diff > 0) {
                  return <span className="text-xs font-bold text-green-500">↑ +{diff}%</span>;
                } else if (diff < 0) {
                  return <span className="text-xs font-bold text-red-500">↓ -{Math.abs(diff)}%</span>;
                }
                return <span className="text-xs font-bold text-zinc-400">→ 0%</span>;
              })()}
            </div>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-bold block">Checkout → Payment ({days} days)</span>
        </div>

        {/* Card 4: Repeat Customers */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-36">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Repeat Customers</h3>
            <p className="text-2xl font-headline font-black text-white mt-2">
              {repeatPurchaseStats?.repeatRate || 0}%
            </p>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-bold block">
            {repeatPurchaseStats?.repeatCustomers || 0} of {repeatPurchaseStats?.totalCustomers || 0} returned ({days} days)
          </span>
        </div>
      </div>

      {/* Revenue Trend Line Chart */}
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mb-8">
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#fed488]">Revenue Trend</h3>
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Aggregate daily sales value & order counts</p>
        </div>
        <div className="w-full h-80 relative">
          {mounted && revenueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace", fill: "#d4d4d8" }} stroke="rgba(255,255,255,0.25)" />
                <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "#d4d4d8" }} stroke="rgba(255,255,255,0.25)" tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "0px",
                    color: "#fff",
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#fed488" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center italic text-xs text-zinc-400">No revenue data loaded</div>
          )}
        </div>
      </div>

      {/* Grid: Sales by Category & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Sales by Category Horizontal Bar Chart */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between h-[380px]">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Sales by Category</h3>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6">Distribution of sales volume by product type</p>
          </div>

          <div className="flex-grow w-full relative h-[250px]">
            {mounted && categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fontFamily: "monospace", fill: "#d4d4d8" }} stroke="rgba(255,255,255,0.25)" tickFormatter={(val) => `₹${val}`} />
                  <YAxis
                    dataKey="category"
                    type="category"
                    tick={{ fontSize: 9, fontFamily: "monospace", fill: "#d4d4d8" }}
                    stroke="rgba(255,255,255,0.25)"
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#171717",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "0px",
                      color: "#fff",
                      fontFamily: "monospace",
                      fontSize: "11px",
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `₹${value.toLocaleString()}`,
                      `Revenue (${props.payload.percentage}%, ${props.payload.unitsSold} units)`,
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#fed488" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-zinc-400 uppercase tracking-widest text-center py-12">No category stats recorded</p>
            )}
          </div>
        </div>

        {/* Top Performing Products */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between h-[380px]">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Top Products</h3>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6">Best selling items ranked by total units sold</p>
          </div>

          <div className="flex-grow w-full relative h-[250px]">
            {mounted && topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fontFamily: "monospace", fill: "#d4d4d8" }} stroke="rgba(255,255,255,0.25)" />
                  <YAxis
                    dataKey="productName"
                    type="category"
                    tick={{ fontSize: 9, fontFamily: "monospace", fill: "#d4d4d8" }}
                    stroke="rgba(255,255,255,0.25)"
                    width={80}
                    tickFormatter={(val) => (val.length > 12 ? val.slice(0, 12) + "..." : val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#171717",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "0px",
                      color: "#fff",
                      fontFamily: "monospace",
                      fontSize: "11px",
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${value} units`,
                      `Units Sold (Revenue: ₹${props.payload.revenue.toLocaleString()})`,
                    ]}
                  />
                  <Bar dataKey="unitsSold" fill="#fed488" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-zinc-400 uppercase tracking-widest text-center py-12">No products sold in this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Geographic Breakdown */}
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
        <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Top Ordering Cities</h3>
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6">Delivery address distribution in the last 30 days</p>

        <div className="space-y-4">
          {cityOrders && cityOrders.length > 0 ? (
            (() => {
              const maxCount = Math.max(...cityOrders.map((c: any) => c.count || 1));
              return cityOrders.slice(0, 5).map((item: any, index: number) => {
                const pct = Math.round(((item.count || 0) / maxCount) * 100);
                return (
                  <div key={item.city} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                      <span className="text-white/80">{index + 1}. {item.city}</span>
                      <div className="flex gap-4 font-mono text-white">
                        <span>{item.count} Orders</span>
                        <span>₹{(item.revenue || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-white/5 border border-white/10 rounded-none overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#fed488]/50 to-[#fed488] transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              });
            })()
          ) : (
            <p className="text-xs text-zinc-400 uppercase tracking-widest text-center py-8">
              No orders loaded in the last 30 days.
            </p>
          )}
        </div>
      </div>

      {/* Revenue by Collection (display_section grouping) */}
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mt-8">
        <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">
          Revenue by Collection
        </h3>
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6">
          Sales breakdown by product display section — last {days} days
        </p>

        {categoryData.length === 0 ? (
          <p className="text-xs text-zinc-400 uppercase tracking-widest text-center py-8">
            No collection data available for this period
          </p>
        ) : (
          <>
            <div className="space-y-5">
              {categoryData.map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/80">
                      {cat.category}
                    </span>
                    <div className="flex items-center gap-5 font-mono">
                      <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                        {cat.orders} items
                      </span>
                      <span className="text-xs font-bold text-white">
                        ₹{cat.revenue.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[9px] font-bold text-[#fed488] w-9 text-right">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/5 border border-white/10 h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#fed488]/60 to-[#fed488] h-full transition-all duration-700 ease-out"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
                {categoryData.length} collections tracked
              </span>
              <span className="text-xs font-black font-mono text-white">
                Total: ₹{categoryData
                  .reduce((sum, c) => sum + c.revenue, 0)
                  .toLocaleString("en-IN")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
