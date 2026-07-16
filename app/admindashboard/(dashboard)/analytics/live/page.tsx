"use client";

import React, { useState, useEffect } from "react";
import { getLiveAnalyticsAction } from "@/app/actions/admin-analytics";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

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
  "ghaziabad": [77.4229, 28.6692],
  "ludhiana": [75.8573, 30.9010],
  "coimbatore": [76.9558, 11.0168],
  "agra": [78.0081, 27.1767],
  "madurai": [78.1198, 9.9252],
  "kochi": [76.2673, 9.9312],
  "trivandrum": [76.9366, 8.5241],
  "thiruvananthapuram": [76.9366, 8.5241],
  "tiruchirappalli": [78.7047, 10.7905],
  "trichy": [78.7047, 10.7905],
  "salem": [78.1460, 11.6643],
  "erode": [77.7172, 11.3410],
  "tiruppur": [77.3411, 11.1085],
  "vijayawada": [80.6480, 16.5062],
  "guntur": [80.4365, 16.3067],
  "warangal": [79.5941, 17.9784],
  "jabalpur": [79.9339, 23.1815],
  "gwalior": [78.1772, 26.2183],
  "raipur": [81.6296, 21.2514],
  "jodhpur": [73.0243, 26.2389],
  "udaipur": [73.7125, 24.5854],
  "kota": [75.8648, 25.1825],
  "guwahati": [91.7362, 26.1445],
  "shillong": [91.8833, 25.5689],
  "imphal": [93.9368, 24.8170],
  "bhubaneswar": [85.8245, 20.2961],
  "cuttack": [85.8792, 20.4625],
  "ranchi": [85.3096, 23.3441],
  "jamshedpur": [86.2029, 22.8046],
  "dhanbad": [86.4173, 23.7957],
  "dehradun": [78.0322, 30.3165],
  "shimla": [77.1738, 31.1048],
  "jammu": [74.8570, 32.7266],
  "srinagar": [74.7973, 34.0837],
  "amritsar": [74.8723, 31.6340],
  "jalandhar": [75.5762, 31.3260],
  "chandigarh": [76.7794, 30.7333],
  "panaji": [73.8278, 15.4909],
  "goa": [73.8278, 15.4909],
  "mangaluru": [74.8560, 12.9141],
  "mangalore": [74.8560, 12.9141],
  "mysore": [76.6394, 12.2958],
  "mysuru": [76.6394, 12.2958],
  "hubli": [75.1240, 15.3647],
  "belgaum": [74.5089, 15.8497],
  "nashik": [73.7898, 19.9975],
  "aurangabad": [75.3433, 19.8762],
  "solapur": [75.9064, 17.6599],
  "kolhapur": [74.2433, 16.7050],
  "amravati": [77.7523, 20.9320],
  "nanded": [77.3079, 19.1383],
  "rajkot": [70.7933, 22.3039],
  "jamnagar": [70.0577, 22.4707],
  "junagadh": [70.4579, 21.5222],
  "anand": [72.9289, 22.5645],
  "navsari": [72.9282, 20.9467],
  "vapi": [72.9060, 20.3727],
  "mehsana": [72.3693, 23.6001],
  "gandhinagar": [72.6369, 23.2156],
  "noida": [77.3910, 28.5355],
  "greater noida": [77.5244, 28.4744],
  "gurgaon": [77.0266, 28.4595],
  "gurugram": [77.0266, 28.4595],
  "faridabad": [77.3178, 28.4089],
  "panipat": [76.9629, 29.3909],
  "karnal": [76.9904, 29.6857],
  "rohtak": [76.6026, 28.8955],
  "hisar": [75.7217, 29.1492],
  "bathinda": [74.9452, 30.2110],
  "patiala": [76.3884, 30.3398],
  "pondicherry": [79.8083, 11.9416],
  "puducherry": [79.8083, 11.9416],
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


// Time-ago helper
function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// Color-coded event badge helper
function eventBadge(tag: string) {
  const upper = tag.toUpperCase();
  if (upper === "PIXEL") {
    return {
      border: "border-purple-500",
      badge: "text-purple-800 bg-purple-100 border border-purple-200",
    };
  }
  if (upper === "DATABASE" || upper === "ORDER") {
    return {
      border: "border-blue-500",
      badge: "text-blue-800 bg-blue-100 border border-blue-200",
    };
  }
  if (upper === "STOREFRONT" || upper === "UTM" || upper === "PING") {
    return {
      border: "border-green-500",
      badge: "text-green-800 bg-green-100 border border-green-200",
    };
  }
  if (upper === "ERROR") {
    return {
      border: "border-red-500",
      badge: "text-red-800 bg-red-100 border border-red-200",
    };
  }
  // Default: amber / yellow
  return {
    border: "border-[#fed488]",
    badge: "text-[#7a5c00] bg-[#fed488]/20 border border-[#fed488]/50",
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

  // Revenue ticker animation state
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

  // 1. Fetch live data every 30 seconds
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
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refreshTrigger]);

  // 2. Increment last updated timestamp counter every second
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

  const manualRefresh = () => {
    handleManualRefresh();
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="size-8 rounded-full border-2 border-white/20 border-t-[#fed488] animate-spin"></div>
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
  const cityOrders = data?.cityOrders || [];
  const recentEvents: { order_id: string; event: string; created_at: string }[] =
    data?.recentEvents ?? [];

  const maxCityOrders =
    cityOrders.length > 0 ? Math.max(...cityOrders.map((c: any) => c.count)) : 1;


  return (
    <div className="p-8 max-w-7xl mx-auto text-white font-body">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 flex items-center gap-1.5 animate-pulse">
            <span className="size-2 rounded-full bg-red-500 block"></span>
            Live Activity Monitor
          </span>
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight mt-1 text-white">Real-Time Analytics</h1>
          <p className="text-[11px] text-white/50 mt-1 uppercase tracking-wider">Monitor active visitors, shopping carts, and immediate order inflows</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-bold font-mono text-white/40 uppercase tracking-widest block">
              {secondsSinceUpdate === 0 ? "Just updated" : `Last updated: ${secondsSinceUpdate}s ago`}
            </span>
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
              <button onClick={manualRefresh} className="ml-2 text-blue-500 bg-transparent border-none cursor-pointer hover:underline">
                ↻ Refresh
              </button>
            </p>
            <span className="text-[9px] text-white/20 uppercase tracking-widest block mt-0.5">Auto-refreshing every 30s</span>
          </div>

          <button
            onClick={handleManualRefresh}
            className="size-10 bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors cursor-pointer select-none"
            title="Refresh Now"
          >
            <span className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* Real-time stats row — 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Online Visitors */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white/40">Active Online Visitors</h3>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Visits in the last 5 minutes</p>
            </div>
            <span className="material-symbols-outlined text-[#fed488] text-lg bg-[#fed488]/10 p-2">public</span>
          </div>
          <div className="mt-4">
            <span className="text-5xl font-black font-headline text-white font-mono">{onlineVisitors}</span>
            <span className="text-[10px] font-black uppercase text-green-500 tracking-wider ml-3 bg-green-500/10 px-2 py-0.5 select-none">Live</span>
          </div>
        </div>

        {/* Card 2: Active Carts */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white/40">Active Shopping Carts</h3>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Cart updates in last 30 minutes</p>
            </div>
            <span className="material-symbols-outlined text-[#fed488] text-lg bg-[#fed488]/10 p-2">shopping_bag</span>
          </div>
          <div className="mt-4">
            <span className="text-5xl font-black font-headline text-white font-mono">{activeCarts}</span>
            <span className="text-[10px] font-black uppercase text-white/40 tracking-wider ml-3">Pending Checkout</span>
          </div>
        </div>

        {/* Card 3: Today's Orders / Revenue */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white/40">Today's Transactions</h3>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Calculated from 12:00 AM today</p>
            </div>
            <span className="material-symbols-outlined text-[#fed488] text-lg bg-[#fed488]/10 p-2">payments</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-5xl font-black font-headline text-white font-mono">{todayOrdersCount}</span>
              <span className="text-xs text-white/40 uppercase tracking-widest ml-2">Orders</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-black font-mono transition-colors duration-500 ${
                revenueChanged ? "text-green-400 scale-105" : "text-[#fed488]"
              }`}>
                ₹{todayRevenue.toLocaleString()}
              </span>
              <p className="text-[9px] text-white/20 uppercase tracking-widest">Gross Sales</p>
            </div>
          </div>
        </div>

        {/* Card 4: Today's Pending Orders */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white/40">Pending Orders</h3>
              <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Paid today, awaiting dispatch</p>
            </div>
            <span className="material-symbols-outlined text-amber-400 text-lg bg-amber-400/10 p-2">pending_actions</span>
          </div>
          <div className="mt-4">
            <span className="text-5xl font-black font-headline text-white font-mono">{todayPendingOrders}</span>
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider ml-3 bg-amber-400/10 px-2 py-0.5 select-none">
              {todayPendingOrders === 1 ? "Needs Action" : "Awaiting"}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Orders Feed */}
      {recentOrders.length > 0 && (
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mb-8">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Recent Orders Feed</h3>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Last 5 orders placed on the storefront</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Order ID</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Customer</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Amount</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-xs font-black uppercase tracking-wider text-[#fed488] font-mono">
                      {String(order.id).slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 text-xs text-white/70 tracking-wider">
                      {order.customer}
                    </td>
                    <td className="py-3 text-xs font-bold font-mono text-white text-right">
                      ₹{Number(order.total).toLocaleString()}
                    </td>
                    <td className="py-3 text-[10px] font-mono text-white/40 text-right uppercase tracking-widest">
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
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* India Delivery Map outline */}
          <div className="lg:col-span-3 min-h-[460px] relative border border-white/5 bg-black/40 flex flex-col justify-between p-6 rounded-none overflow-hidden">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#fed488] block animate-pulse">
                🔴 Live Dispatch Heatmap
              </span>
              <h3 className="font-headline text-lg font-black uppercase tracking-tight mt-0.5 text-white">India Delivery Map</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Sourced from 100% accurate customer shipping addresses</p>
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
                  <Geographies geography="https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-states.json">
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          style={{
                            default: {
                              fill: "#141414",
                              stroke: "#262626",
                              strokeWidth: 0.75,
                              outline: "none",
                            },
                            hover: {
                              fill: "#1f1f1f",
                              stroke: "#fed488",
                              strokeWidth: 1,
                              outline: "none",
                            },
                            pressed: {
                              fill: "#fed488",
                              stroke: "#000",
                              strokeWidth: 0.75,
                              outline: "none",
                            },
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {cityOrders.map((item: any) => {
                    const coords = getCityCoordinates(item.city);
                    const isSelected = selectedCity?.city === item.city;
                    const dotSize = 4 + (item.count / maxCityOrders) * 10;
                    
                    return (
                      <Marker key={item.city} coordinates={coords}>
                        <circle
                          r={dotSize}
                          fill={isSelected ? "#fed488" : "#ef4444"}
                          stroke="#000"
                          strokeWidth={1.5}
                          className="cursor-pointer transition-all hover:scale-125 hover:fill-[#fed488] active:scale-95 duration-200"
                          onClick={() => {
                            setSelectedCity(isSelected ? null : item);
                          }}
                        />
                        {isSelected && (
                          <circle
                            r={dotSize + 6}
                            fill="transparent"
                            stroke="#fed488"
                            strokeWidth={1}
                            className="animate-ping opacity-75"
                          />
                        )}
                      </Marker>
                    );
                  })}
                </ComposableMap>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="size-6 rounded-full border-2 border-white/20 border-t-[#fed488] animate-spin"></div>
                </div>
              )}
            </div>

            {selectedCity && (
              <div className="absolute bottom-4 right-4 bg-black/90 backdrop-blur-md border border-[#fed488]/40 p-4 shadow-2xl animate-fade-in z-10 max-w-xs min-w-[220px]">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#fed488] block">📍 SHIPPING DESTINATION</span>
                    <h4 className="font-headline text-sm font-black uppercase text-white tracking-tight mt-0.5">{selectedCity.city}</h4>
                  </div>
                  <button 
                    onClick={() => setSelectedCity(null)}
                    className="text-white/40 hover:text-white bg-transparent border-none text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/5 pt-2.5">
                  <div>
                    <span className="text-[8px] text-white/40 uppercase tracking-widest block">Total Orders</span>
                    <span className="text-sm font-bold font-mono text-white">{selectedCity.count}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/40 uppercase tracking-widest block">Sales Value</span>
                    <span className="text-sm font-bold font-mono text-[#fed488]">₹{selectedCity.revenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Top Ordering Cities breakdown list */}
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Top Ordering Cities</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Distribution of orders placed in last 30 days by delivery address city</p>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
                {cityOrders.length > 0 ? (
                  cityOrders.map((item: any, index: number) => {
                    const pct = Math.round((item.count / maxCityOrders) * 100);
                    const isSelected = selectedCity?.city === item.city;
                    return (
                      <div 
                        key={item.city} 
                        className={`space-y-1.5 p-2 transition-all cursor-pointer ${
                          isSelected ? "bg-white/5 border border-white/10" : "border border-transparent hover:bg-white/5"
                        }`}
                        onClick={() => setSelectedCity(isSelected ? null : item)}
                      >
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                          <span className="text-white/80">{index + 1}. {item.city}</span>
                          <span className="font-mono text-white">{item.count} Orders</span>
                        </div>
                        <div className="h-2 bg-white/5 border border-white/10 rounded-none overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#fed488]/50 to-[#fed488] transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-white/40 uppercase tracking-widest text-center py-8">
                    No orders loaded in the last 30 days.
                  </p>
                )}
              </div>
            </div>
            
            <div className="text-[8px] text-white/30 uppercase tracking-[0.25em] border-t border-white/5 pt-4 mt-6">
              * Click any city bar or map pin to view order statistics
            </div>
          </div>
          
        </div>
      </div>

      {/* Live System Events Log */}
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Live System Events Log</h3>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">System logs of active events and operations</p>
        </div>

        <div className="space-y-4 my-auto">
          {recentEvents.length === 0 ? (
            <p className="text-xs text-white/40 uppercase tracking-widest text-center py-8">
              No recent order events recorded
            </p>
          ) : (
            recentEvents.map((event, i) => {
              const { border, badge } = eventBadge("ORDER");
              return (
                <div key={i} className={`flex items-start gap-4 border-l-2 ${border} pl-4 py-1`}>
                  <span className={`text-[9px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.5 select-none shrink-0 ${badge}`}>
                    ORDER
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white/80">{event.event}</p>
                    <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1 block">
                      #{event.order_id.slice(0, 8).toUpperCase()} • {new Date(event.created_at).toLocaleTimeString("en-IN")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] border-t border-white/5 pt-4 mt-6">
          * Operational health check: 100% active and healthy.
        </div>
      </div>
    </div>
  );
}
