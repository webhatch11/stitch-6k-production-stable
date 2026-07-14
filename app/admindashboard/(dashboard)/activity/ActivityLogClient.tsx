"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  productLogs: any[];
  paymentLogs: any[];
  shippingLogs: any[];
}

export default function ActivityLogClient({ productLogs, paymentLogs, shippingLogs }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"products" | "payments" | "shipping">("products");

  const tabs = [
    { id: "products" as const, label: "Products", count: productLogs.length },
    { id: "payments" as const, label: "Payments", count: paymentLogs.length },
    { id: "shipping" as const, label: "Shipping", count: shippingLogs.length },
  ];

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      soft_delete: "bg-amber-100 text-amber-700",
      restore: "bg-green-100 text-green-700",
      permanent_delete: "bg-red-100 text-red-700",
    };
    return map[action] || "bg-gray-100 text-gray-700";
  };

  const formatTime = (ts: string) =>
    ts ? new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="p-8 lg:p-16">
      {/* Header */}
      <header className="mb-12">
        <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
          <span>Admin Panel</span>
          <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
          <span className="text-[#0a0a0a] italic">Activity Log</span>
        </nav>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Activity Log</h2>
            <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">Audit trail of admin actions across products, payments, and shipping.</p>
          </div>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0a] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#333] transition-all border-none cursor-pointer font-bold"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all bg-transparent cursor-pointer ${
              activeTab === tab.id
                ? "border-[#0a0a0a] text-[#0a0a0a] font-black"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className="bg-gray-100 text-gray-600 text-[9px] font-black rounded-full px-1.5 py-0.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div className="bg-white border border-gray-200 overflow-hidden">
          {productLogs.length === 0 ? (
            <div className="p-16 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">No activity recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left">Action</th>
                    <th className="px-6 py-4 text-left">Product</th>
                    <th className="px-6 py-4 text-left">Admin</th>
                    <th className="px-6 py-4 text-left">Time</th>
                    <th className="px-6 py-4 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productLogs.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-none ${actionBadge(log.action)}`}>
                          {log.action?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[11px] font-bold text-gray-900">{log.product_title || log.product_id || "—"}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">{log.product_id}</p>
                      </td>
                      <td className="px-6 py-4 text-[11px] text-gray-600">{log.admin_user_email || "system"}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-500 whitespace-nowrap">{formatTime(log.created_at)}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-500">{log.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="bg-white border border-gray-200 overflow-hidden">
          {paymentLogs.length === 0 ? (
            <div className="p-16 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">No activity recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left">Event</th>
                    <th className="px-6 py-4 text-left">Order ID</th>
                    <th className="px-6 py-4 text-left">Previous Status</th>
                    <th className="px-6 py-4 text-left">New Status</th>
                    <th className="px-6 py-4 text-left">Source</th>
                    <th className="px-6 py-4 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentLogs.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase tracking-widest">
                          payment
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[11px] font-mono text-gray-700">{log.order_id || "—"}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-500">{log.previous_status || "—"}</td>
                      <td className="px-6 py-4 text-[11px] font-bold text-gray-900">{log.new_status || "—"}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-500">{log.source || "—"}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-500 whitespace-nowrap">{formatTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Shipping Tab */}
      {activeTab === "shipping" && (
        <div className="bg-white border border-gray-200 overflow-hidden">
          {shippingLogs.length === 0 ? (
            <div className="p-16 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">No activity recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left">AWB</th>
                    <th className="px-6 py-4 text-left">Event</th>
                    <th className="px-6 py-4 text-left">Order ID</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shippingLogs.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-[11px] font-mono text-gray-700">{log.awb || log.shiprocket_id || log.tracking_number || "—"}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-black uppercase tracking-widest">
                          {log.event || log.action || "tracking"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[11px] font-mono text-gray-700">{log.order_id || "—"}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-700">{log.status || log.current_status || "—"}</td>
                      <td className="px-6 py-4 text-[11px] text-gray-500 whitespace-nowrap">{formatTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
