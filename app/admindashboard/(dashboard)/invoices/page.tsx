"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order } from "@/lib/types";
import { getOrdersAction } from "@/app/actions/admin-reads";
import {
  classifyOrderForInvoice,
  isBillableOrder,
  isReturnedInvoice,
  isCancelledInvoice,
  type InvoiceTab,
} from "@/lib/invoice-status";

export default function InvoicesLedgerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTab, setCurrentTab] = useState<InvoiceTab>("billed");

  // Analytics Metrics — only count invoice-eligible orders
  const [billedRevenue, setBilledRevenue] = useState(0);
  const [billedCount, setBilledCount] = useState(0);
  const [refundedValue, setRefundedValue] = useState(0);
  const [refundedCount, setRefundedCount] = useState(0);
  const [cancelledValue, setCancelledValue] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  // Toast notifications
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadInvoices();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "invoice_not_ready") {
        triggerToast("Invoice is not ready (payment not captured).");
      }
    }
  }, []);

  const loadInvoices = async () => {
    const res = await getOrdersAction();
    if (!res.success) {
      triggerToast(res.error || "Failed to load orders");
      return;
    }
    const ordersList = res.orders || [];
    setOrders(ordersList);

    let billedSum = 0;
    let billedCt = 0;
    let refundedSum = 0;
    let refundedCt = 0;
    let cancelledSum = 0;
    let cancelledCt = 0;

    ordersList.forEach((o) => {
      const tab = classifyOrderForInvoice(o.status);
      if (tab === "billed") {
        billedSum += o.total;
        billedCt++;
      } else if (tab === "returned") {
        refundedSum += o.total;
        refundedCt++;
      } else if (tab === "cancelled") {
        cancelledSum += o.total;
        cancelledCt++;
      }
      // tab === "none" → Payment Pending / FAILED / Payment Review Required
      // — deliberately excluded from all metrics
    });

    setBilledRevenue(billedSum);
    setBilledCount(billedCt);
    setRefundedValue(refundedSum);
    setRefundedCount(refundedCt);
    setCancelledValue(cancelledSum);
    setCancelledCount(cancelledCt);
  };

  /** Filter orders for the active tab using the shared classifier. */
  const filteredOrders = orders.filter(
    (o) => classifyOrderForInvoice(o.status) === currentTab
  );

  return (
    <div className="p-8 lg:p-16">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Invoice Archive</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Invoices</h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            A comprehensive record of all completed customer order invoices.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => triggerToast("Invoice CSV compilation initiated.")}
            className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none"
          >
            Export Invoices
          </button>
        </div>
      </header>

      {/* Statistics board panels — Payment Pending orders excluded from all metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Billed Revenue</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter">
            ₹{billedRevenue.toLocaleString("en-IN")}.00
          </h3>
          <p className="text-[9px] font-bold text-green-600 mt-1 uppercase tracking-widest">
            {billedCount} Active Transactions
          </p>
        </div>
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Refunded Value</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter">
            ₹{refundedValue.toLocaleString("en-IN")}.00
          </h3>
          <p className="text-[9px] font-bold text-red-600 mt-1 uppercase tracking-widest">
            {refundedCount} Returned Transactions
          </p>
        </div>
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Voided Value</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter">
            ₹{cancelledValue.toLocaleString("en-IN")}.00
          </h3>
          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
            {cancelledCount} Cancelled Transactions
          </p>
        </div>
      </section>

      {/* Invoice Ledger Table */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
        <div className="p-8 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[#fafafa]">
          <div className="flex gap-6 overflow-x-auto pb-2 sm:pb-0">
            {(["billed", "returned", "cancelled"] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setCurrentTab(tabKey)}
                className={`text-[10px] font-black uppercase tracking-[0.3em] pb-2 whitespace-nowrap bg-transparent border-t-0 border-x-0 cursor-pointer transition-colors ${
                  currentTab === tabKey
                    ? "text-[#0a0a0a] border-b-2 border-[#fed488]"
                    : "text-gray-400 hover:text-[#0a0a0a] border-b-2 border-transparent"
                }`}
              >
                {tabKey === "billed"
                  ? "Billed Invoices"
                  : tabKey === "returned"
                  ? "Returned Invoices"
                  : "Cancelled Invoices"}
              </button>
            ))}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic opacity-85">
            Showing {filteredOrders.length} invoices
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="px-8 py-6 font-black">Invoice ID</th>
                <th className="px-8 py-6 font-black">Generation Date</th>
                <th className="px-8 py-6 font-black">Entity / Customer</th>
                <th className="px-8 py-6 font-black">Status</th>
                <th className="px-8 py-6 font-black">Total Amount</th>
                <th className="px-8 py-6 text-right font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-40">
                    No {currentTab} invoices in the registry.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#f9fafb] transition-colors border-b border-gray-100">
                    <td className="px-8 py-8 text-sm font-black font-headline text-primary">
                      #INV-{order.id}
                    </td>
                    <td className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {order.date}
                    </td>
                    <td className="px-8 py-8">
                      <span className="text-[11px] font-black uppercase tracking-tight">{order.customer}</span>
                    </td>
                    <td className="px-8 py-8">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border border-gray-200 text-gray-600">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-8 py-8 text-sm font-black font-headline text-primary">
                      ₹{order.total.toLocaleString("en-IN")}.00
                      {order.status === "Returned" && (
                        <span className="ml-2 inline-block text-[8px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-2.5 py-0.5 border border-red-200/50">
                          Refunded
                        </span>
                      )}
                      {isCancelledInvoice(order.status) && (
                        <span className="ml-2 inline-block text-[8px] font-black uppercase tracking-widest bg-gray-50 text-gray-500 px-2.5 py-0.5 border border-gray-200/50">
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-8 text-right">
                      <Link
                        href={`/invoice?orderId=${order.id}`}
                        className="inline-block bg-primary text-white px-6 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-secondary transition-colors rounded-none"
                      >
                        View Invoice
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}
    </div>
  );
}
