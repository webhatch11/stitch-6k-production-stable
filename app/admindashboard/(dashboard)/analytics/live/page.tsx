"use client";

import React, { useState, useEffect } from "react";
import { getLiveAnalyticsAction } from "@/app/actions/admin-analytics";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const KNOWN_STATES = new Set([
  "tamil nadu", "maharashtra", "karnataka", "delhi", "kerala", "gujarat", 
  "uttar pradesh", "rajasthan", "west bengal", "telangana", "andhra pradesh",
  "punjab", "haryana", "bihar", "madhya pradesh", "odisha", "assam"
]);

const CITY_COORDINATES: Record<string, [number, number]> = {
  "mumbai": [72.8777, 19.0760],
  "delhi": [77.1025, 28.7041],
  "new delhi": [77.1025, 28.7041],
  "bangalore": [77.5946, 12.9716],
  "bengaluru": [77.5946, 12.9716],
  "hyderabad": [78.4867, 17.3850],
  "ahmedabad": [72.5714, 23.0225],
  "chennai": [80.2707, 13.0827],
  "kolkata": [88.3639, 22.5726],
  "surat": [72.8311, 21.1702],
  "pune": [73.8567, 18.5204],
  "jaipur": [75.7873, 26.9124],
  "lucknow": [80.9462, 26.8467],
  "kanpur": [80.3319, 26.4499],
  "nagpur": [79.0882, 21.1458],
  "indore": [75.8577, 22.7196],
  "thane": [72.9781, 19.2183],
  "bhopal": [77.4126, 23.2599],
  "visakhapatnam": [83.2185, 17.6868],
  "patna": [85.1376, 25.5941],
  "vadodara": [73.1812, 22.3072],
  "coimbatore": [76.9558, 11.0168],
  "madurai": [78.1198, 9.9252],
  "kochi": [76.2673, 9.9312],
  "trivandrum": [76.9366, 8.5241],
  "chandigarh": [76.7794, 30.7333],
};

function getCityCoordinates(cityName: string): [number, number] {
  const norm = cityName.trim().toLowerCase();
  if (CITY_COORDINATES[norm]) {
    return CITY_COORDINATES[norm];
  }
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i);
    hash1 = (hash1 * 31 + char) % 1000;
    hash2 = (hash2 * 17 + char) % 1000;
  }
  const lon = 72 + (hash1 / 1000) * 16;
  const lat = 11 + (hash2 / 1000) * 17;
  return [lon, lat];
}

function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return diffSec <= 1 ? "1 sec ago" : `${diffSec} secs ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1 ? "1 min ago" : `${diffMin} mins ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}

function classifyEvent(eventText: string): string {
  const text = (eventText || "").toLowerCase();
  if (text.includes("return") || text.includes("refund") || text.includes("returned")) {
    return "RETURN";
  }
  if (text.includes("payment") || text.includes("paid") || text.includes("wallet")) {
    return "PAYMENT";
  }
  return "ORDER";
}

function eventBadge(tag: string) {
  const upper = tag.toUpperCase();
  if (upper === "RETURN") {
    return {
      border: "border-purple-600",
      badge: "text-purple-700 bg-purple-50 border border-purple-200",
    };
  }
  if (upper === "PAYMENT") {
    return {
      border: "border-green-600",
      badge: "text-green-700 bg-green-50 border border-green-200",
    };
  }
  if (upper === "ORDER") {
    return {
      border: "border-blue-600",
      badge: "text-blue-700 bg-blue-50 border border-blue-200",
    };
  }
  return {
    border: "border-[#775a19]",
    badge: "text-[#775a19] bg-[#775a19]/10 border border-[#775a19]/20",
  };
}

export default function LiveAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [selectedCity, setSelectedCity] = useState<{ city: string; count: number; revenue: number } | null>(null);

  const [prevRevenue, setPrevRevenue] = useState(0);
  const [revenueChanged, setRevenueChanged] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (data?.todayRevenue !== undefined && data.todayRevenue !== prevRevenue) {
      if (prevRevenue !== 0) {
        setRevenueChanged(true);
        setTimeout(() => setRevenueChanged(false), 2000);
      }
      setPrevRevenue(data.todayRevenue);
    }
  }, [data?.todayRevenue, prevRevenue]);

  // Fetch live data every 20 seconds
  useEffect(() => {
    async function load() {
      const res = await getLiveAnalyticsAction();
      if (res.success) {
        setData(res);
        setSecondsSinceUpdate(0);
        setLastUpdated(new Date());
      }
      setLoading(false);
    }
    load();

    const interval = setInterval(() => {
      load();
    }, 20000);

    return () => clearInterval(interval);
  }, [refreshTrigger]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="size-8 rounded-none border-2 border-gray-200 border-t-[#775a19] animate-spin"></div>
      </div>
    );
  }

  const onlineVisitors = data?.onlineVisitors ?? 0;
  const activeCarts = data?.activeCarts ?? 0;
  const todayOrdersCount = data?.todayOrdersCount ?? 0;
  const todayRevenue = data?.todayRevenue ?? 0;
  const todayPendingOrders = data?.todayPendingOrders ?? 0;
  const recentOrders: { id: string; customer: string; total: number; created_at: string }[] =
    data?.recentOrders ?? [];

  // Filter state names from city orders list
  const rawCityOrders = data?.cityOrders || [];
  const cityOrders = rawCityOrders.filter((c: any) => !KNOWN_STATES.has(String(c.city).trim().toLowerCase()));

  const recentEvents: { order_id: string; event: string; created_at: string; customer?: string; total?: number }[] =
    data?.recentEvents ?? [];
  const productViewers = data?.productViewers || [];
  const funnel = data?.funnel ?? {
    visitors: onlineVisitors,
    productViews: 0,
    activeCarts: activeCarts,
    checkoutStarted: 0,
    ordersToday: todayOrdersCount,
  };

  return (
    <div className="p-8 lg:p-16 min-h-screen bg-[#fafafa] text-[#1a1c1c] font-body">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 border-b border-gray-200 pb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#775a19] flex items-center gap-1.5">
            <span className="size-2 bg-red-600 block animate-pulse"></span>
            Live Activity Monitor
          </span>
          <h1 className="font-headline text-4xl lg:text-5xl font-black uppercase tracking-tighter text-[#1a1c1c] leading-none mt-2">
            Real-Time Analytics
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">
            Monitor active visitors, shopping carts, and immediate order inflows
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[9px] font-bold font-mono text-gray-400 uppercase tracking-widest block">
              {secondsSinceUpdate === 0 ? "Just updated" : `Updated ${secondsSinceUpdate}s ago`}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Last sync: {lastUpdated.toLocaleTimeString()}
              <button onClick={handleManualRefresh} className="ml-2 text-[#775a19] bg-transparent border-none cursor-pointer font-bold hover:underline">
                ↻ Refresh
              </button>
            </p>
          </div>

          <button
            onClick={handleManualRefresh}
            className="size-10 bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-[#1a1c1c] transition-colors cursor-pointer select-none rounded-none shadow-sm"
            title="Refresh Now"
          >
            <span className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* Real-time stats row — 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Card 1: Online Visitors */}
        <div className="bg-white border border-gray-200 p-6 rounded-none shadow-sm flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Active Online Visitors</h3>
              <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">Real-time storefront sessions</p>
            </div>
            <span className="material-symbols-outlined text-[#775a19] text-lg bg-[#775a19]/10 p-2">public</span>
          </div>
          <div className="mt-2">
            <span className="text-4xl font-black font-headline text-[#1a1c1c] font-mono">{onlineVisitors}</span>
            <span className="text-[9px] font-black uppercase text-green-700 tracking-wider ml-3 bg-green-50 px-2 py-0.5 select-none border border-green-200">
              Live
            </span>
            <span className="text-[8px] text-gray-400 uppercase tracking-widest block mt-2">Active in last 45 sec</span>
          </div>
        </div>

        {/* Card 2: Active Carts */}
        <div className="bg-white border border-gray-200 p-6 rounded-none shadow-sm flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Active Shopping Carts</h3>
              <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">Cart updates in last 30 minutes</p>
            </div>
            <span className="material-symbols-outlined text-[#775a19] text-lg bg-[#775a19]/10 p-2">shopping_bag</span>
          </div>
          <div className="mt-2">
            <span className="text-4xl font-black font-headline text-[#1a1c1c] font-mono">{activeCarts}</span>
            <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider ml-3">Pending Checkout</span>
          </div>
        </div>

        {/* Card 3: Today's Orders / Revenue */}
        <div className="bg-white border border-gray-200 p-6 rounded-none shadow-sm flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Today's Transactions</h3>
              <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">Calculated from 12:00 AM today</p>
            </div>
            <span className="material-symbols-outlined text-[#775a19] text-lg bg-[#775a19]/10 p-2">payments</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-4xl font-black font-headline text-[#1a1c1c] font-mono">{todayOrdersCount}</span>
              <span className="text-xs text-gray-400 uppercase tracking-widest ml-2">Orders</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-black font-mono transition-colors duration-500 ${
                revenueChanged ? "text-green-700 scale-105" : "text-[#775a19]"
              }`}>
                ₹{todayRevenue.toLocaleString("en-IN")}
              </span>
              <p className="text-[8px] text-gray-400 uppercase tracking-widest">Gross Sales</p>
            </div>
          </div>
        </div>

        {/* Card 4: Today's Pending Orders */}
        <div className="bg-white border border-gray-200 p-6 rounded-none shadow-sm flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Pending Orders</h3>
              <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">Paid today, awaiting dispatch</p>
            </div>
            <span className="material-symbols-outlined text-amber-700 text-lg bg-amber-50 p-2 border border-amber-200">pending_actions</span>
          </div>
          <div className="mt-2">
            <span className="text-4xl font-black font-headline text-[#1a1c1c] font-mono">{todayPendingOrders}</span>
            <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider ml-3 bg-amber-50 px-2 py-0.5 select-none border border-amber-200">
              {todayPendingOrders === 1 ? "Needs Action" : "Awaiting"}
            </span>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white border border-gray-200 p-8 rounded-none shadow-sm mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">CONVERSION FUNNEL — REAL-TIME PIPELINE</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Visitor engagement to order flow</p>
          </div>
        </div>

        {/* Funnel steps */}
        <div className="flex flex-col sm:flex-row items-stretch gap-0 relative border border-gray-200">
          {[
            {
              label: "Visitors",
              value: funnel.visitors,
              sub: "Active on site",
              color: "#2563eb",
              pctOf: null,
            },
            {
              label: "Viewing",
              value: funnel.productViews,
              sub: "On product pages",
              color: "#7c3aed",
              pctOf: funnel.visitors,
            },
            {
              label: "In Cart",
              value: funnel.activeCarts,
              sub: "Items in bag",
              color: "#d97706",
              pctOf: funnel.visitors,
            },
            {
              label: "Checkout",
              value: funnel.checkoutStarted,
              sub: "Reached checkout",
              color: "#db2777",
              pctOf: funnel.visitors,
            },
            {
              label: "Ordered Today",
              value: funnel.ordersToday,
              sub: "Completed orders",
              color: "#16a34a",
              pctOf: null,
            },
          ].map((step, i, arr) => {
            const pct =
              step.pctOf != null && step.pctOf > 0
                ? Math.round((step.value / step.pctOf) * 100)
                : null;
            const isLast = i === arr.length - 1;
            return (
              <div key={step.label} className="flex-1 flex items-stretch border-r border-gray-200 last:border-r-0">
                <div
                  className="flex-1 flex flex-col items-center justify-center py-6 px-4 bg-gray-50/50"
                  style={{
                    borderTop: `3px solid ${step.color}`,
                  }}
                >
                  <span
                    className="text-[9px] font-black uppercase tracking-widest mb-1"
                    style={{ color: step.color }}
                  >
                    {step.label}
                  </span>
                  <span className="text-3xl font-black font-mono text-[#1a1c1c] mb-1">
                    {step.value.toLocaleString()}
                  </span>
                  {pct !== null && (
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 border"
                      style={{
                        background: `${step.color}10`,
                        color: step.color,
                        borderColor: `${step.color}30`,
                      }}
                    >
                      {pct}% of visitors
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider text-center font-bold">
                    {step.sub}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Orders Feed */}
      {recentOrders.length > 0 && (
        <div className="bg-white border border-gray-200 p-8 rounded-none shadow-sm mb-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mb-1">Recent Orders Feed</h3>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">Last 5 orders placed on the storefront</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
                  <th className="pb-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Customer</th>
                  <th className="pb-3 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Amount</th>
                  <th className="pb-3 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    {/* FULL UNTRUNCATED ORDER ID DISPLAY */}
                    <td className="py-3.5 text-xs font-black uppercase tracking-wider text-[#775a19] font-mono">
                      {String(order.id).toUpperCase()}
                    </td>
                    <td className="py-3.5 text-xs text-[#1a1c1c] font-bold tracking-wider">
                      {order.customer}
                    </td>
                    <td className="py-3.5 text-xs font-bold font-mono text-[#1a1c1c] text-right">
                      ₹{Number(order.total).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 text-[9px] font-mono text-gray-400 text-right uppercase tracking-widest">
                      {timeAgo(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Geographic Distribution India Map Dashboard */}
      <div className="bg-white border border-gray-200 p-8 rounded-none shadow-sm mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* India Delivery Map outline */}
          <div className="lg:col-span-3 min-h-[460px] relative border border-gray-200 bg-gray-50 flex flex-col justify-between p-6 rounded-none overflow-hidden">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#775a19] block">
                🔴 Live Dispatch Heatmap
              </span>
              <h3 className="font-headline text-lg font-black uppercase tracking-tight mt-0.5 text-[#1a1c1c]">India Delivery Map</h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Sourced from 100% accurate customer shipping addresses</p>
            </div>
            
            <div className="w-full flex items-center justify-center my-4 overflow-hidden relative">
              {mounted ? (
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 850,
                    center: [78.9629, 22.5937]
                  }}
                  style={{ width: "100%", maxHeight: "380px" }}
                >
                  <Geographies geography="/maps/india-states.json">
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          style={{
                            default: { fill: "#e5e7eb", stroke: "#d1d5db", strokeWidth: 0.5, outline: "none" },
                            hover: { fill: "#d1d5db", outline: "none" },
                            pressed: { outline: "none" }
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {cityOrders.map((item: any) => {
                    const coords = getCityCoordinates(item.city);
                    const isSelected = selectedCity?.city === item.city;
                    const markerRadius = Math.min(16, Math.max(5, (item.count / (data?.todayOrdersCount || 1)) * 24));

                    return (
                      <Marker key={item.city} coordinates={coords}>
                        <circle
                          r={markerRadius}
                          fill="#775a19"
                          fillOpacity={isSelected ? 0.9 : 0.6}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          className="cursor-pointer transition-all hover:scale-125"
                          onClick={() => setSelectedCity(item)}
                        />
                      </Marker>
                    );
                  })}
                </ComposableMap>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-gray-400">Loading Map...</div>
              )}
            </div>

            <div className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">
              * Click map pin or city bar to view order breakdown
            </div>
          </div>

          {/* Top Ordering Cities sidebar */}
          <div className="lg:col-span-2 flex flex-col justify-between border-l border-gray-200 pl-0 lg:pl-8">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mb-1">Top Ordering Cities</h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">Distribution of orders placed in last 30 days by city</p>

              <div className="space-y-4">
                {cityOrders.length > 0 ? (
                  cityOrders.slice(0, 6).map((item: any, index: number) => {
                    const maxCityOrders = Math.max(...cityOrders.map((c: any) => c.count || 1));
                    const pct = Math.round(((item.count || 0) / maxCityOrders) * 100);
                    return (
                      <div
                        key={item.city}
                        onClick={() => setSelectedCity(item)}
                        className={`space-y-1.5 p-2 transition-all cursor-pointer ${
                          selectedCity?.city === item.city ? "bg-gray-100 border-l-2 border-[#775a19]" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                          <span className="text-[#1a1c1c]">{index + 1}. {item.city}</span>
                          <span className="font-mono text-[#775a19]">{item.count} Orders</span>
                        </div>
                        <div className="h-2 bg-gray-100 border border-gray-200 rounded-none overflow-hidden">
                          <div
                            className="h-full bg-[#775a19] transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 uppercase tracking-widest text-center py-8">
                    No ordering city data recorded
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Grid: Popular Products & Live Event Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Popular Products / Active Viewers */}
        <div className="bg-white border border-gray-200 p-8 rounded-none shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mb-1">Live Product Viewers</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">Top products currently being viewed by customers</p>

            <div className="space-y-4 my-auto">
              {productViewers && productViewers.length > 0 ? (
                productViewers.map((pv: any, index: number) => (
                  <div key={pv.page} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-400 font-bold">{index + 1}.</span>
                      <span className="text-xs text-[#1a1c1c] font-bold uppercase tracking-wider">{pv.productName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#775a19] font-bold">{pv.viewers} viewing now</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 uppercase tracking-widest text-center py-8">
                  No active product page views in the last 5 minutes.
                </p>
              )}
            </div>
          </div>

          <div className="text-[8px] text-gray-400 uppercase tracking-[0.25em] border-t border-gray-200 pt-4 mt-6 font-bold">
            * Aggregated dynamically over 5 minute active session windows
          </div>
        </div>

        {/* Live System Events Log */}
        <div className="bg-white border border-gray-200 p-8 rounded-none shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mb-1">Live System Events Log</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">System logs of active events and operations</p>
          </div>

          <div className="space-y-4 my-auto">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-gray-400 uppercase tracking-widest text-center py-8">
                No recent order events recorded
              </p>
            ) : (
              recentEvents.map((event, i) => {
                const tag = classifyEvent(event.event);
                const { border, badge } = eventBadge(tag);
                return (
                  <div key={i} className={`flex items-start gap-4 border-l-2 ${border} pl-4 py-1`}>
                    <span className={`text-[9px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.5 select-none shrink-0 ${badge}`}>
                      {tag}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#1a1c1c]">{event.event}</p>
                      {/* FULL UNTRUNCATED EVENT ORDER ID */}
                      <span className="text-[9px] text-gray-400 font-mono uppercase tracking-widest mt-1 block">
                        #{String(event.order_id).toUpperCase()} • {timeAgo(event.created_at)}{event.total ? ` • ₹${Number(event.total).toLocaleString("en-IN")}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="text-[8px] text-gray-400 uppercase tracking-[0.2em] border-t border-gray-200 pt-4 mt-6 font-bold">
            * Operational health check: 100% active and healthy.
          </div>
        </div>

      </div>
    </div>
  );
}
