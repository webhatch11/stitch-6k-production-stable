"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order, Product } from "@/lib/registry";
import { getDashboardMetricsAction, getOrdersAction, getProductsAction } from "@/app/actions/admin-reads";
import { deleteProductAction } from "@/app/actions/admin-products";
import { bulkUpdateOrderStatusAction, processReturnRefundAction } from "@/app/actions/admin-orders";

export default function AdminDashboardPage() {
  // Metrics
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    creditRevenue: 0,
    inventoryCount: 0,
    totalStock: 0,
    walletLiability: 0,
    conversion: "4.2%",
  });

  // Data Arrays
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Toast Alerts
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Delete Confirmation States
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [deleteProductTitle, setDeleteProductTitle] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadAdminData();

    // Listen for storage updates
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "registry_orders" ||
        e.key === "registry_products" ||
        e.key === "registry_wallet_balance"
      ) {
        loadAdminData();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loadAdminData = async () => {
    const metricsRes = await getDashboardMetricsAction();
    if (metricsRes.success && metricsRes.metrics) setMetrics(metricsRes.metrics);
    const ordersRes = await getOrdersAction();
    if (ordersRes.success) setOrders(ordersRes.orders || []);
    const productsRes = await getProductsAction();
    if (productsRes.success) setProducts(productsRes.products || []);
  };

  const handleDeleteProductClick = (p: Product) => {
    setDeleteProductId(p.id);
    setDeleteProductTitle(p.title);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductId) return;
    const res = await deleteProductAction(deleteProductId);
    if (!res.success) {
      triggerToast(res.error || "Failed to remove product");
      return;
    }
    triggerToast("Item removed");
    setDeleteProductId(null);
    setDeleteProductTitle(null);
    await loadAdminData();
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    const res = await bulkUpdateOrderStatusAction([orderId], nextStatus);
    if (res.success) {
      triggerToast(`Order #${orderId} status set to ${nextStatus}`);
      await loadAdminData();
    } else {
      triggerToast(res.error || "Failed to update status");
    }
  };

  const handleApproveReturn = async (orderId: string) => {
    const res = await processReturnRefundAction(orderId, true);
    if (res.success) {
      triggerToast(`Return Refund Processed for #${orderId}`);
      await loadAdminData();
    } else {
      triggerToast(res.error || "Failed to process refund");
    }
  };

  const lowStockProducts = products.filter((p) => (p.stock || 0) <= 15);

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Shop Summary</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Dashboard</h2>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto overflow-x-auto pb-4 lg:pb-0 font-bold">
          <div className="bg-white border border-gray-200 px-6 py-3 shadow-sm flex items-center gap-4 whitespace-nowrap">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Current Cycle</p>
              <p className="text-xs font-bold font-headline text-[#0a0a0a]">OCT 24, 2026</p>
            </div>
            <span className="material-symbols-outlined text-gray-500">calendar_today</span>
          </div>
          <button className="bg-[#0a0a0a] text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all shadow-lg whitespace-nowrap">
            Export Sales Report
          </button>
        </div>
      </header>

      {/* Metrics matrices */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {/* Revenue */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#fed488]/5 -translate-y-12 translate-x-12 rounded-full transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-4">Net Sales Revenue</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter text-[#0a0a0a]">
              ₹{metrics.totalRevenue.toLocaleString("en-IN")}
            </h3>
            
            {/* Split of Revenue from Cash and Credit */}
            <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">Cash Revenue</p>
                <p className="text-sm font-bold text-green-700 font-headline mt-0.5">
                  ₹{(metrics.cashRevenue || 0).toLocaleString("en-IN")}
                </p>
                <span className="text-[8px] text-gray-400 font-bold uppercase">(Gateway)</span>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">Credit Revenue</p>
                <p className="text-sm font-bold text-blue-700 font-headline mt-0.5">
                  ₹{(metrics.creditRevenue || 0).toLocaleString("en-IN")}
                </p>
                <span className="text-[8px] text-gray-400 font-bold uppercase">(Wallet)</span>
              </div>
            </div>

            {/* Credit Hold in User Accounts */}
            <div className="text-[10px] font-bold text-gray-500 mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3">
              <span className="material-symbols-outlined text-xs text-orange-500">lock</span>
              <span>Credit Hold:</span>
              <span className="text-orange-600 font-black ml-auto">
                ₹{metrics.walletLiability.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Orders count */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-6">Total Orders</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter">{metrics.totalOrders}</h3>
            <p className="text-[10px] font-bold text-[#0a0a0a] mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">shopping_cart</span> Active Orders
            </p>
          </div>
        </div>

        {/* Inventory count */}
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-6">Total Inventory</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter">
              {metrics.totalStock || 0} <span className="text-xs text-gray-400 font-normal">units</span>
            </h3>
            <p className="text-[10px] font-bold text-[#775a19] mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">inventory</span> {metrics.inventoryCount} Unique Designs
            </p>
          </div>
        </div>
      </section>

      {/* Dynamic Lists panels */}
      <div className="grid grid-cols-1 gap-12">
        {/* Recent Orders table */}
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-[#fafafa]">
            <div>
              <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-[#0a0a0a]">Recent Orders</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
                Managing your latest sales activity.
              </p>
            </div>
            <Link
              href="/admindashboard/orders"
              className="text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#0a0a0a] flex items-center gap-1 transition-colors"
            >
              View All Orders <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-white">
                  <th className="px-8 py-6 font-black uppercase">Order ID</th>
                  <th className="px-8 py-6 font-black uppercase">Customer Name</th>
                  <th className="px-8 py-6 font-black uppercase">Ordered Items</th>
                  <th className="px-8 py-6 font-black uppercase">Valuation</th>
                  <th className="px-8 py-6 font-black uppercase">Current Logistics Status</th>
                  <th className="px-8 py-6 font-black text-right">Quick State Transitions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs font-label">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">
                      No orders recorded in database registry.
                    </td>
                  </tr>
                ) : (
                  orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6 font-bold font-headline text-[#0a0a0a]">#{order.id}</td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold">{order.customer}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase">Store user</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 truncate max-w-[150px]">{order.items[0]}</td>
                      <td className="px-8 py-6 font-bold">₹{order.total.toLocaleString("en-IN")}</td>
                      <td className="px-8 py-6">
                        <span className="inline-block px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-[#0a0a0a] text-white">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {order.status === "Paid" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "Delivered")}
                              className="bg-green-600 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 cursor-pointer"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {order.status === "Return Requested" && (
                            <button
                              onClick={() => handleApproveReturn(order.id)}
                              className="bg-red-600 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 cursor-pointer"
                            >
                              Process Refund Return
                            </button>
                          )}
                          <Link
                            href={`/admindashboard/order-details?orderId=${order.id}`}
                            className="border border-gray-300 hover:border-[#0a0a0a] text-gray-700 hover:text-[#0a0a0a] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 flex items-center gap-1"
                          >
                            Details <span className="material-symbols-outlined text-xs">arrow_forward</span>
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

        {/* Active Product Inventory table */}
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden mb-16">
          <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-[#fafafa]">
            <div>
              <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-[#0a0a0a]">Low Stock Warnings</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
                Active products requiring immediate restock (15 or fewer units remaining).
              </p>
            </div>
            <Link
              href="/admindashboard/inventory"
              className="text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#0a0a0a] flex items-center gap-1 transition-colors"
            >
              Manage Inventory <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[.2em] text-gray-500 border-b border-gray-200 bg-white">
                  <th className="px-8 py-6 font-black uppercase">Product</th>
                  <th className="px-8 py-6 font-black uppercase">Category</th>
                  <th className="px-8 py-6 font-black uppercase">Price</th>
                  <th className="px-8 py-6 font-black uppercase">Stock Status</th>
                  <th className="px-8 py-6 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs font-label">
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-green-700 font-bold bg-green-50/20 italic">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                        <span>All active products are well stocked (greater than 15 units).</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.slice(0, 8).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="size-10 bg-gray-50 overflow-hidden border border-gray-200 grayscale p-1 flex items-center justify-center">
                            <img src={p.image} className="w-full h-full object-cover" alt={p.title} />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-tight font-bold">{p.title}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-gray-500 uppercase tracking-widest font-bold text-[9px]">{p.category}</td>
                      <td className="px-8 py-6 font-bold">₹{p.price.toLocaleString("en-IN")}</td>
                      <td className="px-8 py-6">
                        <span
                          className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${
                            (p.stock || 0) <= 5 
                              ? "bg-red-50 text-red-700 border border-red-200" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {(p.stock || 0) <= 5 ? "error" : "warning"}
                          </span>
                          <span>{p.stock || 0} in stock</span>
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admindashboard/add-product?edit=${p.id}`}
                            className="material-symbols-outlined text-gray-400 hover:text-[#775a19] p-1 transition-colors flex items-center justify-center"
                            title="Edit"
                          >
                            edit
                          </Link>
                          <button
                            onClick={() => handleDeleteProductClick(p)}
                            className="material-symbols-outlined text-gray-400 hover:text-red-600 bg-transparent border-none p-1 cursor-pointer transition-colors flex items-center justify-center"
                            title="Delete"
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {deleteProductId && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-center rounded-none animate-zoom-in">
            <div className="mx-auto w-12 h-12 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined text-xl">delete</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-primary">Remove Product</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
                Are you sure you want to remove <span className="text-[#0a0a0a] font-black">"{deleteProductTitle}"</span> from the inventory?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteProductId(null);
                  setDeleteProductTitle(null);
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none border-none font-bold"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
