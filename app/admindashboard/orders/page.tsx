"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegistryManager, Order } from "@/lib/registry";

export default function OrdersLedgerPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentFilter, setCurrentFilter] = useState<"all" | "acquiring" | "manifested" | "returns" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    RegistryManager.init();
    loadOrders();

    // Listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "registry_orders") {
        loadOrders();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Reset selected IDs when filter or search changes
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [currentFilter, searchQuery]);

  const loadOrders = () => {
    setOrders(RegistryManager.getOrders());
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
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

  const handleBulkStatusChange = (newStatus: string) => {
    if (selectedOrderIds.length === 0) return;
    if (confirm(`Are you sure you want to change status to "${newStatus}" for the ${selectedOrderIds.length} selected order(s)?`)) {
      const allOrders = RegistryManager.getOrders();
      let count = 0;
      const updated = allOrders.map((o) => {
        if (selectedOrderIds.includes(o.id)) {
          count++;
          return { ...o, status: newStatus };
        }
        return o;
      });
      localStorage.setItem("registry_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      loadOrders();
      setSelectedOrderIds([]);
      alert(`Successfully updated status for ${count} order(s) to "${newStatus}".`);
    }
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
              onClick={() => handleBulkStatusChange("Shipped")}
              className="bg-secondary text-white hover:bg-white hover:text-primary border border-secondary hover:border-white px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer"
            >
              Ship Selected
            </button>
            <button
              onClick={() => handleBulkStatusChange("Delivered")}
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
                onClick={() => setCurrentFilter(filterKey)}
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
                    checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                    onChange={handleSelectAll}
                    className="accent-primary cursor-pointer size-4 align-middle"
                  />
                </th>
                <th className="px-8 py-6 font-black">Order ID</th>
                <th className="px-8 py-6 font-black">Order Date</th>
                <th className="px-8 py-6 font-black">Customer Name</th>
                <th className="px-8 py-6 font-black">Purchased Items</th>
                <th className="px-8 py-6 font-black">Grand Total</th>
                <th className="px-8 py-6 text-right font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-40">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
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
          {filteredOrders.length === 0 ? (
            <div className="px-8 py-20 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-40">
              No orders found.
            </div>
          ) : (
            filteredOrders.map((order) => (
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
    </div>
  );
}
