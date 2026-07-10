"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBestSellersAction } from "@/app/actions/admin-reads";

export default function BestSellersPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "all">("30d");
  const [sortBy, setSortBy] = useState<"units" | "revenue">("units");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    const res = await getBestSellersAction(dateRange);
    if (res.success) {
      setData(res.data || []);
    } else {
      setError(res.error || "Failed to load best sellers");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Listen for storage events for local data updates
    const handleStorage = () => {
      loadData();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [dateRange]);

  // Sort logic on the client side based on toggle
  const sortedData = [...data].sort((a, b) => {
    if (sortBy === "revenue") {
      return b.revenue - a.revenue;
    }
    return b.unitsSold - a.unitsSold;
  });

  return (
    <div className="p-8 lg:p-16">
      {/* Header section */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Best Sellers Report</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Best Sellers</h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            Insights on your top-performing products by units sold and revenue.
          </p>
        </div>
      </header>

      {/* Controls Container */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6 mb-10 bg-white border border-gray-200 p-6 shadow-sm">
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-2">Range:</span>
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer border ${
                dateRange === r
                  ? "bg-primary text-white border-primary"
                  : "bg-transparent text-gray-500 border-gray-200 hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
              }`}
            >
              {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : "All Time"}
            </button>
          ))}
        </div>

        {/* Sort Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-2">Sort By:</span>
          {(["units", "revenue"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer border ${
                sortBy === s
                  ? "bg-secondary text-white border-secondary"
                  : "bg-transparent text-gray-500 border-gray-200 hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
              }`}
            >
              {s === "units" ? "Units Sold" : "Revenue"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
        {loading ? (
          <div className="p-16 text-center text-xs text-gray-400 italic">
            Calculating sales aggregation metrics...
          </div>
        ) : error ? (
          <div className="p-16 text-center text-xs text-red-500 font-bold uppercase tracking-wider">
            {error}
          </div>
        ) : sortedData.length === 0 ? (
          <div className="p-16 text-center text-xs text-gray-400 italic">
            No product sales found in this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-[#fafafa]">
                  <th className="px-8 py-5 text-center w-16">Rank</th>
                  <th className="px-8 py-5 w-24">Image</th>
                  <th className="px-8 py-5">Product Title</th>
                  <th className="px-8 py-5 text-right w-36">Units Sold</th>
                  <th className="px-8 py-5 text-right w-44">Revenue</th>
                  <th className="px-8 py-5 text-center w-36">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedData.map((item, idx) => {
                  const rank = idx + 1;
                  const stockStyle =
                    item.stockStatus === "Out of Stock"
                      ? "text-red-600 bg-red-50 border-red-200"
                      : item.stockStatus === "Low Stock"
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-green-700 bg-green-50 border-green-200";

                  return (
                    <tr
                      key={item.productId}
                      onClick={() => router.push(`/admindashboard/add-product?id=${item.productId}`)}
                      className="group hover:bg-[#fcfcfc] transition-colors cursor-pointer"
                    >
                      <td className="px-8 py-6 text-center text-xs font-black text-gray-400 group-hover:text-primary transition-colors">
                        #{rank}
                      </td>
                      <td className="px-8 py-6">
                        <div className="size-14 bg-gray-50 border border-gray-200 p-0.5 rounded-none flex items-center justify-center grayscale overflow-hidden group-hover:grayscale-0 transition-all">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.image} className="w-full h-full object-cover" alt={item.title} />
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase tracking-tight text-primary group-hover:text-secondary transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            ID: {item.productId}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-headline font-black text-sm text-[#0a0a0a]">
                        {item.unitsSold.toLocaleString("en-IN")}
                      </td>
                      <td className="px-8 py-6 text-right font-headline font-black text-sm text-[#0a0a0a]">
                        ₹{item.revenue.toLocaleString("en-IN")}.00
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-none border ${stockStyle}`}>
                          {item.stockStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
