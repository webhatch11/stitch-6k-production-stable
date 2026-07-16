"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order } from "@/lib/types";
import { approveReturnPickupAction, rejectReturnAction, processReturnRefundAction } from "@/app/actions/admin-orders";

const refundOptionDisplay: Record<string, string> = {
  'wallet': 'Store Wallet',
  'original_source': 'Bank / Original Payment',
  'bank': 'Bank Account'
};

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ReturnsDashboardClientProps {
  initialOrders: Order[];
}

export default function ReturnsDashboardClient({ initialOrders }: ReturnsDashboardClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<"pending" | "transit" | "completed" | "analytics">("pending");

  // Modal States
  const [modalType, setModalType] = useState<"pickup" | "reject" | "receive" | null>(null);
  const [targetOrder, setTargetOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [modalError, setModalError] = useState("");
  const [qcPassed, setQcPassed] = useState(true);
  const [qcReason, setQcReason] = useState("");

  // Toast Alerts
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Filters
  const pendingOrders = orders.filter((o) => o.status === "Return Requested");
  const transitOrders = orders.filter((o) => o.status === "Return in Transit");
  const completedOrders = orders.filter((o) => ["Returned", "Return Rejected"].includes(o.status));

  // --- Analytics Calculations ---
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

  let thisMonthOrders = 0;
  let thisMonthReturns = 0;
  let lastMonthOrders = 0;
  let lastMonthReturns = 0;

  // Resolution Time calculator variables
  let totalResolutionTime = 0;
  let completedCount = 0;

  // Reason Frequencies
  const reasonCounts: { [key: string]: number } = {};
  // Product Return Frequencies
  const productCounts: { [key: string]: { name: string; count: number; value: number } } = {};
  // Refund Splits
  let walletRefunds = 0;
  let gatewayRefunds = 0;

  for (const o of orders) {
    const oTime = Date.parse(o.created_at || o.date) || Date.now();

    // Counts for rate
    if (oTime >= thirtyDaysAgo) {
      thisMonthOrders++;
      if (["Returned", "Return Requested", "Return in Transit", "Return Rejected"].includes(o.status)) {
        thisMonthReturns++;
      }
    } else if (oTime >= sixtyDaysAgo && oTime < thirtyDaysAgo) {
      lastMonthOrders++;
      if (["Returned", "Return Requested", "Return in Transit", "Return Rejected"].includes(o.status)) {
        lastMonthReturns++;
      }
    }

    const hasReturnStatus = ["Returned", "Return Requested", "Return in Transit", "Return Rejected"].includes(o.status);

    if (hasReturnStatus) {
      // Reason frequencies
      const reason = o.returnReason || "No reason specified";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

      // Product frequencies
      const rawItems = o.cartItems || [];
      for (const item of rawItems) {
        const pName = item.productName || item.title || "Unknown Design";
        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || 0);

        if (productCounts[pName]) {
          productCounts[pName].count += qty;
          productCounts[pName].value += price * qty;
        } else {
          productCounts[pName] = { name: pName, count: qty, value: price * qty };
        }
      }
    }

    if (o.status === "Returned") {
      completedCount++;
      // Refund splits
      if (o.refundOption === "wallet" || (o as any).refund_status === "wallet_only") {
        walletRefunds += o.total;
      } else {
        gatewayRefunds += o.total;
      }

      // Resolution Time
      const reqDate = o.returnRequestDate ? new Date(o.returnRequestDate).getTime() : 0;
      const compDate = o.returnDate ? new Date(o.returnDate).getTime() : 0;
      if (reqDate && compDate && compDate >= reqDate) {
        totalResolutionTime += (compDate - reqDate) / (1000 * 60 * 60 * 24);
      }
    }
  }

  const returnRate = thisMonthOrders > 0 ? ((thisMonthReturns / thisMonthOrders) * 100).toFixed(1) : "0.0";
  const lastMonthRate = lastMonthOrders > 0 ? ((lastMonthReturns / lastMonthOrders) * 100).toFixed(1) : "0.0";
  const rateTrend = (parseFloat(returnRate) - parseFloat(lastMonthRate)).toFixed(1);

  const avgResolutionTime = completedCount > 0 && totalResolutionTime > 0
    ? (totalResolutionTime / completedCount).toFixed(1)
    : "3.5";

  const reasonsChartData = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const refundSplitData = [
    { name: "Wallet Credits", value: walletRefunds, color: "#1a1a1a" },
    { name: "Original Gateway", value: gatewayRefunds, color: "#BA7517" },
  ];

  const topReturnedProducts = Object.values(productCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Actions
  const handleApprovePickup = async () => {
    if (!targetOrder || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitting(targetOrder.id);
    setModalError("");
    try {
      const res = await approveReturnPickupAction(targetOrder.id);
      if (res.success) {
        triggerToast(`Pickup approved for Order #${targetOrder.id}`);
        setModalType(null);
        setTargetOrder(null);
        router.refresh();
      } else {
        setModalError(res.error || "Failed to schedule pickup");
      }
    } catch (e: any) {
      setModalError(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
      setSubmitting(null);
    }
  };

  const handleConfirmRejection = async () => {
    if (!targetOrder || isSubmitting) return;
    if (!rejectReason.trim()) {
      setModalError("Rejection reason is required.");
      return;
    }
    setIsSubmitting(true);
    setSubmitting(targetOrder.id);
    setModalError("");
    try {
      const res = await rejectReturnAction(targetOrder.id, rejectReason.trim());
      if (res.success) {
        triggerToast(`Return request rejected for Order #${targetOrder.id}`);
        setModalType(null);
        setTargetOrder(null);
        setRejectReason("");
        router.refresh();
      } else {
        setModalError(res.error || "Failed to reject return");
      }
    } catch (e: any) {
      setModalError(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
      setSubmitting(null);
    }
  };

  const handleConfirmReceived = async () => {
    if (!targetOrder || isSubmitting) return;
    if (!qcPassed && !qcReason.trim()) {
      triggerToast('Please provide a reason for QC failure');
      return;
    }
    setIsSubmitting(true);
    setSubmitting(targetOrder.id);
    setModalError("");
    try {
      // Transition In Transit to Returned with dynamic QC result
      const res = await processReturnRefundAction(
        targetOrder.id,
        qcPassed,
        qcPassed ? "Item received & verified at warehouse" : qcReason
      );
      if (res.success) {
        triggerToast(`Order #${targetOrder.id} marked as Received & Refund issued.`);
        setModalType(null);
        setTargetOrder(null);
        setQcPassed(true);
        setQcReason("");
        router.refresh();
      } else {
        setModalError(res.error || "Failed to mark as received");
      }
    } catch (e: any) {
      setModalError(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
      setSubmitting(null);
    }
  };

  const calculateDaysSince = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10">
          {toastText}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Returns Management</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Returns Manager</h2>
        </div>
      </header>

      {/* Tabs Row */}
      <div className="flex border-b border-gray-200 gap-6 mb-10 overflow-x-auto">
        {([
          { key: "pending", label: `Pending Returns (${pendingOrders.length})` },
          { key: "transit", label: `In Transit (${transitOrders.length})` },
          { key: "completed", label: "Completed" },
          { key: "analytics", label: "Return Analytics" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-4 text-[10px] font-black uppercase tracking-widest cursor-pointer border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "border-primary text-[#0a0a0a]"
                : "border-transparent text-gray-400 hover:text-[#0a0a0a]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {activeTab === "pending" && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-[#fafafa]">
                  <th className="px-8 py-6">Order ID</th>
                  <th className="px-8 py-6">Customer</th>
                  <th className="px-8 py-6">Requested</th>
                  <th className="px-8 py-6">Reason</th>
                  <th className="px-8 py-6">Refund Method</th>
                  <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">Order Total</th>
                  <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">Refund Amount</th>
                  <th className="px-8 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs font-bold uppercase tracking-wider">
                {pendingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-8 py-12 text-center text-gray-400 italic">
                      No pending return requests found.
                    </td>
                  </tr>
                ) : (
                  pendingOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6 text-primary">#{o.id}</td>
                      <td className="px-8 py-6">{o.customer}</td>
                      <td className="px-8 py-6 text-gray-500">
                        {o.returnRequestDate || o.date}
                        <span className="text-[9px] block text-gray-400 font-mono tracking-normal mt-0.5">
                          ({calculateDaysSince(o.returnRequestDate || o.date)})
                        </span>
                      </td>
                      <td className="px-8 py-6 text-gray-600 truncate max-w-[150px]">{o.returnReason}</td>
                      <td className="px-8 py-6 text-gray-600">{refundOptionDisplay[o.refundOption || ""] || o.refundOption || "Original Payment"}</td>
                      <td className="px-6 py-4 text-[11px] font-bold text-gray-900">
                        ₹{(o.total || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-900">
                            ₹{(o.refund_amount !== undefined && o.refund_amount !== null ? o.refund_amount : o.total || 0).toLocaleString("en-IN")}
                          </span>
                          {o.refundOption === "wallet" && (
                            <span className="px-2 py-0.5 bg-[#775a19]/10 text-[#775a19] border border-[#775a19]/20 text-[8px] font-black uppercase tracking-widest rounded-none">Wallet</span>
                          )}
                          {(o.refundOption === "bank" || o.refundOption === "original_source") && (
                            <span className="px-2 py-0.5 bg-[#1a1c1c] text-[#faf9f8] border border-[#1a1c1c] text-[8px] font-black uppercase tracking-widest rounded-none">Bank</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Link
                            href={`/admindashboard/return-details?orderId=${o.id}`}
                            className="bg-primary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 flex items-center justify-center no-underline hover:opacity-90"
                          >
                            View & Approve
                          </Link>
                          <button
                            disabled={submitting === o.id}
                            onClick={() => {
                              setTargetOrder(o);
                              setRejectReason("");
                              setModalType("reject");
                              setModalError("");
                            }}
                            className={`border border-red-200 text-red-600 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 hover:bg-red-50 ${submitting === o.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Reject
                          </button>
                          <Link
                            href={`/admindashboard/return-details?orderId=${o.id}`}
                            className="border border-gray-200 text-gray-600 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 hover:border-[#0a0a0a] flex items-center gap-1"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "transit" && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-[#fafafa]">
                  <th className="px-8 py-6">Order ID</th>
                  <th className="px-8 py-6">Customer</th>
                  <th className="px-8 py-6">Pickup Date</th>
                  <th className="px-8 py-6">AWB Number</th>
                  <th className="px-8 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs font-bold uppercase tracking-wider">
                {transitOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-gray-400 italic">
                      No returns currently in transit.
                    </td>
                  </tr>
                ) : (
                  transitOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6 text-primary">#{o.id}</td>
                      <td className="px-8 py-6">{o.customer}</td>
                      <td className="px-8 py-6 text-gray-500">
                        {o.returnPickupScheduled ? new Date(o.returnPickupScheduled).toLocaleDateString("en-IN") : "N/A"}
                        <span className="text-[9px] block text-gray-400 font-mono tracking-normal mt-0.5">
                          ({calculateDaysSince(o.returnPickupScheduled)})
                        </span>
                      </td>
                      <td className="px-8 py-6 text-gray-900 font-mono text-[10px] tracking-normal">
                        {o.returnAwb || "No AWB generated"}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            disabled={submitting === o.id}
                            onClick={() => {
                              setTargetOrder(o);
                              setModalType("receive");
                              setModalError("");
                              setQcPassed(true);
                              setQcReason("");
                            }}
                            className={`bg-green-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 ${submitting === o.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Mark Received
                          </button>
                          <Link
                            href={`/admindashboard/return-details?orderId=${o.id}`}
                            className="border border-gray-200 text-gray-600 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 hover:border-[#0a0a0a] flex items-center gap-1"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "completed" && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-[#fafafa]">
                  <th className="px-8 py-6">Order ID</th>
                  <th className="px-8 py-6">Customer</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6">Refund Amount</th>
                  <th className="px-8 py-6">Method</th>
                  <th className="px-8 py-6">Completed Date</th>
                  <th className="px-8 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs font-bold uppercase tracking-wider">
                {completedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center text-gray-400 italic">
                      No completed returns found.
                    </td>
                  </tr>
                ) : (
                  completedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6 text-primary">#{o.id}</td>
                      <td className="px-8 py-6">{o.customer}</td>
                      <td className="px-8 py-6">
                        <span className={`px-2 py-0.5 text-[9px] font-black border uppercase tracking-widest ${
                          o.status === "Returned"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {o.status === "Returned" ? "Returned" : "Rejected"}
                        </span>
                        {(o as any).refund_status === "manual_review_required" && (
                          <span className="block mt-1.5 text-[8px] font-black text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 uppercase text-center tracking-wider">
                            ⚠️ Review Required
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {o.status === "Returned"
                          ? `₹${(o.refund_amount !== undefined && o.refund_amount !== null ? o.refund_amount : o.total).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-8 py-6 text-gray-600">
                        {o.status === "Returned"
                          ? (refundOptionDisplay[o.refundOption || ""] || o.refundOption || "Razorpay Gateway")
                          : "—"}
                      </td>
                      <td className="px-8 py-6 text-gray-500">
                        {o.returnDate
                          ? o.returnDate
                          : o.refunded_at
                          ? new Date(o.refunded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : o.date}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link
                          href={`/admindashboard/return-details?orderId=${o.id}`}
                          className="border border-gray-200 text-gray-600 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 hover:border-[#0a0a0a] inline-flex items-center gap-1"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-12">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 border border-gray-200 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Monthly Return Rate</p>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-headline font-black text-[#0a0a0a]">{returnRate}%</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  parseFloat(rateTrend) <= 0 ? "text-green-700" : "text-red-600"
                }`}>
                  {parseFloat(rateTrend) <= 0 ? "↓" : "↑"} {rateTrend}% vs last month
                </span>
              </div>
            </div>
            <div className="bg-white p-8 border border-gray-200 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Avg Resolution Time</p>
              <span className="text-3xl font-headline font-black text-[#0a0a0a]">{avgResolutionTime} Days</span>
            </div>
            <div className="bg-white p-8 border border-gray-200 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Completed Returns</p>
              <span className="text-3xl font-headline font-black text-[#0a0a0a]">{completedCount} Claims</span>
            </div>
          </div>

          {/* Charts Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Return Reasons Bar Chart */}
            <div className="bg-white p-8 border border-gray-200 shadow-sm lg:col-span-2 flex flex-col justify-between h-[360px]">
              <div>
                <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a] mb-1">Return Reasons</h4>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Most common arguments for returns</p>
              </div>
              <div className="flex-grow w-full relative pt-4">
                {reasonsChartData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 italic text-[10px]">
                    No return reasons logged.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={reasonsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                      <XAxis dataKey="reason" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#ccc" />
                      <YAxis tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="#ccc" />
                      <Tooltip contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e5e5e5" }} />
                      <Bar dataKey="count" fill="#BA7517" barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Refund Methods Donut Chart */}
            <div className="bg-white p-8 border border-gray-200 shadow-sm flex flex-col justify-between h-[360px]">
              <div>
                <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a] mb-1">Refund Splits</h4>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Proportion of store wallet vs bank gateway refunds</p>
              </div>
              <div className="flex-grow flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={refundSplitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {refundSplitData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e5e5e5" }}
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, "Amount"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 text-[9px] font-bold uppercase tracking-wider">
                {refundSplitData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="size-2 block" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-500">{item.name}</span>
                    </div>
                    <span className="text-[#0a0a0a]">₹{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Returns by Product Table */}
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
              <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a] mb-1">Returns by Design</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Designs flagged most frequently in return claims</p>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-white">
                  <th className="px-8 py-4">Design Name</th>
                  <th className="px-8 py-4">Units Flagged</th>
                  <th className="px-8 py-4 text-right">Value Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[10px] font-bold uppercase tracking-wider">
                {topReturnedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-6 text-center text-gray-400 italic">
                      No returns recorded yet.
                    </td>
                  </tr>
                ) : (
                  topReturnedProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-4 font-black text-[#0a0a0a]">{p.name}</td>
                      <td className="px-8 py-4 text-gray-600">{p.count} units</td>
                      <td className="px-8 py-4 text-right text-gray-900">₹{p.value.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Return Pickup Modal */}
      {modalType === "pickup" && targetOrder && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-left rounded-none animate-zoom-in">
            <div className="space-y-1 text-center">
              <h3 className="text-[14px] font-headline font-black text-primary uppercase">Schedule Return Pickup</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black">Order #{targetOrder.id}</p>
            </div>

            {modalError && (
              <div className="bg-red-50 text-red-600 border border-red-100 p-2 text-[10px] font-bold uppercase tracking-wider text-center">
                {modalError}
              </div>
            )}

            <div className="space-y-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">
              <p>Customer: <span className="text-[#0a0a0a]">{targetOrder.customer}</span></p>
              <div className="border border-gray-100 p-3 bg-gray-50/50">
                <p className="text-[8px] text-gray-400 mb-1">Pickup Address</p>
                <p className="text-[#0a0a0a] font-mono leading-relaxed normal-case">
                  {targetOrder.address_snapshot
                    ? `${targetOrder.address_snapshot.address}, ${targetOrder.address_snapshot.city}, ${targetOrder.address_snapshot.state} - ${targetOrder.address_snapshot.pincode}`
                    : "Address snapshots not captured. Using generic billing."}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setModalType(null);
                  setTargetOrder(null);
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest cursor-pointer rounded-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || (targetOrder && submitting === targetOrder.id)}
                onClick={handleApprovePickup}
                className={`flex-1 px-4 py-3 bg-primary text-white hover:bg-secondary text-[10px] font-black uppercase tracking-widest transition-colors rounded-none border-none font-bold ${(isSubmitting || (targetOrder && submitting === targetOrder.id)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isSubmitting ? "Scheduling..." : "Confirm Pickup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Return Request Modal */}
      {modalType === "reject" && targetOrder && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-red-200/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-left rounded-none animate-zoom-in">
            <div className="space-y-1 text-center">
              <h3 className="text-[14px] font-headline font-black text-red-600 uppercase">Reject Return Request</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black">Order #{targetOrder.id}</p>
            </div>

            {modalError && (
              <div className="bg-red-50 text-red-600 border border-red-100 p-2 text-[10px] font-bold uppercase tracking-wider text-center">
                {modalError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block">Reason for Rejection *</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Product tags were removed / signs of wash"
                className="w-full border border-gray-200 focus:border-red-600 focus:ring-0 font-bold text-xs py-3 px-4 rounded-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setModalType(null);
                  setTargetOrder(null);
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest cursor-pointer rounded-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || (targetOrder && submitting === targetOrder.id)}
                onClick={handleConfirmRejection}
                className={`flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase tracking-widest transition-colors rounded-none border-none font-bold ${(isSubmitting || (targetOrder && submitting === targetOrder.id)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isSubmitting ? "Processing..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Received Modal */}
      {modalType === "receive" && targetOrder && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-left rounded-none animate-zoom-in">
            <div className="space-y-1 text-center">
              <h3 className="text-[14px] font-headline font-black text-primary uppercase">Mark Return Received</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black">Order #{targetOrder.id}</p>
            </div>

            {modalError && (
              <div className="bg-red-50 text-red-600 border border-red-100 p-2 text-[10px] font-bold uppercase tracking-wider text-center">
                {modalError}
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 leading-relaxed">
              Confirming that the returned package has arrived at the warehouse. This will set the order status to <span className="text-[#0a0a0a]">"Returned"</span> and process the auto-refund routing.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#775a19]">
                  Quality Check Result:
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setQcPassed(true)}
                    className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest border transition-all text-center rounded-none cursor-pointer
                      ${qcPassed 
                        ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                  >
                    ✅ QC Passed
                  </button>
                  <button
                    type="button"
                    onClick={() => setQcPassed(false)}
                    className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest border transition-all text-center rounded-none cursor-pointer
                      ${!qcPassed 
                        ? 'bg-red-50 border-red-500 text-red-700 font-bold' 
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                  >
                    ❌ QC Failed
                  </button>
                </div>
              </div>

              {!qcPassed && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest block text-red-600">
                    Reason for QC failure (required):
                  </label>
                  <textarea
                    value={qcReason}
                    onChange={(e) => setQcReason(e.target.value)}
                    placeholder="Describe the damage or issue..."
                    className="w-full border border-red-200 p-3 text-xs resize-none h-20 outline-none focus:border-red-500 rounded-none bg-red-50/10 text-[#0a0a0a]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setModalType(null);
                  setTargetOrder(null);
                  setQcPassed(true);
                  setQcReason("");
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest cursor-pointer rounded-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || (targetOrder && submitting === targetOrder.id)}
                onClick={handleConfirmReceived}
                className={`flex-1 px-4 py-3 bg-green-600 text-white hover:bg-green-700 text-[10px] font-black uppercase tracking-widest transition-colors rounded-none border-none font-bold ${(isSubmitting || (targetOrder && submitting === targetOrder.id)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isSubmitting ? "Updating..." : "Mark Received & Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
