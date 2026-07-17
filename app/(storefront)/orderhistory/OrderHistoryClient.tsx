"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Order } from "@/lib/types";
import { getUserOrdersAction, requestManualReturnAction } from "@/app/actions/orders";
import { trackRefund } from "@/lib/analytics";

interface OrderHistoryClientProps {
  initialOrders: Order[];
  userId: string;
}

export default function OrderHistoryClient({ initialOrders, userId }: OrderHistoryClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [isLoading, setIsLoading] = useState(true);

  // Return Modal states
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("Wrong size");
  const [returnDetails, setReturnDetails] = useState("");
  const [refundOption, setRefundOption] = useState("wallet");
  const [uploadedImageName, setUploadedImageName] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

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
    setIsLoading(false);
  }, []);



  useEffect(() => {
    orders.forEach((order) => {
      const refundAmt = order.refund_amount || (order as any).refundAmount || 0;
      if (order.status === "Returned" && refundAmt > 0) {
        const sessionKey = `tracked_refund_${order.id}`;
        if (typeof window !== "undefined" && !sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "true");
          const mappedItems = order.cartItems && order.cartItems.length > 0
            ? order.cartItems.map((item: any) => ({
                productId: item.productId || item.product_id,
                productName: item.productName || item.title || item.name,
                price: item.price,
                quantity: item.quantity || 1
              }))
            : (order.items || []).map((name, idx) => ({
                productId: `${order.id}-item-${idx}`,
                productName: name,
                price: refundAmt / (order.items.length || 1),
                quantity: 1
              }));
          
          trackRefund({
            orderId: order.id,
            total: refundAmt,
            items: mappedItems
          });
        }
      }
    });
  }, [orders]);

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

  const isEligibleForReturn = (order: Order): boolean => {
    if (order.status !== "Delivered") return false;
    const deliveredAtStr = order.deliveredAt || (order as any).delivered_at;
    if (!deliveredAtStr) {
      return true;
    }
    const deliveredAt = new Date(deliveredAtStr);
    const today = new Date();
    deliveredAt.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - deliveredAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  const handleOpenReturnModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setReturnReason("Size does not fit");
    setReturnDetails("");
    // Smart-default: if the order had any gateway payment, default to "bank";
    // wallet-only orders default to "wallet" so refund goes back to wallet.
    const orderForModal = orders.find((o) => o.id === orderId);
    setRefundOption(
      orderForModal && orderForModal.gatewayPaid > 0 ? "bank" : "wallet"
    );
    setUploadedImageName("");
    setReturnModalOpen(true);
  };

  const handleCloseReturnModal = () => {
    setReturnModalOpen(false);
    setSelectedOrderId(null);
    setUploadedImageUrl("");
    setUploadedImageName("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedImageName(file.name);
      setUploadingImage(true);
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "stitch6k_products").replace(/"/g, ""));
        
        const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "qc0yrj1o").replace(/"/g, "");
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });
        
        if (res.ok) {
          const data = await res.json();
          setUploadedImageUrl(data.secure_url);
          triggerToast("Image uploaded successfully!");
        } else {
          console.error("Cloudinary upload failed:", await res.text());
          triggerToast("Failed to upload image. Using local filename fallback.");
        }
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        triggerToast("Upload failed due to network error.");
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSubmitReturnRequest = async () => {
    if (!selectedOrderId) return;

    const payload = {
      reason: returnReason,
      details: returnDetails,
      image: uploadedImageName || "No image provided",
      refundOption: refundOption,
      imageUrl: uploadedImageUrl || undefined
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

        {isLoading ? (
          <div className="space-y-4 animate-pulse p-8 bg-white border border-outline-variant/10 shadow-2xl rounded-none">
            <div className="h-16 bg-neutral-200 rounded"></div>
            <div className="h-16 bg-neutral-200 rounded"></div>
            <div className="h-16 bg-neutral-200 rounded"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24 px-8 bg-white border border-outline-variant/10 shadow-2xl rounded-none">
            <div className="text-6xl mb-6">🛍️</div>
            <h3 className="text-xl font-bold mb-3">No orders yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
            <Link
              href="/shopallshirts"
              className="inline-block bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors"
            >
              Shop Now
            </Link>
          </div>
        ) : (
          <section className="bg-transparent md:bg-white border-0 md:border md:border-outline-variant/10 md:shadow-2xl overflow-hidden rounded-none">
            <style dangerouslySetInnerHTML={{ __html: `
              .custom-scrollbar::-webkit-scrollbar {
                height: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background-color: rgba(0, 0, 0, 0.15);
                border-radius: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: rgba(0, 0, 0, 0.3);
              }
            `}} />
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse hidden md:table">
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
                <tbody id="historyBody" className="hidden md:table-row-group divide-y divide-outline-variant/10 font-label">
                  {orders.map((order) => {
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

                    const returnEligible = isEligibleForReturn(order);

                    return (
                      <tr
                        key={order.id}
                      className="hidden md:table-row border border-outline-variant/10 md:border-0 mb-6 md:mb-0 bg-white md:bg-transparent shadow-sm md:shadow-none hover:bg-surface-container-lowest/50 transition-colors duration-300"
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
                          <div className="flex flex-col gap-4">
                            {(order.cartItems && order.cartItems.length > 0 ? order.cartItems : (order.items || []).map((name, idx) => ({ productName: name, productId: `${order.id}-item-${idx}`, price: 0, quantity: 1 }))).map((item: any, idx: number) => {
                              const img = item.image;
                              return (
                                <div key={idx} className="flex items-start gap-4">
                                  {img ? (
                                    <div className="w-16 h-20 bg-surface-container-high overflow-hidden border border-outline-variant/10 relative transition-transform duration-300 shrink-0">
                                      <Image
                                        className="object-cover transition-transform duration-700 hover:scale-105"
                                        src={img}
                                        alt={item.productName || "Shirt"}
                                        fill
                                        sizes="64px"
                                      />
                                      {item.quantity > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black text-white text-[8px] font-black px-1.5 py-0.5 tracking-tighter text-center min-w-[14px]">
                                          {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-16 h-20 bg-surface-container-high overflow-hidden border border-outline-variant/10 relative transition-transform duration-300 shrink-0 flex items-center justify-center text-2xl" style={{ backgroundColor: '#f5f5f5' }}>
                                      👕
                                      {item.quantity > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black text-white text-[8px] font-black px-1.5 py-0.5 tracking-tighter text-center min-w-[14px]">
                                          {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[9px] font-bold tracking-[0.2em] text-secondary/70 uppercase">6K COLLECTION</span>
                                    <p className="text-xs font-black text-on-surface uppercase tracking-wide leading-tight mt-0.5 truncate">{item.productName}</p>
                                    <div className="flex gap-2 mt-1 items-center">
                                      {item.size && (
                                        <span className="text-[8px] font-bold bg-neutral-100 text-neutral-600 px-1 py-0.5 uppercase">Size: {item.size}</span>
                                      )}
                                      {item.color && (
                                        <span className="text-[8px] font-bold bg-neutral-100 text-neutral-600 px-1 py-0.5 uppercase">Color: {item.color}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="pt-2 border-t border-outline-variant/5">
                              <p className="text-[9px] text-outline uppercase tracking-wider font-semibold">Premium Quality</p>
                              {/* Return Eligibility Banner */}
                              {order.status === "Delivered" && (() => {
                                const deliveredAtStr = order.deliveredAt || (order as any).delivered_at;
                                if (!deliveredAtStr) {
                                  return null;
                                }
                                const eligible = isEligibleForReturn(order);
                                if (eligible) {
                                  const deliveredDate = new Date(deliveredAtStr);
                                  const today = new Date();
                                  deliveredDate.setHours(0, 0, 0, 0);
                                  today.setHours(0, 0, 0, 0);
                                  const daysSince = Math.floor((today.getTime() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
                                  const daysLeft = 7 - daysSince;
                                  const deadline = new Date(deliveredAtStr);
                                  deadline.setDate(deadline.getDate() + 7);
                                  const deadlineStr = deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                                  
                                  const daysLeftText = daysLeft > 0 
                                    ? ` — ${daysLeft} day${daysLeft > 1 ? 's' : ''} left` 
                                    : '';
                                  return (
                                    <div className="mt-2 text-[9px] text-green-700 font-bold uppercase tracking-widest bg-green-500/5 p-2 border border-green-500/10">
                                      Return eligible{daysLeftText} (until {deadlineStr})
                                    </div>
                                  );
                                } else {
                                  const deliveredAt = new Date(deliveredAtStr);
                                  const today = new Date();
                                  deliveredAt.setHours(0, 0, 0, 0);
                                  today.setHours(0, 0, 0, 0);
                                  const diffDays = Math.floor((today.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24));
                                  return (
                                    <div className="mt-2 text-[9px] text-stone-500 font-bold uppercase tracking-widest bg-stone-500/5 p-2 border border-stone-500/10">
                                      Return window closed (delivered {diffDays} days ago)
                                    </div>
                                  );
                                }
                              })()}

                              {/* Returns timeline */}
                              {["Return Requested", "Return in Transit", "Returned", "Return Rejected"].includes(order.status) && (
                                <div className="mt-4 border border-[#e5e5e5]/60 p-4 bg-gray-50/50 space-y-4 rounded-none text-left">
                                  <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-[#0a0a0a] border-b border-gray-100 pb-1.5">Return Status Timeline</h4>
                                  
                                  <div className="flex flex-col gap-3 relative pl-3.5 border-l border-gray-200">
                                    {/* Step 1: Requested */}
                                    <div className="relative">
                                      <span className="absolute -left-[20px] top-1 w-2 h-2 rounded-full bg-primary" />
                                      <p className="text-[9px] font-bold uppercase text-gray-800">Return Requested</p>
                                      <p className="text-[11px] text-gray-400 font-mono">{order.returnRequestDate || order.date}</p>
                                    </div>

                                    {/* Step 2: Pickup Scheduled */}
                                    {(order.returnPickupScheduled || (order as any).return_pickup_scheduled || order.status === "Return in Transit" || order.status === "Returned") && (
                                      <div className="relative">
                                        <span className={`absolute -left-[20px] top-1 w-2 h-2 rounded-full ${order.status !== "Return Requested" ? "bg-primary" : "bg-gray-300"}`} />
                                        <p className="text-[9px] font-bold uppercase text-gray-800">Pickup Scheduled</p>
                                        <p className="text-[11px] text-gray-400 font-mono">
                                          {order.returnPickupScheduled || (order as any).return_pickup_scheduled
                                            ? new Date(order.returnPickupScheduled || (order as any).return_pickup_scheduled).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                            : "Awaiting partner confirmation"}
                                        </p>
                                      </div>
                                    )}

                                    {/* Step 3: Refund Processed */}
                                    {order.status === "Returned" && (
                                      <div className="relative">
                                        <span className="absolute -left-[20px] top-1 w-2 h-2 rounded-full bg-primary" />
                                        <p className="text-[9px] font-bold uppercase text-gray-800">Refund Processed</p>
                                        <p className="text-[11px] text-gray-400 font-mono">{order.returnDate || "Completed"}</p>
                                      </div>
                                    )}

                                    {/* Step 4: Rejected */}
                                    {order.status === "Return Rejected" && (
                                      <div className="relative">
                                        <span className="absolute -left-[20px] top-1 w-2 h-2 rounded-full bg-red-600" />
                                        <p className="text-[9px] font-bold uppercase text-red-600">Return Rejected</p>
                                        <p className="text-[11px] text-gray-400 font-mono">Reason: "{order.returnRejectReason}"</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Return Details metadata */}
                                  <div className="pt-2.5 border-t border-gray-200/60 text-[9px] font-bold text-gray-500 space-y-1.5">
                                    {order.returnAwb || (order as any).return_awb ? (
                                      <p className="uppercase">Return AWB: <span className="text-[#0a0a0a] font-mono">{order.returnAwb || (order as any).return_awb}</span></p>
                                    ) : null}
                                    {order.returnPickupScheduled || (order as any).return_pickup_scheduled ? (() => {
                                      const pickupDate = new Date(order.returnPickupScheduled || (order as any).return_pickup_scheduled);
                                      const estRefund = new Date(pickupDate);
                                      estRefund.setDate(estRefund.getDate() + 7);
                                      return (
                                        <p className="uppercase">Expected Refund: <span className="text-[#0a0a0a] font-mono">{estRefund.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></p>
                                      );
                                    })() : null}
                                    <p className="pt-1 text-[11px] tracking-wide text-gray-400">Taking too long? <a href="/contact" className="text-primary underline">Contact Support</a></p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex flex-col gap-1.5 text-xs text-on-surface">
                            <div className="flex justify-between md:gap-4 items-center">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline">Items</span>
                              <span className="font-medium text-right max-w-[150px] truncate">{order.items.join(", ")}</span>
                            </div>
                            {order.couponDiscount !== undefined && order.couponDiscount > 0 && (
                              <div className="flex justify-between md:gap-4 items-center text-green-700">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Coupon ({order.couponCode || "ACTIVE"})</span>
                                <span>-₹{order.couponDiscount.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                            {order.pointsDiscount !== undefined && order.pointsDiscount > 0 && (
                              <div className="flex justify-between md:gap-4 items-center text-green-700">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Points ({order.pointsRedeemed || 0} pts)</span>
                                <span>-₹{order.pointsDiscount.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                            <div className="flex justify-between md:gap-4 items-center">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline">Shipping</span>
                              <span className="font-bold text-green-700 uppercase tracking-wider">
                                {order.shippingAmount === 0 || !order.shippingAmount ? "Free" : `₹${order.shippingAmount}`}
                              </span>
                            </div>
                            <div className="flex justify-between md:gap-4 items-center border-t border-outline-variant/10 pt-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface">Total</span>
                              <span className="font-headline font-extrabold text-base text-on-surface">₹{order.total.toLocaleString("en-IN")}</span>
                            </div>
                            {order.walletPaid > 0 && (
                              <div className="flex justify-between md:gap-4 items-center text-[9px] text-outline font-semibold">
                                <span>Wallet Debit</span>
                                <span>₹{order.walletPaid.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                            {order.gatewayPaid > 0 && (
                              <div className="flex justify-between md:gap-4 items-center text-[9px] text-outline font-semibold">
                                <span>Online Paid</span>
                                <span>₹{order.gatewayPaid.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                            {order.refund_amount !== undefined && order.refund_amount > 0 && (
                              <div className="flex justify-between md:gap-4 items-center text-[9px] text-green-700 font-bold border-t border-dashed border-outline-variant/10 pt-1 mt-1">
                                <span>Refunded</span>
                                <span>₹{order.refund_amount.toLocaleString("en-IN")} {order.refund_status === "wallet_only" ? "(to Wallet)" : "(to Source)"}</span>
                              </div>
                            )}
                            <span className="text-[11px] text-gray-400 font-medium tracking-wide text-right">
                              ✓ Prices inclusive of GST
                            </span>
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 border-b border-outline-variant/5 md:border-b-0">
                          <div className="flex items-center justify-between md:block">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline md:hidden">Logistics State</span>
                            <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] ${statusClass} rounded-full backdrop-blur-sm`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass} mr-1.5`}></span>
                              {order.status}
                            </span>
                            {(order.awbCode || order.shiprocketId) && (statusLower === "shipped" || statusLower === "delivered") && (
                              <div className="mt-1.5 text-[9px] text-outline uppercase tracking-wider flex items-center gap-1">
                                <span>AWB: <span className="font-mono font-bold text-on-surface select-all">{(order.awbCode || order.shiprocketId)}</span></span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText((order.awbCode || order.shiprocketId) || "");
                                    triggerToast("✓ AWB copied to clipboard!");
                                  }}
                                  className="p-1 hover:text-on-surface transition-colors bg-transparent border-none cursor-pointer flex items-center justify-center"
                                  title="Copy AWB"
                                >
                                  <span className="material-symbols-outlined text-[11px] font-black">content_copy</span>
                                </button>
                                <span className="mx-1">•</span>
                                <Link
                                  href={`/ordertracking?orderId=${order.id}`}
                                  className="text-secondary hover:text-on-surface transition-colors font-bold underline capitalize"
                                >
                                  Track &rarr;
                                </Link>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="block md:table-cell py-4 md:py-10 px-6 md:px-8 text-left md:text-right">
                          {/* FIX 7 — replace flex gap-2 with margin wrappers (Safari < 14.1 gap on flex bug) */}
                          <div className="flex md:flex-col flex-wrap md:items-end justify-start md:justify-end w-full">
                            <div className="mb-2 md:mb-0 md:mt-0 mr-2 md:mr-0 w-full md:w-auto">
                              <Link
                                href={`/invoice?orderId=${order.id}`}
                                className="inline-flex items-center justify-center bg-on-surface text-surface hover:bg-secondary hover:text-white px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border border-on-surface/10 w-full md:w-auto"
                              >
                                View Invoice
                              </Link>
                            </div>
                            <div className="mb-2 md:mb-0 md:mt-2 mr-2 md:mr-0 w-full md:w-auto">
                              <Link
                                href={`/ordertracking?orderId=${order.id}`}
                                className="inline-flex items-center justify-center bg-transparent text-outline hover:text-on-surface px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border border-outline-variant/40 hover:border-on-surface/50 w-full md:w-auto"
                              >
                                Track Shipment
                              </Link>
                            </div>
                            {["Return Requested", "Return in Transit", "Returned"].includes(order.status) && (
                              <div className="mb-2 md:mb-0 md:mt-2 mr-2 md:mr-0 w-full md:w-auto">
                                <button
                                  onClick={() => {
                                    setSelectedOrderId(order.id);
                                    setLabelModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center bg-secondary text-white hover:bg-white hover:text-primary px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border border-secondary w-full md:w-auto"
                                >
                                  Return Label
                                </button>
                              </div>
                            )}
                            {returnEligible && (
                              <div className="mb-2 md:mb-0 md:mt-2 mr-2 md:mr-0 w-full md:w-auto">
                                <button
                                  onClick={() => handleOpenReturnModal(order.id)}
                                  className="inline-flex items-center justify-center bg-red-600/90 text-white px-4 py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all rounded-none w-full md:w-auto"
                                >
                                  Request Return
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>

            {/* FIX 6 — Mobile card layout (md:hidden). Replaces the block→table-row hack that breaks Safari. */}
            <div className="md:hidden">
              {orders.map((order) => {
                const statusLower = (order.status || "").toLowerCase();
                let statusClass = "bg-stone-500/10 text-stone-700 border border-stone-500/20";
                if (statusLower === "delivered") statusClass = "bg-green-500/10 text-green-700 border border-green-500/20";
                else if (statusLower === "returned" || statusLower === "return rejected" || statusLower === "failed") statusClass = "bg-red-500/10 text-red-600 border border-red-500/20";
                else if (statusLower === "return requested" || statusLower === "return in transit" || statusLower === "payment_pending" || statusLower === "payment pending") statusClass = "bg-amber-500/10 text-amber-700 border border-amber-500/20";
                else if (statusLower === "paid via wallet" || statusLower === "paid" || statusLower === "shipped") statusClass = "bg-blue-500/10 text-blue-700 border border-blue-500/20";
                else if (statusLower === "expired" || statusLower === "cancelled") statusClass = "bg-stone-500/10 text-stone-600 border border-stone-500/20";

                const returnEligibleMobile = isEligibleForReturn(order);
                const firstItem = order.cartItems?.[0] || (order as any).cart_items?.[0];

                return (
                  <div
                    key={order.id}
                    className="bg-white border-b border-outline-variant/10 p-6 space-y-4 font-label"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-headline font-black text-xl tracking-tight text-on-surface">#{order.id}</span>
                        <p className="text-[9px] text-outline uppercase tracking-widest font-semibold mt-0.5">{order.date.toUpperCase()}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] ${statusClass} rounded-full shrink-0`}>
                        {order.status}
                      </span>
                    </div>

                    {/* Product row */}
                    <div className="flex flex-col gap-3">
                      {(order.cartItems && order.cartItems.length > 0 ? order.cartItems : (order.items || []).map((name, idx) => ({ productName: name, productId: `${order.id}-item-${idx}`, price: 0, quantity: 1 }))).map((item: any, idx: number) => {
                        const img = item.image;
                        return (
                          <div key={idx} className="flex gap-3 items-start">
                            {img ? (
                              <div className="w-16 h-20 bg-surface-container-high overflow-hidden border border-outline-variant/10 relative shrink-0">
                                <Image
                                  className="object-cover"
                                  src={img}
                                  alt={item.productName || "Shirt"}
                                  fill
                                  sizes="64px"
                                />
                                {item.quantity > 1 && (
                                  <span className="absolute bottom-1 right-1 bg-black text-white text-[8px] font-black px-1.5 py-0.5 tracking-tighter text-center min-w-[14px]">
                                    {item.quantity}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-16 h-20 bg-surface-container-high flex items-center justify-center text-2xl border border-outline-variant/10 shrink-0 relative" style={{ backgroundColor: '#f5f5f5' }}>
                                👕
                                {item.quantity > 1 && (
                                  <span className="absolute bottom-1 right-1 bg-black text-white text-[8px] font-black px-1.5 py-0.5 tracking-tighter text-center min-w-[14px]">
                                    {item.quantity}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-bold tracking-[0.2em] text-secondary/70 uppercase">6K COLLECTION</span>
                              <p className="text-xs font-black text-on-surface uppercase tracking-wide leading-tight mt-0.5 truncate">{item.productName}</p>
                              <div className="flex gap-2 mt-1 items-center">
                                {item.size && (
                                  <span className="text-[8px] font-bold bg-neutral-100 text-neutral-600 px-1 py-0.5 uppercase">Size: {item.size}</span>
                                )}
                                {item.color && (
                                  <span className="text-[8px] font-bold bg-neutral-100 text-neutral-600 px-1 py-0.5 uppercase">Color: {item.color}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-outline-variant/5">
                        <p className="text-[9px] text-outline uppercase tracking-wider font-semibold">Premium Quality</p>
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="flex justify-between items-center border-t border-outline-variant/10 pt-3 text-xs">
                      <span className="text-outline font-semibold uppercase tracking-wider">Total</span>
                      <span className="font-headline font-extrabold text-base text-on-surface">₹{order.total.toLocaleString("en-IN")}</span>
                    </div>

                    {/* AWB */}
                    {(order.awbCode || order.shiprocketId) && (statusLower === "shipped" || statusLower === "delivered") && (
                      <p className="text-[9px] text-outline uppercase tracking-wider font-semibold">
                        AWB: <span className="font-mono font-bold text-on-surface select-all">{(order.awbCode || order.shiprocketId)}</span>
                      </p>
                    )}

                    {/* Action buttons — margin-based spacing for Safari < 14.1 gap compatibility */}
                    <div className="flex flex-col pt-1">
                      <div className="mb-2">
                        <Link
                          href={`/invoice?orderId=${order.id}`}
                          className="flex items-center justify-center bg-on-surface text-surface hover:bg-secondary hover:text-white py-3 text-[9px] font-black uppercase tracking-widest transition-all border border-on-surface/10 w-full"
                        >
                          View Invoice
                        </Link>
                      </div>
                      <div className="mb-2">
                        <Link
                          href={`/ordertracking?orderId=${order.id}`}
                          className="flex items-center justify-center bg-transparent text-outline hover:text-on-surface py-3 text-[9px] font-black uppercase tracking-widest transition-all border border-outline-variant/40 hover:border-on-surface/50 w-full"
                        >
                          Track Shipment
                        </Link>
                      </div>
                      {["Return Requested", "Return in Transit", "Returned"].includes(order.status) && (
                        <div className="mb-2">
                          <button
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setLabelModalOpen(true);
                            }}
                            className="flex items-center justify-center bg-secondary text-white hover:bg-white hover:text-primary py-3 text-[9px] font-black uppercase tracking-widest transition-all border border-secondary w-full"
                          >
                            Return Label
                          </button>
                        </div>
                      )}
                      {returnEligibleMobile && (
                        <div>
                          <button
                            onClick={() => handleOpenReturnModal(order.id)}
                            className="flex items-center justify-center bg-red-600/90 text-white py-3 text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all w-full"
                          >
                            Request Return
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
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
                    <span className="text-[9px] font-black uppercase tracking-widest text-outline">
                      {uploadingImage ? "Uploading to Cloudinary..." : "Upload Product Image *"}
                    </span>
                    {uploadedImageName && (
                      <span className="text-[11px] font-bold text-secondary uppercase tracking-widest mt-2">
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
                      <span className="text-[11px] text-outline uppercase tracking-wider font-semibold mt-0.5">3-5 Business Days</span>
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
                      <span className="text-[11px] text-outline uppercase tracking-wider font-semibold mt-0.5">Instant Refund</span>
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
                <span className="text-xs font-black tracking-widest">6K ATELIER</span>
                <span className="text-[11px] font-black border border-neutral-800 px-1 py-0.5 uppercase tracking-widest">PREPAID</span>
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
                <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-600 block mt-1">
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

              <div className="flex justify-between items-center text-[11px] text-neutral-400 font-bold uppercase tracking-widest pt-2">
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

