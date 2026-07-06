"use client";

import React, { useState, useEffect } from "react";
import { getMarketingAnalyticsAction } from "@/app/actions/admin-analytics";
import { VercelPlaceholderBanner } from "@/components/analytics/VercelPlaceholderBanner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#fed488", "#5ab9ea", "#8862cf", "#56e39f", "#f0788a"];

export default function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function load() {
      const res = await getMarketingAnalyticsAction();
      if (res.success) {
        setData(res);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="size-8 rounded-full border-2 border-white/20 border-t-[#fed488] animate-spin"></div>
      </div>
    );
  }

  const utmSources = data?.utmSources || [];
  const campaigns = data?.campaigns || [];
  const totalUtmOrders = utmSources.reduce((sum: number, item: any) => sum + (item.value || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto text-white font-body">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#fed488]">Marketing Insights</span>
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight mt-1 text-white">Campaign & Traffic Analytics</h1>
          <p className="text-[11px] text-white/50 mt-1 uppercase tracking-wider">Audit customer referral channels, UTM sources, and campaigns</p>
        </div>
      </div>

      {/* Vercel warning alert banner */}
      <VercelPlaceholderBanner />

      {/* Grid Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Card: Sources Doughnut Chart */}
        <div className="lg:col-span-2 bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Traffic Referral Channels</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Distribution of orders placed with UTM parameters</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-1/2 h-64 flex items-center justify-center">
              {mounted && utmSources.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={utmSources}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {utmSources.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#171717",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "0px",
                        color: "#fff",
                        fontFamily: "monospace",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-white/40 uppercase tracking-widest">No UTM order traffic recorded</p>
              )}
            </div>

            <div className="w-full md:w-1/2 space-y-4">
              {utmSources.map((item: any, index: number) => {
                const percentage = totalUtmOrders > 0 ? Math.round((item.value / totalUtmOrders) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-white/80">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-white">{item.value} Orders</span>
                      <span className="text-[10px] text-white/40 font-mono ml-2">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Card: Performance Metrics Summary */}
        <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Campaign Statistics</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Aggregate campaign conversion data</p>
          </div>

          <div className="space-y-6 my-auto">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Total UTM Referrals</span>
              <span className="text-4xl font-black font-headline text-white mt-1 block">{totalUtmOrders}</span>
              <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Orders with referral variables</p>
            </div>

            <div className="h-px bg-white/10"></div>

            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Active Campaigns</span>
              <span className="text-4xl font-black font-headline text-white mt-1 block">{campaigns.length}</span>
              <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Registered campaign identifiers</p>
            </div>
          </div>

          <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] mt-6 border-t border-white/5 pt-4">
            * Automatically recorded from sessionStorage captures.
          </div>
        </div>
      </div>

      {/* Campaigns performance ledger */}
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
        <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Campaign Conversion Ledger</h3>
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Detailed ledger breakdown of sales segmented by campaign parameters</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/15">
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Campaign Name</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Source</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Medium</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Orders Placed</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaigns.length > 0 ? (
                campaigns.map((camp: any) => (
                  <tr key={`${camp.name}-${camp.source}`}>
                    <td className="py-4 text-xs font-black font-mono text-white uppercase tracking-wider">{camp.name}</td>
                    <td className="py-4 text-xs uppercase text-white/60 tracking-wider">{camp.source}</td>
                    <td className="py-4 text-xs uppercase text-white/60 tracking-wider">{camp.medium}</td>
                    <td className="py-4 text-xs font-bold font-mono text-white text-right">{camp.orders}</td>
                    <td className="py-4 text-xs font-bold font-mono text-[#fed488] text-right">₹{camp.revenue.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-white/30 uppercase tracking-widest">
                    No active campaign referral data captured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
