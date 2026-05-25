"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order } from "@/lib/registry";
import { db } from "@/lib/db";

export default function InvoicesLedgerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [billedRevenue, setBilledRevenue] = useState(0);
  const [activeInvoicesCount, setActiveInvoicesCount] = useState(0);

  useEffect(() => {
    loadInvoices();

    // Listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "registry_orders") {
        loadInvoices();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loadInvoices = async () => {
    const ordersList = await db.getOrders();
    setOrders(ordersList);

    // Sum billed revenues and count active invoices (exclude Returned or Cancelled)
    let revSum = 0;
    let actCount = 0;
    ordersList.forEach((o) => {
      if (o.status !== "Returned" && o.status !== "Cancelled") {
        revSum += o.total;
        actCount++;
      }
    });
    setBilledRevenue(revSum);
    setActiveInvoicesCount(actCount);
  };

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
            A comprehensive record of all customer order invoices.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => alert("Invoice CSV compilation initiated.")}
            className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none"
          >
            Export Invoices
          </button>
        </div>
      </header>

      {/* Statistics board panels */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Billed Revenue</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter">
            ₹{billedRevenue.toLocaleString("en-IN")}.00
          </h3>
          <p className="text-[9px] font-bold text-green-600 mt-1 uppercase tracking-widest">
            Excluding Returned/Cancelled Orders
          </p>
        </div>
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Active Invoices</p>
          <h3 className="text-3xl font-headline font-black tracking-tighter">{activeInvoicesCount}</h3>
          <p className="text-[9px] font-bold text-[#775a19] mt-1 uppercase tracking-widest">
            Authorized Transactions
          </p>
        </div>
      </section>

      {/* Invoice Ledger Table */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="px-8 py-6 font-black">Invoice ID</th>
                <th className="px-8 py-6 font-black">Generation Date</th>
                <th className="px-8 py-6 font-black">Entity / Customer</th>
                <th className="px-8 py-6 font-black">Total Amount</th>
                <th className="px-8 py-6 text-right font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-40">
                    No invoices generated in database registry.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
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
                    <td className="px-8 py-8 text-sm font-black font-headline text-primary">
                      ₹{order.total.toLocaleString("en-IN")}.00
                      {order.status === "Returned" && (
                        <span className="ml-2 inline-block text-[8px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-2.5 py-0.5 border border-red-200/50">
                          Refunded
                        </span>
                      )}
                      {order.status === "Cancelled" && (
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
    </div>
  );
}
