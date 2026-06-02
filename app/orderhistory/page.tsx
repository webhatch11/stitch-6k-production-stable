"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order } from "@/lib/registry";
import { db } from "@/lib/db";

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Return Modal states
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("Size does not fit");
  const [returnDetails, setReturnDetails] = useState("");
  const [refundOption, setRefundOption] = useState("bank");
  const [uploadedImageName, setUploadedImageName] = useState("");

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

  useEffect(() => {
    loadOrders();

    // Listen for storage events from admin or other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "registry_orders") {
        loadOrders();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const loadOrders = async () => {
    const list = await db.getOrders();
    setOrders(list);
  };

  // Helper date parser
  const getOrderDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Local Format: DD/MM/YYYY or DD-MM-YYYY
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]);
      const p2 = parseInt(parts[2]);
      if (p1 > 12) {
        return new Date(p2, p0 - 1, p1); // MM/DD/YYYY
      }
      return new Date(p2, p1 - 1, p0); // DD/MM/YYYY
    }

    const spaceParts = dateStr.replace(",", "").split(" ");
    if (spaceParts.length === 3) {
      let day = parseInt(spaceParts[0]);
      let monthStr = spaceParts[1].toLowerCase();
      let year = parseInt(spaceParts[2]);
      if (isNaN(day)) {
        monthStr = spaceParts[0].toLowerCase();
        day = parseInt(spaceParts[1]);
      }
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthIndex = months.findIndex((m) => monthStr.startsWith(m));
      if (monthIndex !== -1 && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthIndex, day);
      }
    }
    return new Date();
  };

  const isEligibleForReturn = (orderDateStr: string): boolean => {
    const orderDate = getOrderDate(orderDateStr);
    const today = new Date();
    orderDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  const handleOpenReturnModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setReturnReason("Size does not fit");
    setReturnDetails("");
    setRefundOption("bank");
    setUploadedImageName("");
    setReturnModalOpen(true);
  };

  const handleCloseReturnModal = () => {
    setReturnModalOpen(false);
    setSelectedOrderId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedImageName(e.target.files[0].name);
    }
  };

  const handleSubmitReturnRequest = async () => {
    if (!selectedOrderId) return;

    const payload = {
      reason: returnReason,
      details: returnDetails,
      image: uploadedImageName || "No image provided",
      refundOption: refundOption,
    };

    const success = await db.requestManualReturn(selectedOrderId, payload);
    if (success) {
      triggerToast(`Return Request Submitted for #${selectedOrderId}`);
      handleCloseReturnModal();
      await loadOrders();
    } else {
      triggerToast("Failed to submit return. Order may not be eligible.");
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[100] bg-on-surface text-surface py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-outline/25 animate-fade-in">
          {toastText}
        </div>
      )}

      {/* Top Announcement Scrolling Marquee */}
      <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] relative z-[60]">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
        </div>
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
              <div className="w-11 h-11 rounded-full bg-white p-1.5 flex items-center justify-center shadow-md border border-[#775a19]/15">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">Home</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/genz">GEN-Z</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/shopallshirts">Shop All</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-primary font-bold" href="/orderhistory">Order History</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/ordertracking">Track Order</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors">shopping_bag</Link>
            <Link href="/myprofile" className="material-symbols-outlined text-outline hover:text-primary transition-colors">person</Link>
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">admin_panel_settings</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="material-symbols-outlined md:hidden">menu</button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="flex flex-col mt-4 space-y-4 md:hidden">
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/">Home</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/genz">GEN-Z</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">Shop All</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest text-secondary font-bold" href="/orderhistory">Order History</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">Track Order</Link>
          </div>
        )}
      </header>

      {/* Main Order History Table */}
      <main className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex-grow w-full">
        <header className="mb-16">
          <div className="flex items-center gap-4 mb-4">
            <span className="w-12 h-px bg-secondary"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">Order Book</span>
          </div>
          <h1 className="font-headline text-5xl md:text-8xl font-black tracking-tighter uppercase mb-6 leading-none">
            Order<br />
            <span className="opacity-20">History</span>
          </h1>
          <p className="font-body text-outline text-sm max-w-2xl leading-relaxed uppercase tracking-wider font-semibold opacity-70">
            A complete record of your orders. Each entry represents a unique shirt from 6K Shirts.
          </p>
        </header>

        <section className="bg-transparent md:bg-white border-0 md:border md:border-outline-variant/10 md:shadow-2xl overflow-hidden rounded-none">
          <div className="overflow-x-auto md:overflow-visible">
            <table className="w-full text-left border-collapse block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="bg-surface-container-low border-b border-outline-variant/20">
                  <th className="px-8 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-outline">Order ID</th>
                  <th className="px-8 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-outline">Order Date</th>
                  <th className="px-8 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-outline">Product Details</th>
                  <th className="px-8 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-outline">Valuation</th>
                  <th className="px-8 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-outline">Logistics State</th>
                  <th className="px-8 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-outline text-right">Order Actions</th>
                </tr>
              </thead>

              <tbody id="historyBody" className="block md:table-row-group divide-y divide-outline-variant/10 font-label">
                {orders.length === 0 ? (
                  <tr className="flex flex-col md:table-row">
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="size-20 rounded-full bg-surface-container-low flex items-center justify-center border border-outline-variant/20 mb-6 text-secondary/60">
                          <span className="material-symbols-outlined text-4xl">inventory_2</span>
                        </div>
                        <h3 className="font-headline text-lg font-black uppercase tracking-tight text-on-surface mb-2">Order Archive Empty</h3>
                        <p className="text-xs text-outline leading-relaxed uppercase tracking-wider font-semibold opacity-70 mb-8">
                          You haven't placed any orders yet. Discover our premium collections hand-loomed in South India.
                        </p>
                        <Link
                          href="/shopallshirts"
                          className="w-full inline-flex items-center justify-center bg-on-surface hover:bg-secondary text-surface hover:text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-on-surface/10"
                        >
                          Start Exploring
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    // Badge styles
                    let statusClass = "bg-green-500/10 text-green-700 border border-green-500/20";
                    let statusDotClass = "bg-green-500";

                    if (order.status === "Delivered") {
                      statusClass = "bg-green-500/10 text-green-700 border border-green-500/20";
                      statusDotClass = "bg-green-500";
                    } else if (order.status === "Returned" || order.status === "Return Rejected") {
                      statusClass = "bg-red-500/10 text-red-600 border border-red-500/20";
                      statusDotClass = "bg-red-500";
                    } else if (order.status === "Return Requested" || order.status === "Return in Transit") {
                      statusClass = "bg-amber-500/10 text-amber-700 border border-amber-500/20";
                      statusDotClass = "bg-amber-500";
                    } else if (order.status === "Paid via Wallet" || order.status === "Paid") {
                      statusClass = "bg-blue-500/10 text-blue-700 border border-blue-500/20";
                      statusDotClass = "bg-blue-500";
                    } else {
                      statusClass = "bg-stone-500/10 text-stone-700 border border-stone-500/20";
                      statusDotClass = "bg-stone-500";
                    }

                    const returnEligible = order.status === "Delivered" && isEligibleForReturn(order.date);

                    return (
                      <tr
                        key={order.id}
                        className="flex flex-col md:table-row border border-outline-variant/10 md:border-0 mb-6 md:mb-0 bg-white md:bg-transparent shadow-sm md:shadow-none hover:bg-surface-container-lowest/50 transition-colors duration-300"
                      >
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex items-center justify-between md:block">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline md:hidden">Order ID</span>
                            <span className="font-headline font-black text-lg md:text-xl tracking-tight text-on-surface">#{order.id}</span>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex items-center justify-between md:block">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline md:hidden">Order Date</span>
                            <span className="text-xs font-semibold text-on-surface/80">{order.date.toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-20 bg-surface-container-high overflow-hidden border border-outline-variant/10 relative transition-transform duration-300 shrink-0">
                              <img
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                                src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"
                                alt={order.items[0]}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[8px] font-bold tracking-[0.2em] text-secondary/70 uppercase">ATELIER STITCH</span>
                              <p className="text-sm font-black text-on-surface uppercase tracking-wide leading-tight mt-0.5 truncate">{order.items[0]}</p>
                              <p className="text-[9px] text-outline uppercase tracking-wider font-semibold mt-1">Heritage Manufacture</p>
                              {order.status === "Return Rejected" && order.returnRejectReason && (
                                <div className="mt-2 text-[9px] text-red-600 font-bold uppercase tracking-widest bg-red-500/5 p-2 border border-red-500/10">
                                  Rejected: {order.returnRejectReason}
                                </div>
                              )}
                              {(order.status === "Returned" || order.status === "Return Requested" || order.status === "Return in Transit") && order.returnReason && (
                                <div className="mt-2 text-[9px] text-secondary font-bold uppercase tracking-widest bg-secondary-container/5 p-2 border border-secondary-container/10">
                                  Return: {order.returnReason}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex items-center justify-between md:block">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline md:hidden">Valuation</span>
                            <span className="font-headline font-extrabold text-base md:text-lg text-on-surface">₹{order.total.toLocaleString("en-IN")}</span>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex items-center justify-between md:block">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline md:hidden">Logistics State</span>
                            <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] ${statusClass} rounded-full backdrop-blur-sm`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass} mr-1.5`}></span>
                              {order.status}
                            </span>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 text-left md:text-right">
                          <div className="flex md:flex-col flex-wrap gap-2 md:items-end justify-start md:justify-end w-full">
                            <Link
                              href={`/invoice?orderId=${order.id}`}
                              className="inline-flex items-center justify-center bg-on-surface text-surface hover:bg-secondary hover:text-white px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border border-on-surface/10 flex-1 md:flex-initial"
                            >
                              View Invoice
                            </Link>
                            <Link
                              href={`/ordertracking?orderId=${order.id}`}
                              className="inline-flex items-center justify-center bg-transparent text-outline hover:text-on-surface px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border border-outline-variant/40 hover:border-on-surface/50 flex-1 md:flex-initial"
                            >
                              Track Shipment
                            </Link>
                            {returnEligible && (
                              <button
                                onClick={() => handleOpenReturnModal(order.id)}
                                className="inline-flex items-center justify-center bg-red-600/90 text-white px-4 py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all flex-1 md:flex-initial rounded-none"
                              >
                                Request Return
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Return Request Modal */}
      {returnModalOpen && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-lg w-full border-t-2 border-t-secondary border-x border-b border-outline-variant/20 rounded-none shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="font-headline text-2xl font-black uppercase tracking-tight mb-1 text-on-surface">Request Return</h3>
            <p className="text-[9px] text-outline mb-8 uppercase tracking-[0.2em] font-semibold">
              Order <span className="font-bold text-on-surface">#{selectedOrderId}</span>
            </p>

            <div className="space-y-6 mb-8">
              {/* Product Image Upload */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-outline mb-2">Product Image *</label>
                <div className="relative border border-dashed border-outline-variant/40 p-6 text-center cursor-pointer hover:border-secondary/60 transition-colors">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-outline/60 text-3xl mb-2">upload_file</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-outline">Upload Product Image *</span>
                    {uploadedImageName && (
                      <span className="text-[8px] font-bold text-secondary uppercase tracking-widest mt-2">
                        {uploadedImageName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Return Reason Select */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-outline mb-2">Reason for Return *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full border-b border-x-0 border-t-0 border-outline-variant/30 focus:border-secondary focus:ring-0 text-xs font-bold uppercase tracking-widest py-3 rounded-none bg-surface text-on-surface"
                >
                  <option value="Size does not fit">Size does not fit</option>
                  <option value="Quality not as expected">Quality not as expected</option>
                  <option value="Received incorrect item">Received incorrect item</option>
                  <option value="Changed my mind">Changed my mind</option>
                </select>
              </div>

              {/* Additional details */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-outline mb-2">Additional Details</label>
                <textarea
                  value={returnDetails}
                  onChange={(e) => setReturnDetails(e.target.value)}
                  rows={3}
                  className="w-full border-b border-x-0 border-t-0 border-outline-variant/30 focus:border-secondary focus:ring-0 text-xs py-3 rounded-none bg-surface text-on-surface"
                  placeholder="Please provide any other reasons or context..."
                />
              </div>

              {/* Refund Destination Option */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-outline mb-3">Refund Destination *</label>
                <div className="flex gap-4">
                  <label className={`flex items-center gap-3 cursor-pointer flex-1 border p-4 transition-all group ${refundOption === "bank" ? "border-secondary" : "border-outline-variant/20"}`}>
                    <input
                      type="radio"
                      name="refundOption"
                      value="bank"
                      checked={refundOption === "bank"}
                      onChange={() => setRefundOption("bank")}
                      className="text-secondary border-outline-variant/40 focus:ring-0 focus:ring-offset-0 rounded-none bg-transparent"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Bank Account</span>
                      <span className="text-[8px] text-outline uppercase tracking-wider font-semibold mt-0.5">3-5 Business Days</span>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 cursor-pointer flex-1 border p-4 transition-all group ${refundOption === "wallet" ? "border-secondary" : "border-outline-variant/20"}`}>
                    <input
                      type="radio"
                      name="refundOption"
                      value="wallet"
                      checked={refundOption === "wallet"}
                      onChange={() => setRefundOption("wallet")}
                      className="text-secondary border-outline-variant/40 focus:ring-0 focus:ring-offset-0 rounded-none bg-transparent"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Store Wallet</span>
                      <span className="text-[8px] text-outline uppercase tracking-wider font-semibold mt-0.5">Instant Refund</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCloseReturnModal}
                className="flex-1 border border-outline-variant/60 text-outline hover:text-on-surface py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-surface-container-low transition-all rounded-none bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReturnRequest}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 text-[10px] font-black tracking-[0.2em] uppercase transition-all rounded-none font-bold"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="h-8 w-auto object-contain"
                    draggable={false}
                  />
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K Shirts</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">© 2026 6K Shirts. Crafted in Tamil Nadu.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
