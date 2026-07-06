"use client";

import React, { useState, useEffect } from "react";
import { getMarketingAnalyticsAction, saveAdSpendAction } from "@/app/actions/admin-analytics";
import { VercelPlaceholderBanner } from "@/components/analytics/VercelPlaceholderBanner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#fed488", "#5ab9ea", "#8862cf", "#56e39f", "#f0788a"];

export default function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [channel, setChannel] = useState("google_ads");
  const [month, setMonth] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleAddSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month || !spendAmount) return;
    setSubmitting(true);
    const res = await saveAdSpendAction({
      channel,
      month,
      spendAmount: Number(spendAmount),
      campaignName: campaignName || undefined,
      notes: notes || undefined,
    });
    if (res.success) {
      const updated = await getMarketingAnalyticsAction();
      if (updated.success) {
        setData(updated);
      }
      setShowAddForm(false);
      setSpendAmount("");
      setCampaignName("");
      setNotes("");
    } else {
      alert(res.error || "Failed to save ad spend");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="size-8 rounded-full border-2 border-white/20 border-t-[#fed488] animate-spin"></div>
      </div>
    );
  }

  const utmSources = data?.utmSources || [];
  const campaigns = data?.campaigns || [];
  const adSpend = data?.adSpend || [];
  const roasReport = data?.roasReport || [];
  const totalUtmOrders = utmSources.reduce((sum: number, item: any) => sum + (item.value || 0), 0);

  // Aggregate ROAS Calculations for KPI cards
  const googleRecords = roasReport.filter((r: any) => r.channel === "google_ads");
  const googleSpend = googleRecords.reduce((sum: number, r: any) => sum + r.spend, 0);
  const googleRevenue = googleRecords.reduce((sum: number, r: any) => sum + r.revenue, 0);
  const googleRoas = googleSpend > 0 ? Number((googleRevenue / googleSpend).toFixed(2)) : 0;

  const metaRecords = roasReport.filter((r: any) => r.channel === "meta_ads");
  const metaSpend = metaRecords.reduce((sum: number, r: any) => sum + r.spend, 0);
  const metaRevenue = metaRecords.reduce((sum: number, r: any) => sum + r.revenue, 0);
  const metaRoas = metaSpend > 0 ? Number((metaRevenue / metaSpend).toFixed(2)) : 0;

  const getRoasColor = (val: number) => {
    if (val >= 4) return "text-green-500 border-green-500/20";
    if (val >= 2) return "text-yellow-500 border-yellow-500/20";
    if (val >= 1) return "text-orange-500 border-orange-500/20";
    return "text-red-500 border-red-500/20";
  };

  const formatChannel = (ch: string) => {
    if (ch === "google_ads") return "Google Ads";
    if (ch === "meta_ads") return "Meta Ads";
    if (ch === "instagram") return "Instagram";
    return "Other";
  };

  const formatMonth = (mStr: string) => {
    if (!mStr) return "";
    const parts = mStr.split("-");
    if (parts.length < 2) return mStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

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

      {/* ROAS KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Card 1: Google Ads ROAS */}
        <div
          className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-36 cursor-help"
          title="Industry benchmark for fashion D2C: 3-4x"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white/40">Google Ads ROAS</h3>
            {googleSpend > 0 ? (
              <div className="mt-2">
                <p className={`text-3xl font-headline font-black ${getRoasColor(googleRoas)}`}>
                  {googleRoas.toFixed(1)}x
                </p>
                <p className="text-[10px] text-white/60 font-mono mt-1">
                  ₹{googleSpend.toLocaleString()} spend &rarr; ₹{googleRevenue.toLocaleString()} revenue
                </p>
              </div>
            ) : (
              <p className="text-sm font-black text-white/30 uppercase mt-4">No data yet</p>
            )}
          </div>
          <span className="text-[8px] uppercase tracking-wider text-white/30 font-black block">
            Benchmark: 3-4x (Hover for info)
          </span>
        </div>

        {/* Card 2: Meta Ads ROAS */}
        <div
          className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none relative overflow-hidden flex flex-col justify-between h-36 cursor-help"
          title="Industry benchmark for fashion D2C: 3-4x"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white/40">Meta Ads ROAS</h3>
            {metaSpend > 0 ? (
              <div className="mt-2">
                <p className={`text-3xl font-headline font-black ${getRoasColor(metaRoas)}`}>
                  {metaRoas.toFixed(1)}x
                </p>
                <p className="text-[10px] text-white/60 font-mono mt-1">
                  ₹{metaSpend.toLocaleString()} spend &rarr; ₹{metaRevenue.toLocaleString()} revenue
                </p>
              </div>
            ) : (
              <p className="text-sm font-black text-white/30 uppercase mt-4">No data yet</p>
            )}
          </div>
          <span className="text-[8px] uppercase tracking-wider text-white/30 font-black block">
            Benchmark: 3-4x (Hover for info)
          </span>
        </div>
      </div>

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
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mb-8">
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

      {/* MONTHLY AD SPEND & ROAS */}
      <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Monthly Ad Spend & ROAS Ledger</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Attributed revenue and return on ad spend per channel</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-[#fed488] text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-[#e0bb70] transition-colors border-none cursor-pointer"
          >
            {showAddForm ? "Close Logger" : "+ Log Ad Spend"}
          </button>
        </div>

        {/* Inline Logger Form */}
        {showAddForm && (
          <form onSubmit={handleAddSpend} className="bg-[#121212] border border-white/10 p-6 mb-8 space-y-4 max-w-xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Log Ad Spend</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Ad Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 p-2 text-xs text-white uppercase font-bold focus:outline-none"
                >
                  <option value="google_ads">Google Ads</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="instagram">Instagram</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Target Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  className="w-full bg-[#1a1a1a] border border-white/10 p-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Spend Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  placeholder="e.g. 12000"
                  className="w-full bg-[#1a1a1a] border border-white/10 p-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Campaign Name (Optional)</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. summer_sale"
                  className="w-full bg-[#1a1a1a] border border-white/10 p-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log campaign keyword target details..."
                rows={2}
                className="w-full bg-[#1a1a1a] border border-white/10 p-2 text-xs text-white focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#fed488] text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-[#e0bb70] transition-colors border-none cursor-pointer"
              >
                {submitting ? "Saving..." : "Save Log"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/15">
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Channel</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Month</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Spend</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Revenue</th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {roasReport.length > 0 ? (
                roasReport.map((row: any, index: number) => (
                  <tr key={`${row.channel}-${row.month}-${index}`}>
                    <td className="py-4 text-xs font-black uppercase tracking-wider text-white">{formatChannel(row.channel)}</td>
                    <td className="py-4 text-xs font-bold text-white/60 tracking-wider font-mono">{formatMonth(row.month)}</td>
                    <td className="py-4 text-xs font-bold font-mono text-white text-right">₹{row.spend.toLocaleString()}</td>
                    <td className="py-4 text-xs font-bold font-mono text-white text-right">₹{row.revenue.toLocaleString()}</td>
                    <td className="py-4 text-right">
                      <span className={`text-xs font-black font-mono tracking-wider ${getRoasColor(row.roas)}`}>
                        {row.roasFormatted}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-white/30 uppercase tracking-widest">
                    No marketing ad spend logs available.
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
