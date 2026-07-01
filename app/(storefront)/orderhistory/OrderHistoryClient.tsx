"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Order } from "@/lib/registry";
import { getUserOrdersAction, requestManualReturnAction } from "@/app/actions/orders";

interface OrderHistoryClientProps {
  initialOrders: Order[];
  userId: string;
}

export default function OrderHistoryClient({ initialOrders, userId }: OrderHistoryClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Return Modal states
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("Wrong size");
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
    const res = await getUserOrdersAction(userId);
    if (res.success && res.orders) {
      setOrders(res.orders);
    }
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

    const res = await requestManualReturnAction(selectedOrderId, payload);
    if (res.success) {
      triggerToast(`Return Request Submitted for #${selectedOrderId}`);
      handleCloseReturnModal();
      await loadOrders();
    } else {
      triggerToast(res.error || "Failed to submit return. Order may not be eligible.");
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[100] bg-on-surface text-surface py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-outline/25 animate-fade-in">
          {toastText}
        </div>
      )}

      {/* Main Order History Table */}
      <main className="pt-20 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex-grow w-full">
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
                    const statusLower = (order.status || "").toLowerCase();
                    let statusClass = "bg-stone-500/10 text-stone-700 border border-stone-500/20";
                    let statusDotClass = "bg-stone-500";

                    if (statusLower === "delivered") {
                      statusClass = "bg-green-500/10 text-green-700 border border-green-500/20";
                      statusDotClass = "bg-green-500";
                    } else if (statusLower === "returned" || statusLower === "return rejected" || statusLower === "failed") {
                      statusClass = "bg-red-500/10 text-red-600 border border-red-500/20";
                      statusDotClass = "bg-red-500";
                    } else if (statusLower === "return requested" || statusLower === "return in transit" || statusLower === "payment_pending" || statusLower === "payment pending") {
                      statusClass = "bg-amber-500/10 text-amber-700 border border-amber-500/20";
                      statusDotClass = "bg-amber-500";
                    } else if (statusLower === "paid via wallet" || statusLower === "paid" || statusLower === "shipped") {
                      statusClass = "bg-blue-500/10 text-blue-700 border border-blue-500/20";
                      statusDotClass = "bg-blue-500";
                    } else if (statusLower === "expired" || statusLower === "cancelled") {
                      statusClass = "bg-stone-500/10 text-stone-600 border border-stone-500/20";
                      statusDotClass = "bg-stone-400";
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
                              <Image
                                className="object-cover transition-transform duration-700 hover:scale-105"
                                src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"
                                alt={order.items[0]}
                                fill
                                sizes="64px"
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
                            {["Return Requested", "Return in Transit", "Returned"].includes(order.status) && (
                              <button
                                onClick={() => {
                                  setSelectedOrderId(order.id);
                                  setLabelModalOpen(true);
                                }}
                                className="inline-flex items-center justify-center bg-secondary text-white hover:bg-white hover:text-primary px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border border-secondary flex-1 md:flex-initial"
                              >
                                Return Label
                              </button>
                            )}
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
                  <option value="Wrong size">Wrong size</option>
                  <option value="Damaged item">Damaged item</option>
                  <option value="Defective product">Defective product</option>
                  <option value="Incorrect item">Incorrect item</option>
                  <option value="Other">Other</option>
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

      {labelModalOpen && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-md w-full border-t-2 border-t-secondary border-x border-b border-outline-variant/20 rounded-none shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="font-headline text-xl font-black uppercase tracking-tight mb-6 text-on-surface text-center">Fulfillment Return Label</h3>
            
            {/* Printable Area */}
            <div id="printable-return-label" className="border-2 border-double border-secondary p-6 space-y-6 bg-white text-neutral-900 select-none">
              <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                <span className="text-xs font-black tracking-widest">STITCH 6K ATELIER</span>
                <span className="text-[8px] font-black border border-neutral-800 px-1 py-0.5 uppercase tracking-widest">PREPAID</span>
              </div>

              {/* Barcode SVG */}
              <div className="text-center py-2">
                <svg width="220" height="50" className="mx-auto text-black">
                  <rect x="0" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="6" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="10" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="18" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="24" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="28" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="36" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="40" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="48" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="54" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="58" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="66" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="70" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="78" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="84" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="88" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="96" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="100" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="108" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="114" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="118" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="126" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="130" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="138" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="144" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="148" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="156" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="160" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="168" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="174" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="178" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="186" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="190" y="0" width="4" height="50" fill="currentColor"/>
                  <rect x="198" y="0" width="2" height="50" fill="currentColor"/>
                  <rect x="204" y="0" width="1" height="50" fill="currentColor"/>
                  <rect x="208" y="0" width="3" height="50" fill="currentColor"/>
                  <rect x="216" y="0" width="4" height="50" fill="currentColor"/>
                </svg>
                <span className="text-[8px] font-mono tracking-widest uppercase text-neutral-600 block mt-1">
                  AWB: RET-{orders.find(o => o.id === selectedOrderId)?.shiprocketId || "SR" + Math.floor(Math.random() * 900000 + 100000)}
                </span>
              </div>

              {/* Delivery Details */}
              <div className="grid grid-cols-2 gap-4 text-[9px] uppercase tracking-wider border-t border-b border-neutral-100 py-4 text-left">
                <div>
                  <span className="text-neutral-400 font-bold block mb-1">Return From:</span>
                  <span className="font-extrabold text-neutral-800">{orders.find(o => o.id === selectedOrderId)?.customer || "Atelier Guest"}</span>
                  <span className="block mt-0.5 text-neutral-600 font-medium">Order: #{selectedOrderId}</span>
                  <span className="block text-neutral-600 font-medium truncate">Reason: {orders.find(o => o.id === selectedOrderId)?.returnReason || "Wrong size"}</span>
                </div>
                <div>
                  <span className="text-neutral-400 font-bold block mb-1">Return To:</span>
                  <span className="font-extrabold text-neutral-800">JRT TEXTILES (6K Brand)</span>
                  <span className="block mt-0.5 text-neutral-600 font-medium">Returns Processing Unit</span>
                  <span className="block text-neutral-600 font-medium">Thillai Nagar, Tiruchirappalli - 620018, Tamil Nadu</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[8px] text-neutral-400 font-bold uppercase tracking-widest pt-2">
                <span>Weight: 0.40 KG</span>
                <span>Type: Reverse Logistics</span>
              </div>
            </div>

            {/* Print Controls */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setLabelModalOpen(false)}
                className="flex-grow border border-outline-variant/60 text-outline hover:text-on-surface py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-surface-container-low transition-all rounded-none bg-transparent cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-grow bg-secondary text-white hover:bg-on-surface py-4 text-[10px] font-black tracking-[0.2em] uppercase transition-all rounded-none border-none cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
