"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order } from "@/lib/types";
import { getOrdersAction } from "@/app/actions/admin-reads";
import { bulkUpdateOrderStatusAction } from "@/app/actions/admin-orders";

export default function OrdersLedgerPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "xlsx" | null>(null);
  const [currentFilter, setCurrentFilter] = useState<"all" | "acquiring" | "manifested" | "returns" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const handleFilterChange = (filter: "all" | "acquiring" | "manifested" | "returns" | "archived") => {
    setCurrentFilter(filter);
    setCurrentPage(1);
  };

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

  // Custom Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkStatusToApply, setBulkStatusToApply] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  // Reset selected IDs when filter or search changes
  useEffect(() => {
    setSelectedOrderIds([]);
    setCurrentPage(1);
  }, [currentFilter, searchQuery]);

  const loadOrders = async () => {
    const res = await getOrdersAction();
    if (!res.success) {
      triggerToast(res.error || "Failed to load orders");
      return;
    }
    setOrders(res.orders || []);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(paginatedOrders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds((prev) => [...prev, id]);
    } else {
      setSelectedOrderIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleBulkStatusChangeClick = (status: string) => {
    setBulkStatusToApply(status);
    setModalOpen(true);
  };

  const confirmBulkStatusChange = async () => {
    if (selectedOrderIds.length === 0 || !bulkStatusToApply) return;
    const res = await bulkUpdateOrderStatusAction(selectedOrderIds, bulkStatusToApply);
    if (!res.success) {
      triggerToast(res.error || "Bulk update failed");
      setModalOpen(false);
      setBulkStatusToApply("");
      return;
    }
    window.dispatchEvent(new Event("storage"));
    await loadOrders();
    setSelectedOrderIds([]);
    triggerToast(`Successfully updated status for ${res.count ?? selectedOrderIds.length} order(s) to "${bulkStatusToApply}".`);
    setModalOpen(false);
    setBulkStatusToApply("");
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("transit") || s === "shipped") return "bg-primary text-white";
    if (s.includes("audit") || s.includes("pending") || s.includes("processing") || s === "paid") {
      return "bg-[#fed488] text-primary font-bold";
    }
    if (s.includes("delivered")) return "bg-green-600 text-white";
    if (s.includes("returned") || s === "cancelled" || s.includes("rejected")) return "bg-red-600 text-white";
    return "bg-gray-400 text-white";
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    if (orders.length === 0) {
      triggerToast("No orders to export");
      return;
    }
    setExporting(true);
    setExportingFormat(format);
    try {
      const response = await fetch(`/api/admin/export/orders?format=${format}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `orders-${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast(`Orders exported to ${format.toUpperCase()} successfully`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || "Failed to export orders");
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  // Filter orders based on status tab and search query
  const filteredOrders = orders.filter((o) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = (o.id || "").toLowerCase().includes(q);
      const matchCustomer = (o.customer || "").toLowerCase().includes(q);
      if (!matchId && !matchCustomer) return false;
    }

    // Status tab filter
    const s = o.status.toLowerCase();
    if (currentFilter === "acquiring") {
      return s.includes("pending") || s.includes("processing") || s === "paid" || s.includes("dispatch") || s.includes("audit");
    }
    if (currentFilter === "manifested") {
      return s.includes("shipped") || s.includes("delivered") || (s.includes("transit") && !s.includes("return"));
    }
    if (currentFilter === "returns") {
      return s.includes("return requested") || s.includes("return in transit") || s.includes("return rejected");
    }
    if (currentFilter === "archived") {
      return s === "returned" || s === "cancelled";
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="p-8 lg:p-16">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Orders List</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Orders</h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            Manage customer orders and shipping status.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-secondary transition-colors">
              search
            </span>
            <input
              type="text"
              placeholder="Search order ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3.5 bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-widest focus:border-[#0a0a0a] focus:ring-0 outline-none w-full sm:w-72 shadow-sm rounded-none"
            />
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport("csv")}
            className="px-6 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary transition-colors border-none cursor-pointer disabled:opacity-50"
          >
            {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport("xlsx")}
            className="px-6 py-3 bg-secondary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-colors border-none cursor-pointer disabled:opacity-50"
          >
            {exportingFormat === "xlsx" ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </header>

      {/* Bulk Actions Panel */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-primary text-white p-6 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-none shadow-lg border border-white/10">
          <div className="text-[10px] font-black uppercase tracking-[0.2em]">
            {selectedOrderIds.length} Order(s) Selected
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleBulkStatusChangeClick("Shipped")}
              className="bg-secondary text-white hover:bg-white hover:text-primary border border-secondary hover:border-white px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer"
            >
              Ship Selected
            </button>
            <button
              onClick={() => handleBulkStatusChangeClick("Delivered")}
              className="bg-green-700 text-white hover:bg-white hover:text-primary border border-green-700 hover:border-white px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer"
            >
              Deliver Selected
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="bg-transparent text-white/70 hover:text-white border border-white/20 hover:border-white px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Order Ledger Table Container */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
        <div className="p-8 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[#fafafa]">
          <div className="flex gap-6 overflow-x-auto pb-2 sm:pb-0">
            {(["all", "acquiring", "manifested", "returns", "archived"] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => handleFilterChange(filterKey)}
                className={`text-[10px] font-black uppercase tracking-[0.3em] pb-2 whitespace-nowrap bg-transparent border-t-0 border-x-0 cursor-pointer transition-colors ${
                  currentFilter === filterKey
                    ? "text-[#0a0a0a] border-b-2 border-[#fed488]"
                    : "text-gray-400 hover:text-[#0a0a0a] border-b-2 border-transparent"
                }`}
              >
                {filterKey === "all"
                  ? "All Orders"
                  : filterKey === "acquiring"
                  ? "Pending"
                  : filterKey === "manifested"
                  ? "Shipped"
                  : filterKey === "returns"
                  ? "Returns"
                  : "Completed / Cancelled"}
              </button>
            ))}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic opacity-85">
            Showing {filteredOrders.length} orders
          </p>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="px-8 py-6 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrderIds.includes(o.id))}
                    onChange={handleSelectAll}
                    className="accent-primary cursor-pointer size-4 align-middle"
                  />
                </th>
                <th className="px-8 py-6 font-black">Order ID</th>
                <th className="px-8 py-6 font-black">Order Date</th>
                <th className="px-8 py-6 font-black">Customer Name</th>
                <th className="px-8 py-6 font-black">Purchased Items</th>
                <th className="px-8 py-6 font-black">Grand Total</th>
                <th className="px-8 py-6 font-black">Payment</th>
                <th className="px-8 py-6 text-right font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-40">
                    No orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admindashboard/order-details?orderId=${order.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-100 animate-fade-in"
                  >
                    <td className="px-8 py-8 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                        className="accent-primary cursor-pointer size-4 align-middle"
                      />
                    </td>
                    <td className="px-8 py-8 text-sm font-black font-headline text-primary group-hover:text-secondary transition-colors">
                      #{order.id}
                    </td>
                    <td className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {order.date}
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-tight">{order.customer}</span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Paid</span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-4">
                        <div className="size-10 bg-gray-50 border border-gray-100 p-1 flex items-center justify-center text-gray-300">
                          <span className="material-symbols-outlined text-lg opacity-40">inventory_2</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate max-w-[140px]">
                          {order.items[0]}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-sm font-black font-headline text-primary">
                      ₹{order.total.toLocaleString("en-IN")}.00
                    </td>
                    <td className="px-8 py-8" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2.5">
                        {(() => {
                          const wPaid = order.walletPaid || 0;
                          const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
                          const isPending = order.status.toLowerCase() === "payment pending";

                          if (isPending) {
                            return (
                              <span className="px-2.5 py-1 text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200/50">
                                ⏳ Awaiting Payment
                              </span>
                            );
                          }
                          if (gPaid === 0 && wPaid === 0) {
                            return (
                              <span className="px-2.5 py-1 text-[8px] font-black uppercase tracking-widest bg-gray-50 text-gray-500 border border-gray-200/50">
                                Free order
                              </span>
                            );
                          }

                          return (
                            <>
                              {gPaid > 0 && (
                                <span className="px-2.5 py-1 text-[8px] font-black uppercase tracking-widest bg-green-50 text-green-700 border border-green-200/50" title={`Gateway Payment ID: ${order.razorpay_payment_id || "N/A"}`}>
                                  Razorpay ₹{gPaid.toLocaleString("en-IN")}
                                </span>
                              )}
                              {wPaid > 0 && (
                                <span className="px-2.5 py-1 text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200/50">
                                  Wallet ₹{wPaid.toLocaleString("en-IN")}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-8 py-8 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        <span className={`inline-block px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-none ${getStatusStyle(order.status)}`}>
                          {order.status}
                        </span>
                        <Link
                          href={`/invoice?orderId=${order.id}`}
                          className="material-symbols-outlined text-gray-400 hover:text-[#775a19] transition-colors p-1"
                          title="View Invoice"
                        >
                          description
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Stacked Cards */}
        <div className="md:hidden divide-y divide-gray-200">
          {paginatedOrders.length === 0 ? (
            <div className="px-8 py-20 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-40">
              No orders found.
            </div>
          ) : (
            paginatedOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => router.push(`/admindashboard/order-details?orderId=${order.id}`)}
                className="p-6 hover:bg-gray-50 transition-all cursor-pointer flex flex-col gap-4 animate-fade-in"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                        className="accent-primary cursor-pointer size-4"
                      />
                    </div>
                    <span className="text-sm font-black font-headline text-primary">
                      #{order.id}
                    </span>
                  </div>
                  <span className={`inline-block px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-none ${getStatusStyle(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="text-primary font-black tracking-normal">{order.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="text-primary font-bold">{order.date}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-gray-400">inventory_2</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 truncate max-w-[150px]">
                      {order.items[0]}
                    </span>
                  </div>
                  <span className="text-xs font-black text-primary font-headline">
                    ₹{order.total.toLocaleString("en-IN")}.00
                  </span>
                </div>

                <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-3 pt-2">
                  <Link
                    href={`/invoice?orderId=${order.id}`}
                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-secondary border border-gray-200 px-3 py-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">description</span>
                    Invoice
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-gray-300 disabled:opacity-50 cursor-pointer hover:bg-gray-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-gray-600 px-4">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-gray-300 disabled:opacity-50 cursor-pointer hover:bg-gray-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      {/* Bulk Status Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-center rounded-none animate-zoom-in">
            <div className="mx-auto w-12 h-12 rounded-full border border-[#775a19]/20 bg-[#775a19]/5 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-xl">local_shipping</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-primary">Bulk Update Status</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
                Are you sure you want to change status to <span className="text-[#0a0a0a] font-black">"{bulkStatusToApply}"</span> for the {selectedOrderIds.length} selected order(s)?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setBulkStatusToApply("");
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkStatusChange}
                className="flex-1 bg-secondary text-white hover:bg-primary text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer rounded-none border-none font-bold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
