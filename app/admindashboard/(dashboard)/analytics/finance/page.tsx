"use client";

import React, { useState, useEffect } from "react";
import { getFinanceAnalyticsAction } from "@/app/actions/admin-analytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";

export default function FinanceAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"payments" | "refunds" | "gst" | "revenue">("payments");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getFinanceAnalyticsAction(selectedYear, selectedMonth);
      if (res.success) {
        setData(res);
      }
      setLoading(false);
    }
    load();
  }, [selectedMonth, selectedYear]);

  // Clean currency formatter (2 decimal places)
  const formatCurrency = (amount: number | undefined | null) => {
    const num = Number(amount || 0);
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Export 1: Payments Excel (.xlsx)
  const handleExportPaymentsExcel = () => {
    const logs = data?.paymentLogs || [];
    const rows = logs.map((row: any) => ({
      "Order ID": row.orderId,
      "Customer Name": row.customer,
      "Gateway Paid (INR)": row.gatewayPaid,
      "Wallet Paid (INR)": row.walletPaid,
      "Total Paid (INR)": row.total,
      "Payment Status": row.paymentStatus,
      "Razorpay Payment ID": row.paymentId,
      "Transaction Date": row.date,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payments Ledger");
    XLSX.writeFile(workbook, `Payments_Report_${selectedYear}_${selectedMonth}.xlsx`);
  };

  // Export 2: Refunds Excel (.xlsx)
  const handleExportRefundsExcel = () => {
    const logs = data?.refundLogs || [];
    const rows = logs.map((row: any) => ({
      "Order ID": row.orderId,
      "Customer Name": row.customer,
      "Refund Amount (INR)": row.refundAmount,
      "Refund Status": row.refundStatus,
      "Refund Reason": row.refundReason,
      "Refund Date": row.date,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Refunds Ledger");
    XLSX.writeFile(workbook, `Refunds_Report_${selectedYear}_${selectedMonth}.xlsx`);
  };

  // Export 3: Multi-Tier GST Excel (.xlsx)
  const exportGSTReport = () => {
    if (!data?.gstReportRange) return;
    const r = data.gstReportRange;
    const monthName = `${selectedMonth}/${selectedYear}`;

    const summaryRow = {
      "Month": monthName,
      "Total Orders": r.totalOrders || 0,
      "Taxable Value": r.totalTaxableValue,
      "CGST (6%)": r.totalCGST,
      "SGST (6%)": r.totalSGST,
      "IGST (12%)": r.totalIGST,
      "Total GST Amount": r.totalGSTAmount,
      "Total Revenue": r.totalRevenue,
    };

    const slabRow5 = {
      "GST Rate Slab": "5% GST",
      "Taxable Value (INR)": r.slab5?.taxable || 0,
      "GST Collected (INR)": r.slab5?.gst || 0,
    };

    const slabRow12 = {
      "GST Rate Slab": "12% GST",
      "Taxable Value (INR)": r.slab12?.taxable || 0,
      "GST Collected (INR)": r.slab12?.gst || 0,
    };

    const slabRow18 = {
      "GST Rate Slab": "18% GST",
      "Taxable Value (INR)": r.slab18?.taxable || 0,
      "GST Collected (INR)": r.slab18?.gst || 0,
    };

    const summarySheet = XLSX.utils.json_to_sheet([summaryRow]);
    const slabsSheet = XLSX.utils.json_to_sheet([slabRow5, slabRow12, slabRow18]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, "GST Summary");
    XLSX.utils.book_append_sheet(workbook, slabsSheet, "GST Slabs Breakdown");
    XLSX.writeFile(workbook, `GST_Tax_Report_${selectedYear}_${selectedMonth}.xlsx`);
  };

  // Export 4: Executive Revenue Summary Excel (.xlsx)
  const handleExportRevenueExcel = () => {
    const s = data?.summary || {};
    const nr = data?.netRevenueReport || {};
    const l = data?.liability || {};

    const revenueMetrics = [
      { Metric: "Gross Revenue (INR)", Value: nr.grossRevenue || s.grossRevenue || 0 },
      { Metric: "Total Refunds (INR)", Value: s.totalRefunds || nr.totalRefunds || 0 },
      { Metric: "Total Discounts (INR)", Value: nr.totalDiscounts || 0 },
      { Metric: "Net Revenue (INR)", Value: nr.netRevenue || 0 },
      { Metric: "Wallet Revenue (INR)", Value: nr.walletRevenue || 0 },
      { Metric: "Gateway Revenue (Razorpay) (INR)", Value: nr.gatewayRevenue || 0 },
      { Metric: "Average Order Value (AOV) (INR)", Value: s.avgOrderValue || 0 },
    ];

    const liabilityMetrics = [
      { Liability: "Wallet Credits Owed (INR)", Value: l.totalWalletLiability || 0 },
      { Liability: "Loyalty Points Liability (INR)", Value: l.totalLoyaltyLiability || 0 },
      { Liability: "Total Customer Liability (INR)", Value: l.totalLiability || 0 },
    ];

    const sheet1 = XLSX.utils.json_to_sheet(revenueMetrics);
    const sheet2 = XLSX.utils.json_to_sheet(liabilityMetrics);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet1, "Revenue Summary");
    XLSX.utils.book_append_sheet(workbook, sheet2, "Customer Liabilities");
    XLSX.writeFile(workbook, `Revenue_Financial_Summary_${selectedYear}_${selectedMonth}.xlsx`);
  };

  const summary = data?.summary || {
    grossRevenue: 0,
    netRevenue: 0,
    totalRefunds: 0,
    gstCollected: 0,
    ordersCount: 0,
    avgOrderValue: 0,
  };

  const gstReport = data?.gstReport || [];
  const gstReportRange = data?.gstReportRange || {
    totalOrders: 0,
    totalTaxableValue: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalGSTAmount: 0,
    totalRevenue: 0,
    slab5: { taxable: 0, gst: 0 },
    slab12: { taxable: 0, gst: 0 },
    slab18: { taxable: 0, gst: 0 },
  };

  const liability = data?.liability || {
    totalWalletLiability: 0,
    totalLoyaltyLiability: 0,
    totalPoints: 0,
    totalLiability: 0,
  };

  const netRevenueReport = data?.netRevenueReport || {
    grossRevenue: 0,
    totalRefunds: 0,
    totalDiscounts: 0,
    netRevenue: 0,
    walletRevenue: 0,
    gatewayRevenue: 0,
  };

  const paymentLogs = data?.paymentLogs || [];
  const refundLogs = data?.refundLogs || [];

  return (
    <div className="p-8 lg:p-16 min-h-screen bg-[#faf9f8] text-[#1a1c1c] font-body">
      {/* Page Header — Atelier Noir Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-[#1a1c1c]/10 pb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">Atelier Noir Financial Intelligence</span>
          <h1 className="font-headline text-4xl lg:text-5xl font-black uppercase tracking-tighter text-[#1a1c1c] leading-none mt-2">
            GST & Finance Dashboard
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em] mt-2">
            Comprehensive revenue tracking, tax compliance, payments ledger, and refund reporting
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-4">
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
        </div>
      </div>

      {/* 4 Dedicated Agreement Tabs Navigation — Atelier Noir Clean Line Icons */}
      <div className="flex border-b border-[#1a1c1c]/10 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all cursor-pointer bg-transparent whitespace-nowrap rounded-none ${
            activeTab === "payments"
              ? "border-[#775a19] text-[#775a19]"
              : "border-transparent text-gray-400 hover:text-[#1a1c1c]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">payments</span>
          <span>Payments Report</span>
        </button>

        <button
          onClick={() => setActiveTab("refunds")}
          className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all cursor-pointer bg-transparent whitespace-nowrap rounded-none ${
            activeTab === "refunds"
              ? "border-[#775a19] text-[#775a19]"
              : "border-transparent text-gray-400 hover:text-[#1a1c1c]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">receipt_long</span>
          <span>Refund Report</span>
        </button>

        <button
          onClick={() => setActiveTab("gst")}
          className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all cursor-pointer bg-transparent whitespace-nowrap rounded-none ${
            activeTab === "gst"
              ? "border-[#775a19] text-[#775a19]"
              : "border-transparent text-gray-400 hover:text-[#1a1c1c]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">account_balance</span>
          <span>Tax (GST) Report</span>
        </button>

        <button
          onClick={() => setActiveTab("revenue")}
          className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all cursor-pointer bg-transparent whitespace-nowrap rounded-none ${
            activeTab === "revenue"
              ? "border-[#775a19] text-[#775a19]"
              : "border-transparent text-gray-400 hover:text-[#1a1c1c]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">query_stats</span>
          <span>Revenue & Summary</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="size-8 rounded-none border-2 border-gray-200 border-t-[#775a19] animate-spin"></div>
        </div>
      ) : (
        <>
          {/* TAB 1: PAYMENTS REPORT */}
          {activeTab === "payments" && (
            <div className="space-y-8">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">PAYMENTS REPORT — SELECTED MONTH</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Gateway vs Wallet transactions audit</p>
                </div>
                <button
                  onClick={handleExportPaymentsExcel}
                  className="px-5 py-3 bg-[#1a1c1c] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all flex items-center gap-2 border-none rounded-none cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">table_view</span>
                  <span>Export Payments Excel</span>
                </button>
              </div>

              {/* Payments Summary Cards — Brutalist High Contrast Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Gateway Revenue (Razorpay)</span>
                  <span className="text-3xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                    {formatCurrency(netRevenueReport.gatewayRevenue)}
                  </span>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Online gateway payments</p>
                </div>

                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Wallet Revenue</span>
                  <span className="text-3xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                    {formatCurrency(netRevenueReport.walletRevenue)}
                  </span>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Store credit payments</p>
                </div>

                <div className="bg-white border border-[#775a19]/30 p-6 rounded-none">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#775a19] block">Total Settled Volume</span>
                  <span className="text-3xl font-black font-headline text-[#775a19] font-mono mt-2 block">
                    {formatCurrency(netRevenueReport.grossRevenue)}
                  </span>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Total gross order collections</p>
                </div>
              </div>

              {/* Payments Log Table */}
              <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none">
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-6">Payment Transaction Logs</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1a1c1c]/10">
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Order ID</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Customer</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Gateway Paid</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Wallet Paid</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Total Paid</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Razorpay ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {paymentLogs.length > 0 ? (
                        paymentLogs.map((row: any) => (
                          <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 text-xs font-black text-[#775a19] uppercase tracking-wider">{row.orderId}</td>
                            <td className="py-4 text-xs text-[#1a1c1c] font-sans font-bold">{row.customer}</td>
                            <td className="py-4 text-xs text-[#1a1c1c] text-right">{formatCurrency(row.gatewayPaid)}</td>
                            <td className="py-4 text-xs text-[#1a1c1c] text-right">{formatCurrency(row.walletPaid)}</td>
                            <td className="py-4 text-xs font-bold text-[#1a1c1c] text-right">{formatCurrency(row.total)}</td>
                            <td className="py-4 text-xs text-gray-400 text-right">{row.paymentId}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-sans">
                            No payment transactions logged for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REFUND REPORT */}
          {activeTab === "refunds" && (
            <div className="space-y-8">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">REFUND REPORT — SELECTED MONTH</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Processed customer refunds & return payouts audit</p>
                </div>
                <button
                  onClick={handleExportRefundsExcel}
                  className="px-5 py-3 bg-[#1a1c1c] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all flex items-center gap-2 border-none rounded-none cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">table_view</span>
                  <span>Export Refunds Excel</span>
                </button>
              </div>

              {/* Refund Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Total Refunded Amount</span>
                  <span className="text-3xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                    {formatCurrency(summary.totalRefunds)}
                  </span>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Deducted from gross proceeds</p>
                </div>

                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Processed Refund Orders</span>
                  <span className="text-3xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                    {refundLogs.length}
                  </span>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1 font-bold font-sans">Approved return refund cases</p>
                </div>
              </div>

              {/* Refund Logs Table */}
              <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none">
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-6">Refund Transaction Logs</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1a1c1c]/10">
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Order ID</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Customer</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Refund Amount</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Status</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {refundLogs.length > 0 ? (
                        refundLogs.map((row: any) => (
                          <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 text-xs font-black text-[#775a19] uppercase tracking-wider">{row.orderId}</td>
                            <td className="py-4 text-xs text-[#1a1c1c] font-sans font-bold">{row.customer}</td>
                            <td className="py-4 text-xs font-bold text-red-600 text-right">{formatCurrency(row.refundAmount)}</td>
                            <td className="py-4 text-xs text-[#775a19] text-right font-sans font-bold uppercase">{row.refundStatus}</td>
                            <td className="py-4 text-xs text-gray-500 text-right font-sans">{row.refundReason}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-sans">
                            No refund transactions recorded for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TAX (GST) REPORT */}
          {activeTab === "gst" && (
            <div className="space-y-8">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">TAX REPORT — MULTI-TIER GST SLABS</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Exact GST rate calculation (5%, 12%, 18%) from product catalog</p>
                </div>
                <button
                  onClick={exportGSTReport}
                  className="px-5 py-3 bg-[#1a1c1c] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all flex items-center gap-2 border-none rounded-none cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">table_view</span>
                  <span>Export GST Excel Workbook</span>
                </button>
              </div>

              {/* Multi-Tier GST Rate Slab Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 5% GST Slab */}
                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">5% GST Rate Slab</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-[#775a19]/10 text-[#775a19] px-2 py-0.5 border border-[#775a19]/20">Apparel ≤ ₹1,000</span>
                  </div>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-sans">Taxable Value:</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.slab5?.taxable)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-sans">GST Collected (5%):</span>
                      <span className="font-bold text-[#775a19]">{formatCurrency(gstReportRange.slab5?.gst)}</span>
                    </div>
                  </div>
                </div>

                {/* 12% GST Slab */}
                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">12% GST Rate Slab</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-[#775a19]/10 text-[#775a19] px-2 py-0.5 border border-[#775a19]/20">Apparel &gt; ₹1,000</span>
                  </div>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-sans">Taxable Value:</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.slab12?.taxable)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-sans">GST Collected (12%):</span>
                      <span className="font-bold text-[#775a19]">{formatCurrency(gstReportRange.slab12?.gst)}</span>
                    </div>
                  </div>
                </div>

                {/* 18% GST Slab */}
                <div className="bg-white border border-[#1a1c1c]/10 p-6 rounded-none">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">18% GST Rate Slab</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-[#775a19]/10 text-[#775a19] px-2 py-0.5 border border-[#775a19]/20">Accessories / Premium</span>
                  </div>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-sans">Taxable Value:</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.slab18?.taxable)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-sans">GST Collected (18%):</span>
                      <span className="font-bold text-[#775a19]">{formatCurrency(gstReportRange.slab18?.gst)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Combined GST Breakdown & Liability Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* GST Liability Trend Chart */}
                <div className="lg:col-span-2 bg-white border border-[#1a1c1c]/10 p-8 rounded-none flex flex-col justify-between">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-1">GST Liability Trends</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">Historical monthly view of tax liabilities collected</p>
                  </div>

                  <div className="h-64">
                    {mounted && gstReport.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gstReport}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                          <XAxis dataKey="monthName" stroke="#666" fontSize={10} tickLine={false} />
                          <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1c1c",
                              border: "1px solid #775a19",
                              borderRadius: "0px",
                              color: "#faf9f8",
                              fontFamily: "monospace",
                              fontSize: "11px",
                            }}
                            formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "GST Collected"]}
                          />
                          <Bar dataKey="gstCollected" fill="#775a19" barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-gray-400 uppercase tracking-widest text-center py-20">No financial history logs</p>
                    )}
                  </div>
                </div>

                {/* CGST, SGST, IGST Summary Card */}
                <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none flex flex-col justify-between">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-1">Tax Split Breakdown</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-6">Intrastate vs Interstate tax allocation</p>
                  </div>

                  <div className="space-y-4 my-auto font-mono">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-sans font-bold">Taxable Value:</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.totalTaxableValue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-sans font-bold">CGST (Intrastate):</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.totalCGST)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-sans font-bold">SGST (Intrastate):</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.totalSGST)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-sans font-bold">IGST (Interstate):</span>
                      <span className="font-bold text-[#1a1c1c]">{formatCurrency(gstReportRange.totalIGST)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-sm font-bold">
                      <span className="text-[#775a19] font-sans">Total GST Amount:</span>
                      <span className="text-[#775a19]">{formatCurrency(gstReportRange.totalGSTAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax Ledger Table */}
              <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none">
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-6">GST Monthly Ledger Table</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1a1c1c]/10">
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Tax Period</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Gross Sales</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">GST Collected</th>
                        <th className="pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Net Sales (Excl. Tax)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {gstReport.length > 0 ? (
                        gstReport.map((row: any) => (
                          <tr key={row.monthName} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 text-xs font-black text-[#1a1c1c] uppercase tracking-wider">{row.monthName}</td>
                            <td className="py-4 text-xs text-[#1a1c1c] text-right">{formatCurrency(row.grossSales)}</td>
                            <td className="py-4 text-xs text-[#775a19] font-bold text-right">{formatCurrency(row.gstCollected)}</td>
                            <td className="py-4 text-xs text-gray-500 text-right">{formatCurrency(row.netSales)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-sans">
                            No active tax histories found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REVENUE & SUMMARY */}
          {activeTab === "revenue" && (
            <div className="space-y-8">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19]">EXECUTIVE FINANCIAL SUMMARY</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Overall monthly financial performance audit</p>
                </div>
                <button
                  onClick={handleExportRevenueExcel}
                  className="px-5 py-3 bg-[#1a1c1c] text-[#faf9f8] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all flex items-center gap-2 border-none rounded-none cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">table_view</span>
                  <span>Export Financial Summary Excel</span>
                </button>
              </div>

              {/* Net Revenue Summary Grid */}
              <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none">
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-6">Net Revenue Report</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Gross Revenue</span>
                    <span className="text-2xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                      {formatCurrency(netRevenueReport.grossRevenue)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Sum of total order proceeds</p>
                  </div>

                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Total Refunds</span>
                    <span className="text-2xl font-black font-headline text-red-600 font-mono mt-2 block">
                      {formatCurrency(netRevenueReport.totalRefunds)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Deducted refund amounts</p>
                  </div>

                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Total Discounts</span>
                    <span className="text-2xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                      {formatCurrency(netRevenueReport.totalDiscounts)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Coupons & loyalty discounts</p>
                  </div>

                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Wallet Revenue</span>
                    <span className="text-2xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                      {formatCurrency(netRevenueReport.walletRevenue)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Paid using store credits</p>
                  </div>

                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Gateway Revenue</span>
                    <span className="text-2xl font-black font-headline text-[#1a1c1c] font-mono mt-2 block">
                      {formatCurrency(netRevenueReport.gatewayRevenue)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Paid online (Razorpay)</p>
                  </div>

                  <div className="bg-gray-50 border border-[#775a19]/40 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#775a19] block">Net Revenue</span>
                    <span className="text-2xl font-black font-headline text-[#775a19] font-mono mt-2 block">
                      {formatCurrency(netRevenueReport.netRevenue)}
                    </span>
                    <p className="text-[8px] text-[#775a19]/70 uppercase tracking-widest mt-1 font-bold">Gross Revenue less Refunds</p>
                  </div>
                </div>
              </div>

              {/* Customer Liabilities */}
              <div className="bg-white border border-[#1a1c1c]/10 p-8 rounded-none">
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#775a19] mb-6">Customer Outstanding Liabilities</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Wallet Credits Owed</span>
                    <span className="text-2xl font-black font-headline text-amber-700 font-mono mt-2 block">
                      {formatCurrency(liability.totalWalletLiability)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Outstanding wallet credits</p>
                  </div>

                  <div className="bg-gray-50 border border-[#1a1c1c]/10 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block">Loyalty Points Liability</span>
                    <span className="text-2xl font-black font-headline text-amber-700 font-mono mt-2 block">
                      {formatCurrency(liability.totalLoyaltyLiability)}
                    </span>
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 font-bold">
                      {liability.totalPoints.toLocaleString()} loyalty pts
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-red-200 p-6 rounded-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-600 block">Total Customer Liability</span>
                    <span className="text-2xl font-black font-headline text-red-600 font-mono mt-2 block">
                      {formatCurrency(liability.totalLiability)}
                    </span>
                    <p className="text-[8px] text-red-500 uppercase tracking-widest mt-1 font-bold">Combined wallet + points liability</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
