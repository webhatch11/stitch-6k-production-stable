"use client";

import React, { useState, useEffect } from "react";
import { getFinanceAnalyticsAction } from "@/app/actions/admin-analytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import * as XLSX from "xlsx";

export default function FinanceAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "gst">("general");

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

  const handleExportCSV = () => {
    const report = data?.gstReport || [];
    if (report.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Month,Gross Sales (INR),GST Collected (INR),Net Sales (INR)\n";

    report.forEach((row: any) => {
      csvContent += `"${row.monthName}",${row.grossSales},${row.gstCollected},${row.netSales}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST_Financial_Report_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportGSTReport = () => {
    if (!data?.gstReportRange) return;
    const r = data.gstReportRange;
    const monthName = `${selectedMonth}/${selectedYear}`;
    const row = {
      "Month": monthName,
      "Taxable Value": r.totalTaxableValue,
      "CGST": r.totalCGST,
      "SGST": r.totalSGST,
      "IGST": r.totalIGST,
      "Total GST": r.totalGSTAmount,
      "Total Revenue": r.totalRevenue
    };

    const worksheet = XLSX.utils.json_to_sheet([row]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GST Report");
    XLSX.writeFile(workbook, `GST_Report_${selectedYear}_${selectedMonth}.xlsx`);
  };

  const summary = data?.summary || {
    grossRevenue: 0,
    netRevenue: 0,
    totalRefunds: 0,
    gstCollected: 0,
    ordersCount: 0,
    avgOrderValue: 0
  };

  const gstReport = data?.gstReport || [];

  const gstReportRange = data?.gstReportRange || {
    totalOrders: 0,
    totalTaxableValue: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalGSTAmount: 0,
    totalRevenue: 0
  };

  const liability = data?.liability || {
    totalWalletLiability: 0,
    totalLoyaltyLiability: 0,
    totalPoints: 0,
    totalLiability: 0
  };

  const netRevenueReport = data?.netRevenueReport || {
    grossRevenue: 0,
    totalRefunds: 0,
    totalDiscounts: 0,
    netRevenue: 0,
    walletRevenue: 0,
    gatewayRevenue: 0
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white font-body">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#fed488]">Tax & Accounting</span>
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight mt-1 text-white">GST & Finance Dashboard</h1>
          <p className="text-[11px] text-white/50 mt-1 uppercase tracking-wider">Review tax liabilities, net proceeds, refund ratios, and collect audits</p>
        </div>

        {/* Date Filter & Export */}
        <div className="flex items-center gap-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-[#0a0a0a] text-xs font-bold uppercase tracking-wider text-white border border-white/10 px-4 py-2.5 focus:outline-none focus:border-[#fed488] rounded-none cursor-pointer"
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
            onClick={handleExportCSV}
            className="px-5 py-2.5 bg-[#fed488] text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-[#e0bb70] transition-all flex items-center gap-2 rounded-none cursor-pointer select-none border-none"
          >
            <span className="material-symbols-outlined text-[13px] font-black">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-white/10 mb-8">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer bg-transparent ${
            activeTab === "general"
              ? "border-[#fed488] text-white"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          General Ledger
        </button>
        <button
          onClick={() => setActiveTab("gst")}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer bg-transparent ${
            activeTab === "gst"
              ? "border-[#fed488] text-white"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          GST & Liabilities Report
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="size-8 rounded-full border-2 border-white/20 border-t-[#fed488] animate-spin"></div>
        </div>
      ) : activeTab === "general" ? (
        <>
          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Card 1: Gross Sales */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Gross Sales</span>
              <span className="text-3xl font-black font-headline text-white font-mono mt-2 block">₹{summary.grossRevenue.toLocaleString()}</span>
              <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Total revenue collected</p>
            </div>

            {/* Card 2: GST Collected */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">GST Collected (5% / 12%)</span>
              <span className="text-3xl font-black font-headline text-white font-mono mt-2 block">₹{summary.gstCollected.toLocaleString()}</span>
              <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Computed on actual product rate</p>
            </div>

            {/* Card 3: Total Refunds */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Total Refunds</span>
              <span className="text-3xl font-black font-headline text-white font-mono mt-2 block">₹{summary.totalRefunds.toLocaleString()}</span>
              <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Deducted from gross proceeds</p>
            </div>

            {/* Card 4: Net Proceeds */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Net Proceeds</span>
              <span className="text-3xl font-black font-headline text-white font-mono mt-2 block">₹{summary.netRevenue.toLocaleString()}</span>
              <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Net Sales less GST & Refunds</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Chart: GST trends */}
            <div className="lg:col-span-2 bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">GST Liability Trends</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Historical view of tax liabilities collected</p>
              </div>

              <div className="h-64">
                {mounted && gstReport.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gstReport}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="monthName" stroke="#666" fontSize={10} tickLine={false} />
                      <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
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
                      <Bar dataKey="gstCollected" fill="#fed488" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-white/40 uppercase tracking-widest text-center py-20">No financial history logs</p>
                )}
              </div>
            </div>

            {/* Metrics cards summary breakdown */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Sales Indicators</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Order metrics details</p>
              </div>

              <div className="space-y-6 my-auto">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Orders Volume</span>
                  <span className="text-4xl font-black font-headline text-white mt-1 block">{summary.ordersCount}</span>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Settled payments this month</p>
                </div>

                <div className="h-px bg-white/10"></div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Average Order Value (AOV)</span>
                  <span className="text-4xl font-black font-headline text-[#fed488] mt-1 block">₹{summary.avgOrderValue.toLocaleString()}</span>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Average order basket size value</p>
                </div>
              </div>

              <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] border-t border-white/5 pt-4 mt-6">
                * GST reports segment product levels automatically.
              </div>
            </div>
          </div>

          {/* Tax Ledger */}
          <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none">
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">GST Tax Ledger</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Aggregate ledger of sales tax collected monthly</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/15">
                    <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Tax Period</th>
                    <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Gross Sales</th>
                    <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">GST Collected (5% / 12%)</th>
                    <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Net Sales (Excl. Tax)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {gstReport.length > 0 ? (
                    gstReport.map((row: any) => (
                      <tr key={row.monthName}>
                        <td className="py-4 text-xs font-black text-white uppercase tracking-wider">{row.monthName}</td>
                        <td className="py-4 text-xs text-white text-right">₹{row.grossSales.toLocaleString()}</td>
                        <td className="py-4 text-xs text-[#fed488] text-right">₹{row.gstCollected.toLocaleString()}</td>
                        <td className="py-4 text-xs text-white/60 text-right">₹{row.netSales.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-white/30 uppercase tracking-widest">
                        No active tax histories found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Net Revenue Report Summary Cards */}
          <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none mb-8">
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Net Revenue Report Summary</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Financial performance metrics for the selected month</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Gross Revenue</span>
                <span className="text-2xl font-black font-headline text-white font-mono mt-2 block">
                  ₹{netRevenueReport.grossRevenue.toLocaleString('en-IN')}
                </span>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Sum of total orders value</p>
              </div>
              
              <div className="bg-white/5 border border-white/10 p-6 rounded-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Total Refunds</span>
                <span className="text-2xl font-black font-headline text-white font-mono mt-2 block">
                  ₹{netRevenueReport.totalRefunds.toLocaleString('en-IN')}
                </span>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Deducted refund amounts</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Total Discounts</span>
                <span className="text-2xl font-black font-headline text-white font-mono mt-2 block">
                  ₹{netRevenueReport.totalDiscounts.toLocaleString('en-IN')}
                </span>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Coupon & loyalty discounts</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Wallet Revenue</span>
                <span className="text-2xl font-black font-headline text-white font-mono mt-2 block">
                  ₹{netRevenueReport.walletRevenue.toLocaleString('en-IN')}
                </span>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Paid using store credits</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Gateway Revenue</span>
                <span className="text-2xl font-black font-headline text-white font-mono mt-2 block">
                  ₹{netRevenueReport.gatewayRevenue.toLocaleString('en-IN')}
                </span>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Paid online (Razorpay)</p>
              </div>

              <div className="bg-white/5 border border-[#fed488]/30 p-6 rounded-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#fed488] block">Net Revenue</span>
                <span className="text-2xl font-black font-headline text-[#fed488] font-mono mt-2 block">
                  ₹{netRevenueReport.netRevenue.toLocaleString('en-IN')}
                </span>
                <p className="text-[9px] text-[#fed488]/40 uppercase tracking-widest mt-1">Gross Revenue less Refunds</p>
              </div>
            </div>
          </div>

          {/* GST Summary Report & Liabilities Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* GST Summary Report */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">GST Summary Report</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Tax collections computed for the selected period</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Taxable Value</span>
                  <span className="text-2xl font-black font-headline text-white font-mono mt-1 block">
                    ₹{gstReportRange.totalTaxableValue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">CGST (6%)</span>
                  <span className="text-2xl font-black font-headline text-white font-mono mt-1 block">
                    ₹{gstReportRange.totalCGST.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">SGST (6%)</span>
                  <span className="text-2xl font-black font-headline text-white font-mono mt-1 block">
                    ₹{gstReportRange.totalSGST.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">IGST (12%)</span>
                  <span className="text-2xl font-black font-headline text-white font-mono mt-1 block">
                    ₹{gstReportRange.totalIGST.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="col-span-2 border-t border-white/10 pt-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#fed488] block">Total GST Amount</span>
                  <span className="text-3xl font-black font-headline text-[#fed488] font-mono mt-1 block">
                    ₹{gstReportRange.totalGSTAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                onClick={exportGSTReport}
                className="px-5 py-2.5 bg-[#fed488] text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-[#e0bb70] transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer self-start select-none border-none"
              >
                <span className="material-symbols-outlined text-[13px] font-black">download</span>
                <span>Export to Excel</span>
              </button>
            </div>

            {/* Outstanding Liabilities */}
            <div className="bg-[#0d0d0d] border border-white/15 p-6 rounded-none flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-[#fed488]">Outstanding Liabilities</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Total credit and loyalty points liabilities owed to customers</p>
              </div>

              <div className="space-y-6 my-auto">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Wallet Credits Owed</span>
                  <span className="text-3xl font-black font-headline text-amber-600 font-mono mt-1 block">
                    ₹{liability.totalWalletLiability.toLocaleString('en-IN')}
                  </span>
                </div>
                
                <div className="h-px bg-white/10"></div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Loyalty Points Value</span>
                  <span className="text-3xl font-black font-headline text-amber-600 font-mono mt-1 block">
                    ₹{liability.totalLoyaltyLiability.toLocaleString('en-IN')}{" "}
                    <span className="text-xs text-white/40 font-mono">({liability.totalPoints.toLocaleString('en-IN')} pts)</span>
                  </span>
                </div>

                <div className="h-px bg-white/10"></div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-600 block">Total Liability</span>
                  <span className="text-4xl font-bold font-headline text-red-600 font-mono mt-1 block">
                    ₹{liability.totalLiability.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
