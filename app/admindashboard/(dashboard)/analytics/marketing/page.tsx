"use client";

import React, { useState, useEffect } from "react";
import { getMarketingAnalyticsAction, saveAdSpendAction } from "@/app/actions/admin-analytics";
import { VercelPlaceholderBanner } from "@/components/analytics/VercelPlaceholderBanner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ef4444"];

// FIX 4 — ROAS display helpers
const roasDisplay = (roas: number): string => {
  if (roas === 0) return "—";
  return roas.toFixed(1) + "x";
};

const roasColor = (roas: number): string => {
  if (roas === 0) return "text-zinc-500";
  if (roas < 1) return "text-red-600";
  if (roas < 3) return "text-amber-600";
  return "text-green-600";
};

// Map form platform value → database channel value
const platformToChannel = (platform: string): string => {
  if (platform === "meta") return "meta_ads";
  if (platform === "google") return "google_ads";
  return "other";
};

export default function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Form State — FIX 2
  const [showAddForm, setShowAddForm] = useState(false);
  const [platform, setPlatform] = useState("google");
  const [period, setPeriod] = useState("");
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
    if (!period || !spendAmount) return;
    setSubmitting(true);
    const res = await saveAdSpendAction({
      channel: platformToChannel(platform),
      month: period,
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
        <div className="size-8 rounded-full border-2 border-gray-200 border-t-indigo-500 animate-spin"></div>
      </div>
    );
  }

  const utmSources = data?.utmSources || [];
  const campaigns = data?.campaigns || [];
  const roasReport = data?.roasReport || [];
  const totalUtmOrders = utmSources.reduce(
    (sum: number, item: any) => sum + (item.value || 0),
    0
  );

  // Aggregate ROAS KPI Calculations
  const googleRecords = roasReport.filter(
    (r: any) => r.channel === "google_ads"
  );
  const googleSpend = googleRecords.reduce(
    (sum: number, r: any) => sum + r.spend,
    0
  );
  const googleRevenue = googleRecords.reduce(
    (sum: number, r: any) => sum + r.revenue,
    0
  );
  const googleRoas =
    googleSpend > 0
      ? Number((googleRevenue / googleSpend).toFixed(2))
      : 0;

  const metaRecords = roasReport.filter(
    (r: any) => r.channel === "meta_ads"
  );
  const metaSpend = metaRecords.reduce(
    (sum: number, r: any) => sum + r.spend,
    0
  );
  const metaRevenue = metaRecords.reduce(
    (sum: number, r: any) => sum + r.revenue,
    0
  );
  const metaRoas =
    metaSpend > 0 ? Number((metaRevenue / metaSpend).toFixed(2)) : 0;

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
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  // Tooltip style matching light theme
  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    color: "#111827",
    fontFamily: "monospace",
    fontSize: "11px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-body">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">
            Marketing Insights
          </span>
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight mt-1 text-gray-900">
            Campaign &amp; Traffic Analytics
          </h1>
          <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider">
            Audit customer referral channels, UTM sources, and campaigns
          </p>
        </div>
      </div>

      {/* FIX 1 — Sandbox banner (only shows if GTM ID is missing/placeholder) */}
      <VercelPlaceholderBanner />

      {/* ROAS KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Card 1: Google Ads ROAS */}
        <div
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 relative overflow-hidden flex flex-col justify-between h-36 cursor-help"
          title="Industry benchmark for fashion D2C: 3-4x"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Google Ads ROAS
            </h3>
            <div className="mt-2">
              <p
                className={`text-3xl font-headline font-black ${roasColor(googleRoas)}`}
              >
                {roasDisplay(googleRoas)}
              </p>
              {googleSpend > 0 && (
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  ₹{googleSpend.toLocaleString()} spend →{" "}
                  ₹{googleRevenue.toLocaleString()} revenue
                </p>
              )}
              {googleSpend === 0 && (
                <p className="text-xs text-zinc-500 uppercase mt-1">
                  No spend logged yet
                </p>
              )}
            </div>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-black block">
            Benchmark: 3-4x (Hover for info)
          </span>
        </div>

        {/* Card 2: Meta Ads ROAS */}
        <div
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 relative overflow-hidden flex flex-col justify-between h-36 cursor-help"
          title="Industry benchmark for fashion D2C: 3-4x"
        >
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Meta Ads ROAS
            </h3>
            <div className="mt-2">
              <p
                className={`text-3xl font-headline font-black ${roasColor(metaRoas)}`}
              >
                {roasDisplay(metaRoas)}
              </p>
              {metaSpend > 0 && (
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  ₹{metaSpend.toLocaleString()} spend →{" "}
                  ₹{metaRevenue.toLocaleString()} revenue
                </p>
              )}
              {metaSpend === 0 && (
                <p className="text-xs text-zinc-500 uppercase mt-1">
                  No spend logged yet
                </p>
              )}
            </div>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-black block">
            Benchmark: 3-4x (Hover for info)
          </span>
        </div>
      </div>

      {/* Grid Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Card: Sources Doughnut Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-1 text-gray-900">
              Traffic Referral Channels
            </h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-6">
              Distribution of orders placed with UTM parameters
            </p>
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
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-zinc-500 uppercase tracking-widest">
                  No UTM order traffic recorded
                </p>
              )}
            </div>

            <div className="w-full md:w-1/2 space-y-4">
              {utmSources.map((item: any, index: number) => {
                const percentage =
                  totalUtmOrders > 0
                    ? Math.round((item.value / totalUtmOrders) * 100)
                    : 0;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between border-b border-gray-100 pb-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      ></span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-gray-900">
                        {item.value} Orders
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono ml-2">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Card: Performance Metrics Summary */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-1 text-gray-900">
              Campaign Statistics
            </h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-6">
              Aggregate campaign conversion data
            </p>
          </div>

          <div className="space-y-6 my-auto">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
                Total UTM Referrals
              </span>
              <span className="text-4xl font-black font-headline text-gray-900 mt-1 block">
                {totalUtmOrders}
              </span>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">
                Orders with referral variables
              </p>
            </div>

            <div className="h-px bg-gray-100"></div>

            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
                Active Campaigns
              </span>
              <span className="text-4xl font-black font-headline text-gray-900 mt-1 block">
                {campaigns.length}
              </span>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">
                Registered campaign identifiers
              </p>
            </div>
          </div>

          <div className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] mt-6 border-t border-gray-100 pt-4">
            * Automatically recorded from sessionStorage captures.
          </div>
        </div>
      </div>

      {/* Campaigns performance ledger */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
        <h3 className="text-xs font-black uppercase tracking-wider mb-1 text-gray-900">
          Campaign Conversion Ledger
        </h3>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-6">
          Detailed ledger breakdown of sales segmented by campaign parameters
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Campaign Name
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Source
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Medium
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">
                  Orders Placed
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">
                  Net Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.length > 0 ? (
                campaigns.map((camp: any) => (
                  <tr key={`${camp.name}-${camp.source}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-xs font-black uppercase tracking-wider text-gray-900">
                      {camp.name}
                    </td>
                    <td className="py-4 text-xs uppercase text-gray-500 tracking-wider">
                      {camp.source}
                    </td>
                    <td className="py-4 text-xs uppercase text-gray-500 tracking-wider">
                      {camp.medium}
                    </td>
                    <td className="py-4 text-xs font-bold font-mono text-gray-900 text-right">
                      {camp.orders}
                    </td>
                    <td className="py-4 text-xs font-bold font-mono text-indigo-600 text-right">
                      ₹{camp.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-xs text-zinc-500 uppercase tracking-widest"
                  >
                    No active campaign referral data captured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY AD SPEND & ROAS */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider mb-1 text-gray-900">
              Monthly Ad Spend &amp; ROAS Ledger
            </h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Attributed revenue and return on ad spend per channel
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors border-none cursor-pointer rounded-lg"
          >
            {showAddForm ? "Close Logger" : "+ Log Ad Spend"}
          </button>
        </div>

        {/* Inline Logger Form — FIX 2 */}
        {showAddForm && (
          <form
            onSubmit={handleAddSpend}
            className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 space-y-4 max-w-xl"
          >
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">
              Log Ad Spend
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FIX 2 — Platform dropdown */}
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                  Ad Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="meta">Meta Ads (Facebook/Instagram)</option>
                  <option value="google">Google Ads</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* FIX 2 — Month input with proper type="month" */}
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                  Target Month
                </label>
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="2026-07"
                  required
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                  Spend Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  placeholder="e.g. 12000"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                  Campaign Name (Optional)
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. summer_sale"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log campaign keyword target details..."
                rows={2}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors border-none cursor-pointer rounded-lg disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Log"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 bg-white text-gray-700 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Channel
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Month
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">
                  Spend
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">
                  Revenue
                </th>
                <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">
                  ROAS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roasReport.length > 0 ? (
                roasReport.map((row: any, index: number) => (
                  <tr key={`${row.channel}-${row.month}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-xs font-black uppercase tracking-wider text-gray-900">
                      {formatChannel(row.channel)}
                    </td>
                    <td className="py-4 text-xs font-bold text-gray-500 tracking-wider font-mono">
                      {formatMonth(row.month)}
                    </td>
                    <td className="py-4 text-xs font-bold font-mono text-gray-900 text-right">
                      ₹{row.spend.toLocaleString()}
                    </td>
                    <td className="py-4 text-xs font-bold font-mono text-gray-900 text-right">
                      ₹{row.revenue.toLocaleString()}
                    </td>
                    {/* FIX 4 — ROAS display */}
                    <td className="py-4 text-right">
                      <span
                        className={`text-xs font-black font-mono tracking-wider ${roasColor(row.roas ?? 0)}`}
                      >
                        {roasDisplay(row.roas ?? 0)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-xs text-zinc-500 uppercase tracking-widest"
                  >
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
