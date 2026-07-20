"use client";

import React, { useState, useEffect } from "react";
import { getMarketingAnalyticsAction, saveAdSpendAction } from "@/app/actions/admin-analytics";
import { VercelPlaceholderBanner } from "@/components/analytics/VercelPlaceholderBanner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

const COLORS = ["#775a19", "#1a1c1c", "#927023", "#42300b", "#6b7280"];

const roasDisplay = (roas: number): string => {
  if (roas === 0) return "—";
  return roas.toFixed(1) + "x";
};

const roasColor = (roas: number): string => {
  if (roas === 0) return "text-gray-400";
  if (roas < 1) return "text-red-600";
  if (roas < 3) return "text-amber-700";
  return "text-[#775a19]";
};

const platformToChannel = (platform: string): string => {
  if (platform === "meta") return "meta_ads";
  if (platform === "google") return "google_ads";
  return "other";
};

export default function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [platform, setPlatform] = useState("google");
  const [period, setPeriod] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getMarketingAnalyticsAction(selectedYear, selectedMonth);
      if (res.success) {
        setData(res);
      }
      setLoading(false);
    }
    load();
  }, [selectedMonth, selectedYear]);

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
      const updated = await getMarketingAnalyticsAction(selectedYear, selectedMonth);
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

  const exportMarketingExcel = () => {
    const campaigns = data?.campaigns || [];
    const utmSources = data?.utmSources || [];
    const roasReport = data?.roasReport || [];

    const campaignRows = campaigns.map((c: any) => ({
      "Campaign Name": c.name,
      "Traffic Source": c.source,
      "Medium": c.medium,
      "Orders Placed": c.orders,
      "Net Revenue (INR)": c.revenue,
    }));

    const utmRows = utmSources.map((u: any) => ({
      "Channel Name": u.name,
      "Orders Count": u.value,
    }));

    const roasRows = roasReport.map((r: any) => ({
      "Channel": r.channel === "google_ads" ? "Google Ads" : r.channel === "meta_ads" ? "Meta Ads" : "Other",
      "Month": r.month,
      "Ad Spend (INR)": r.spend,
      "Attributed Revenue (INR)": r.revenue,
      "ROAS": r.roas ? `${r.roas}x` : "0x",
    }));

    const sheet1 = XLSX.utils.json_to_sheet(campaignRows);
    const sheet2 = XLSX.utils.json_to_sheet(utmRows);
    const sheet3 = XLSX.utils.json_to_sheet(roasRows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet1, "Campaign Ledger");
    XLSX.utils.book_append_sheet(workbook, sheet2, "UTM Traffic Channels");
    XLSX.utils.book_append_sheet(workbook, sheet3, "Ad Spend & ROAS");

    XLSX.writeFile(workbook, `Marketing_Analytics_Report_${selectedYear}_${selectedMonth}.xlsx`);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="size-8 rounded-none border-2 border-gray-200 border-t-[#775a19] animate-spin"></div>
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

  // Month-filtered ROAS KPI Calculations
  const formattedMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const currentMonthRoas = roasReport.filter((r: any) => r.month.startsWith(formattedMonthStr));
  const activeRoasSource = currentMonthRoas.length > 0 ? currentMonthRoas : roasReport;

  const googleRecords = activeRoasSource.filter(
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

  const metaRecords = activeRoasSource.filter(
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

  const tooltipStyle = {
    backgroundColor: "#1a1c1c",
    border: "1px solid #775a19",
    borderRadius: "0px",
    color: "#faf9f8",
    fontFamily: "monospace",
    fontSize: "11px",
  };

  return (
    <div className="p-8 lg:p-16 min-h-screen bg-[#faf9f8] text-[#1a1c1c] font-body">
      {/* Page Header — Atelier Noir Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-[#1a1c1c]/10 pb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">
            Atelier Noir Marketing Intelligence
          </span>
          <h1 className="font-headline text-4xl lg:text-5xl font-black uppercase tracking-tighter text-[#1a1c1c] leading-none mt-2">
            Campaign &amp; Traffic Analytics
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em] mt-2">
            Audit customer referral channels, UTM sources, ad spend, and return on ad spend (ROAS)
          </p>
        </div>

        {/* Month Selector & Export Button */}
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-white text-[10px] font-black uppercase tracking-[0.2em] text-[#1a1c1c] border border-[#1a1c1c]/15 px-4 py-3 outline-none rounded-none cursor-pointer focus:border-[#775a19]"
          >
            <option value={1}>January</option>
            <option value={2}>February</option>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
            <option value={6}>June</option>
            <option value={7}>July</option>
            <option value={8}>August</option>
            <option value={9}>September</option>
            <option value={10}>October</option>
            <option value={11}>November</option>
            <option value={12}>December</option>
          </select>

          <button
            onClick={exportMarketingExcel}
            className="px-5 py-3 bg-[#1a1c1c] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all flex items-center gap-2 border-none rounded-none cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[14px]">table_view</span>
            <span>Export Marketing Excel</span>
          </button>
        </div>
      </div>

      <VercelPlaceholderBanner />

      {/* ROAS KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Card 1: Google Ads ROAS */}
        <div
          className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none flex flex-col justify-between h-36"
          title="Industry benchmark for fashion D2C: 3-4x"
        >
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">
              Google Ads ROAS
            </h3>
            <div className="mt-2 font-mono">
              <p className={`text-3xl font-headline font-black ${roasColor(googleRoas)}`}>
                {roasDisplay(googleRoas)}
              </p>
              {googleSpend > 0 ? (
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                  ₹{googleSpend.toLocaleString()} spend → ₹{googleRevenue.toLocaleString()} revenue
                </p>
              ) : (
                <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-sans">
                  No spend logged for selected month
                </p>
              )}
            </div>
          </div>
          <span className="text-[8px] uppercase tracking-[0.2em] text-gray-400 font-bold block">
            Benchmark: 3-4x Target ROAS
          </span>
        </div>

        {/* Card 2: Meta Ads ROAS */}
        <div
          className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none flex flex-col justify-between h-36"
          title="Industry benchmark for fashion D2C: 3-4x"
        >
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">
              Meta Ads ROAS
            </h3>
            <div className="mt-2 font-mono">
              <p className={`text-3xl font-headline font-black ${roasColor(metaRoas)}`}>
                {roasDisplay(metaRoas)}
              </p>
              {metaSpend > 0 ? (
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                  ₹{metaSpend.toLocaleString()} spend → ₹{metaRevenue.toLocaleString()} revenue
                </p>
              ) : (
                <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-sans">
                  No spend logged for selected month
                </p>
              )}
            </div>
          </div>
          <span className="text-[8px] uppercase tracking-[0.2em] text-gray-400 font-bold block">
            Benchmark: 3-4x Target ROAS
          </span>
        </div>
      </div>

      {/* Grid Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Card: Sources Doughnut Chart */}
        <div className="lg:col-span-2 bg-white border border-[#1a1c1c]/10 p-8 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-1">
              Traffic Referral Channels
            </h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">
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
                <p className="text-xs text-gray-400 uppercase tracking-widest font-sans">
                  No UTM order traffic recorded for this period
                </p>
              )}
            </div>

            <div className="w-full md:w-1/2 space-y-4 font-mono">
              {utmSources.map((item: any, index: number) => {
                const percentage =
                  totalUtmOrders > 0
                    ? Math.round((item.value / totalUtmOrders) * 100)
                    : 0;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between border-b border-gray-100 pb-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-2.5 rounded-none shrink-0"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      ></span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#1a1c1c] font-sans">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#1a1c1c]">
                        {item.value} Orders
                      </span>
                      <span className="text-[10px] text-gray-400 ml-2">
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
        <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-1">
              Campaign Statistics
            </h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">
              Aggregate campaign conversion data
            </p>
          </div>

          <div className="space-y-6 my-auto">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">
                Total UTM Referrals
              </span>
              <span className="text-4xl font-black font-headline text-[#1a1c1c] font-mono mt-1 block">
                {totalUtmOrders}
              </span>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">
                Orders with referral parameters
              </p>
            </div>

            <div className="h-px bg-gray-100"></div>

            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">
                Active Campaigns
              </span>
              <span className="text-4xl font-black font-headline text-[#1a1c1c] font-mono mt-1 block">
                {campaigns.length}
              </span>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">
                Registered campaign parameters
              </p>
            </div>
          </div>

          <div className="text-[9px] text-gray-400 uppercase tracking-[0.2em] mt-6 border-t border-gray-100 pt-4 font-sans font-bold">
            * Recorded automatically from customer checkout parameters.
          </div>
        </div>
      </div>

      {/* Campaigns Performance Ledger */}
      <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none mb-8">
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-1">
          Campaign Conversion Ledger
        </h3>
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">
          Detailed ledger breakdown of sales segmented by campaign parameters
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1a1c1c]/10">
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Campaign Name
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Source
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Medium
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">
                  Orders Placed
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">
                  Net Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {campaigns.length > 0 ? (
                campaigns.map((camp: any) => (
                  <tr key={`${camp.name}-${camp.source}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-xs font-black uppercase tracking-wider text-[#1a1c1c]">
                      {camp.name}
                    </td>
                    <td className="py-4 text-xs uppercase text-gray-500 tracking-wider font-sans font-bold">
                      {camp.source}
                    </td>
                    <td className="py-4 text-xs uppercase text-gray-500 tracking-wider font-sans">
                      {camp.medium}
                    </td>
                    <td className="py-4 text-xs font-bold text-[#1a1c1c] text-right">
                      {camp.orders}
                    </td>
                    <td className="py-4 text-xs font-bold text-[#775a19] text-right">
                      ₹{camp.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-sans"
                  >
                    No active campaign referral data captured for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY AD SPEND & ROAS */}
      <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-1">
              Monthly Ad Spend &amp; ROAS Ledger
            </h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
              Attributed revenue and return on ad spend per channel
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-5 py-3 bg-[#1a1c1c] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all border-none cursor-pointer rounded-none flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>{showAddForm ? "Close Logger" : "Log Ad Spend"}</span>
          </button>
        </div>

        {/* Inline Logger Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSpend}
            className="bg-gray-50 border border-[#1a1c1c]/10 p-6 mb-8 space-y-4 max-w-xl rounded-none"
          >
            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">
              Log Ad Spend Execution
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                  Ad Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-white border border-[#1a1c1c]/15 p-2.5 text-xs text-[#1a1c1c] font-bold focus:outline-none focus:border-[#775a19] rounded-none"
                >
                  <option value="meta">Meta Ads (Facebook/Instagram)</option>
                  <option value="google">Google Ads</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                  Target Month
                </label>
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="2026-07"
                  required
                  className="w-full bg-white border border-[#1a1c1c]/15 p-2.5 text-xs text-[#1a1c1c] font-mono focus:outline-none focus:border-[#775a19] rounded-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                  Spend Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  placeholder="e.g. 12000"
                  className="w-full bg-white border border-[#1a1c1c]/15 p-2.5 text-xs text-[#1a1c1c] font-mono focus:outline-none focus:border-[#775a19] rounded-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                  Campaign Name (Optional)
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. summer_sale"
                  className="w-full bg-white border border-[#1a1c1c]/15 p-2.5 text-xs text-[#1a1c1c] focus:outline-none focus:border-[#775a19] rounded-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log campaign target details..."
                rows={2}
                className="w-full bg-white border border-[#1a1c1c]/15 p-2.5 text-xs text-[#1a1c1c] focus:outline-none focus:border-[#775a19] resize-none rounded-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#775a19] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#5f4713] transition-colors border-none cursor-pointer rounded-none disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Log"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 bg-white text-[#1a1c1c] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer rounded-none"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1a1c1c]/10">
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Channel
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Month
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">
                  Spend
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">
                  Revenue
                </th>
                <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">
                  ROAS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {roasReport.length > 0 ? (
                roasReport.map((row: any, index: number) => (
                  <tr key={`${row.channel}-${row.month}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-xs font-black uppercase tracking-wider text-[#1a1c1c]">
                      {formatChannel(row.channel)}
                    </td>
                    <td className="py-4 text-xs font-bold text-gray-500 tracking-wider">
                      {formatMonth(row.month)}
                    </td>
                    <td className="py-4 text-xs font-bold text-[#1a1c1c] text-right">
                      ₹{row.spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 text-xs font-bold text-[#1a1c1c] text-right">
                      ₹{row.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 text-right">
                      <span
                        className={`text-xs font-black tracking-wider ${roasColor(row.roas ?? 0)}`}
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
                    className="py-8 text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-sans"
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
