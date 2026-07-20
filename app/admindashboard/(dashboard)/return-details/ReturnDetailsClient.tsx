"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, OrderEvent, OrderNote } from "@/lib/types";
import {
  acceptReturnRequestAction,
  rejectReturnWithReasonAction,
  assignShiprocketReturnPickupAction,
  markReturnReceivedAction,
  processQcResultAction,
  processReturnRefundAction,
  reshipReturnItemAction,
  verifyRefundAction,
  addOrderNoteAction,
  bulkUpdateOrderStatusAction,
  addOrderEventAction,
} from "@/app/actions/admin-orders";

interface ReturnDetailsClientProps {
  initialOrder: Order;
  initialEvents: OrderEvent[];
  initialNotes: OrderNote[];
}

export default function ReturnDetailsClient({
  initialOrder,
  initialEvents,
  initialNotes,
}: ReturnDetailsClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents);
  const [notes, setNotes] = useState<OrderNote[]>(initialNotes);

  // Form states
  const [rejectReason, setRejectReason] = useState("");
  const [qcFailReason, setQcFailReason] = useState("");
  const [newNoteText, setNewNoteText] = useState("");

  // Manual shipment linkage states
  const [awbCode, setAwbCode] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Refund override state
  const calculatedRefund = order.returnedItems && order.returnedItems.length > 0
    ? order.returnedItems.reduce((acc: number, item: any) => acc + (item.calculatedRefund || item.refundAmount || 0), 0)
    : order.total;

  const [approvedRefund, setApprovedRefund] = useState(calculatedRefund.toString());
  const [overrideReason, setOverrideReason] = useState("Damaged Product");

  // Loading/submitting states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [verifyingRefund, setVerifyingRefund] = useState(false);

  // Toast states
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleAction = async (actionFn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await actionFn();
      if (res.success) {
        triggerToast(successMsg);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        triggerToast(res.error || "Action failed.");
      }
    } catch (e: any) {
      triggerToast(e.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptReturn = () => 
    handleAction(() => acceptReturnRequestAction(order.id), "Return request accepted.");

  const handleRejectReturn = () => {
    if (!rejectReason.trim()) return;
    handleAction(() => rejectReturnWithReasonAction(order.id, rejectReason.trim()), "Return request rejected.");
  };

  const handleAssignPickup = async (code: string, name: string, url?: string) => {
    if (isSubmitting) return;
    if (url && url.trim().length > 0 && !url.trim().startsWith("https://")) {
      triggerToast("Tracking URL must be a valid HTTPS link (e.g. https://shiprocket.co/tracking/...)");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await assignShiprocketReturnPickupAction(order.id, code, name, url?.trim());
      if (res.success && res.awb) {
        triggerToast(`Manual pickup details recorded. AWB: ${res.awb}`);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        triggerToast(res.error || "Failed to assign pickup.");
      }
    } catch (e: any) {
      triggerToast(e.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkReceived = () =>
    handleAction(() => markReturnReceivedAction(order.id), "Item marked as received.");

  const handleQcResult = (passed: boolean, reason: string) =>
    handleAction(() => processQcResultAction(order.id, passed, reason), passed ? "QC Passed & Return Approved." : "QC Failed & Customer Notified.");

  const handleIssueRefund = (overrideAmt?: number, overrideRes?: string) =>
    handleAction(() => processReturnRefundAction(order.id, true, "Return approved by admin", overrideAmt, overrideRes), "Refund successfully processed.");

  const handleReship = () =>
    handleAction(() => reshipReturnItemAction(order.id), "Reship request registered.");

  const handleHoldAtWarehouse = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await bulkUpdateOrderStatusAction([order.id], "Return QC Failed - Held");
      if (res.success) {
        await addOrderEventAction(order.id, "Item held at warehouse after QC failure");
        triggerToast("Item marked as held at warehouse");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        triggerToast(res.error || "Failed to update status.");
      }
    } catch (e: any) {
      triggerToast(e.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRefund = async () => {
    if (verifyingRefund) return;
    setVerifyingRefund(true);
    try {
      const res = await verifyRefundAction(order.id);
      if (res.success) {
        triggerToast(`Refund verification status: ${res.status}`);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        triggerToast(res.error || "Verification failed.");
      }
    } catch (e: any) {
      triggerToast(e.message || "An error occurred.");
    } finally {
      setVerifyingRefund(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      const res = await addOrderNoteAction(order.id, newNoteText.trim());
      if (res.success) {
        triggerToast("Note added successfully.");
        setNewNoteText("");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        triggerToast(res.error || "Failed to add note.");
      }
    } catch (e: any) {
      triggerToast(e.message || "An error occurred.");
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Helper formatting values
  const orderStatus = order.status || "";
  const orderStatusLower = orderStatus.toLowerCase();
  
  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "return requested") return "bg-amber-100 text-amber-700 border border-amber-200";
    if (s === "return accepted") return "bg-blue-100 text-blue-700 border border-blue-200";
    if (s === "return pickup scheduled") return "bg-purple-100 text-purple-700 border border-purple-200";
    if (s === "return in transit") return "bg-purple-50 text-purple-700 border border-purple-100";
    if (s === "return qc pending") return "bg-amber-100 text-amber-700 border border-amber-200";
    if (s === "return qc failed") return "bg-red-100 text-red-700 border border-red-200";
    if (s === "returned" || s === "return approved" || s === "refund initiated") return "bg-green-100 text-green-700 border border-green-200";
    if (s === "return rejected") return "bg-red-100 text-red-700 border border-red-200";
    if (s === "reship requested") return "bg-blue-100 text-blue-700 border border-blue-200";
    return "bg-gray-100 text-gray-700 border border-gray-200";
  };

  // Address Snapshot parsing
  const addr = typeof order.address_snapshot === "string" 
    ? JSON.parse(order.address_snapshot) 
    : order.address_snapshot;
  
  const customerName = addr?.name || order.customer || "Valued Customer";
  const displayEmail = addr?.email || "Email not provided";
  const phone = addr?.phone || "Not provided";
  const initials = customerName.slice(0, 2).toUpperCase();

  const isFakeEmail = (email: string) => 
    !email || 
    email.includes('@example.com') ||
    email.includes('@placeholder') ||
    email.includes('@test.com') ||
    email === 'aditya.singhania@heritage.com';

  const returnImage = 
    order.returnImageUrl || 
    order.return_image_url ||
    (order as any).returnImageUrl ||
    (order.returnImage !== "No image provided" ? order.returnImage : null) ||
    null;

  const isImageUrl = returnImage && (returnImage.startsWith("http") || returnImage.startsWith("/"));

  return (
    <div className="p-8 lg:p-16 min-h-screen bg-[#fafafa]">
      {/* Toast Alert popup */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10">
          {toastText}
        </div>
      )}

      {/* Header Breadcrumbs / Nav */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <Link href="/admindashboard" className="hover:text-black no-underline">Admin Panel</Link>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <Link href="/admindashboard/returns" className="hover:text-black no-underline">Returns</Link>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">RTN-{order.id}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-4 mt-2">
            <h2 className="text-4xl lg:text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
              Return #RTN-{order.id}
            </h2>
            <span className={`inline-block px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-md border ${getStatusBadgeClass(orderStatus)}`}>
              {orderStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 font-bold uppercase text-[10px] text-gray-500 tracking-wider">
            <span>
              Original Order ID: <span className="text-black font-bold">#{order.id}</span>
            </span>
            <span>•</span>
            <Link href={`/invoice?orderId=${order.id}`} target="_blank" className="text-black hover:underline no-underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">description</span> View Invoice
            </Link>
            <span>•</span>
            <Link href="/admindashboard/returns" className="text-[#BA7517] hover:underline no-underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Returns
            </Link>
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          
          {/* Card 1: Return Information */}
          <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Return Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600">
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Return Reference</span>
                <span className="font-bold text-black text-sm">RTN-{order.id}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Original Order ID</span>
                <span className="font-bold text-black text-sm">#{order.id}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Original Invoice</span>
                <Link href={`/invoice?orderId=${order.id}`} target="_blank" className="font-bold text-[#BA7517] hover:underline text-sm no-underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">description</span> View Invoice
                </Link>
              </div>
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Return Requested</span>
                <span className="font-bold text-black">{order.returnRequestDate || order.date || "N/A"}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Return Reason</span>
                <span className="font-bold text-black">{order.returnReason || "N/A"}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Refund Method</span>
                <span className="font-bold text-black flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">{order.refundOption === "bank" ? "account_balance" : "account_balance_wallet"}</span>
                  {order.refundOption === "bank" ? "Bank Refund" : "Store Wallet"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Original Payment</span>
                <span className="font-bold text-black">
                  {order.gatewayPaid > 0 ? "Razorpay" : "Store Wallet"}
                </span>
              </div>
              {order.returnDetails && (
                <div className="md:col-span-2 space-y-1 pt-4 border-t border-gray-100">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Customer Comments</span>
                  <p className="text-gray-800 bg-gray-50 p-4 rounded-none italic border border-gray-200/50">
                    "{order.returnDetails}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Customer Uploaded Image */}
          <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Customer Uploaded Image
            </h3>
            {returnImage ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Image uploaded by customer:</p>
                {isImageUrl ? (
                  <div className="group relative max-w-sm rounded-none overflow-hidden border border-gray-200 shadow-sm transition-all hover:shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={returnImage}
                      alt="Return item photo"
                      className="w-full h-auto object-cover cursor-pointer max-h-80"
                      onClick={() => window.open(returnImage, "_blank")}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => window.open(returnImage, "_blank")}>
                      <span className="text-white text-[10px] font-bold uppercase tracking-wider">View Full Size ↗</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-none font-mono text-xs text-gray-700 flex items-center justify-between">
                    <span>Attached: {returnImage}</span>
                    <button
                      type="button"
                      onClick={() => window.open(`/uploads/returns/${returnImage}`, "_blank")}
                      className="text-xs font-bold text-[#BA7517] hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">download</span> Download File
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-gray-400">Click to view/download file in a new tab</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No image uploaded by customer</p>
            )}
          </div>

          {/* Card 3: Items Being Returned */}
          <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Items Being Returned
            </h3>
            <div className="divide-y divide-gray-150">
              {(() => {
                const displayItems = (order.returnedItems && order.returnedItems.length > 0) ? order.returnedItems : (order.cartItems || []);
                if (displayItems.length > 0) {
                  return displayItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="size-14 bg-zinc-900 border border-zinc-800 p-1 rounded-none flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"}
                            className="w-full h-full object-cover rounded-none"
                            alt={item.productName || item.title || "Returned item"}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-900">{item.productName || item.title || item.name}</span>
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                            SKU: {item.productId || item.id || "N/A"} - Size: {item.size || "M"} - Qty: {item.quantity || 1}
                          </span>
                          {item.refundAmount !== undefined && (
                            <span className="text-[9px] text-[#775a19] font-black uppercase tracking-[0.2em] mt-0.5">
                              Calculated Refund: ₹{item.refundAmount.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-900">
                        ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString("en-IN")}.00
                      </span>
                    </div>
                  ));
                }
                return <div className="text-sm text-gray-400 italic">No return items found.</div>;
              })()}
            </div>
          </div>

          {/* Card 4: Return Financial & Tax Breakdown */}
          {order.returnedItems && order.returnedItems.length > 0 && (
            <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm space-y-8">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#775a19]">
                Financial & Tax Audit Breakdown
              </h3>
              
              {(() => {
                const originalSubtotal = order.originalTotal || order.total || 1;
                const couponDiscount = order.couponDiscount || 0;
                const pointsDiscount = order.pointsDiscount || 0;
                const shippingAmount = order.shippingAmount || 0;

                // Enrich items on the fly to support legacy returns that don't have these snapshot fields saved
                const enrichedItems = order.returnedItems.map((item: any) => {
                  const itemQty = Number(item.quantity || 1);
                  const itemPrice = Number(item.price || 0);
                  const itemLineTotal = itemPrice * itemQty;
                  const weightRatio = itemLineTotal / originalSubtotal;

                  const couponShare = item.couponShare !== undefined ? item.couponShare : Math.round(couponDiscount * weightRatio * 100) / 100;
                  const pointsShare = item.pointsShare !== undefined ? item.pointsShare : Math.round(pointsDiscount * weightRatio * 100) / 100;
                  const refundAmount = item.refundAmount !== undefined ? item.refundAmount : Math.max(0, itemLineTotal - couponShare - pointsShare);

                  // GST Rate (5% for SHIRT-0022/garments <= 1000, 12% others)
                  const gstRate = item.gstRate !== undefined ? item.gstRate : (itemLineTotal <= 1000 ? 5 : 12);
                  const gstFraction = gstRate / 100;

                  const taxableAmount = item.taxableAmount !== undefined ? item.taxableAmount : Math.round((refundAmount / (1 + gstFraction)) * 100) / 100;
                  const gstAmount = item.gstAmount !== undefined ? item.gstAmount : Math.round((refundAmount - taxableAmount) * 100) / 100;
                  const cgst = item.cgst !== undefined ? item.cgst : Math.round((gstAmount / 2) * 100) / 100;
                  const sgst = item.sgst !== undefined ? item.sgst : Math.round((gstAmount - cgst) * 100) / 100;

                  return {
                    ...item,
                    couponShare,
                    pointsShare,
                    refundAmount,
                    taxableAmount,
                    gstAmount,
                    cgst,
                    sgst,
                    gstRate
                  };
                });

                const totalSubtotal = enrichedItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
                const totalCouponShare = enrichedItems.reduce((acc: number, item: any) => acc + (item.couponShare || 0), 0);
                const totalPointsShare = enrichedItems.reduce((acc: number, item: any) => acc + (item.pointsShare || 0), 0);
                const totalRefundAmount = enrichedItems.reduce((acc: number, item: any) => acc + (item.refundAmount || 0), 0);
                const totalWalletRefund = enrichedItems.reduce((acc: number, item: any) => acc + (item.walletRefund || 0), 0);
                const totalGatewayRefund = enrichedItems.reduce((acc: number, item: any) => acc + (item.gatewayRefund || 0), 0);
                const totalTaxableAmount = enrichedItems.reduce((acc: number, item: any) => acc + (item.taxableAmount || 0), 0);
                const totalCgst = enrichedItems.reduce((acc: number, item: any) => acc + (item.cgst || 0), 0);
                const totalSgst = enrichedItems.reduce((acc: number, item: any) => acc + (item.sgst || 0), 0);
                const totalGstRefunded = enrichedItems.reduce((acc: number, item: any) => acc + (item.gstAmount || 0), 0);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {/* 1. Refund Calculation */}
                    <div className="space-y-4">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                        1. Refund Calculation
                      </h4>
                      <div className="space-y-2 text-xs font-semibold text-gray-600">
                        <div className="flex justify-between">
                          <span>Line Price Subtotal:</span>
                          <span className="text-black font-bold">
                            ₹{totalSubtotal.toLocaleString("en-IN")}.00
                          </span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Pro-Rata Coupon Share:</span>
                          <span>-₹{totalCouponShare.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Pro-Rata Points Share:</span>
                          <span>-₹{totalPointsShare.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="border-t border-gray-100 pt-2 flex justify-between text-xs font-bold text-black uppercase tracking-wider">
                          <span>Net Refund Value:</span>
                          <span>₹{totalRefundAmount.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Payment Method Split */}
                    <div className="space-y-4 md:pl-8">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                        2. Payment Method Split
                      </h4>
                      <div className="space-y-2 text-xs font-semibold text-gray-600">
                        <div className="flex justify-between">
                          <span>Wallet Refund:</span>
                          <span className="text-black font-bold">
                            ₹{totalWalletRefund.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gateway/Bank Refund:</span>
                          <span className="text-black font-bold">
                            ₹{totalGatewayRefund.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="border-t border-gray-150 pt-2 flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          <span>Shipping Fee (Non-Ref):</span>
                          <span>₹{shippingAmount.toLocaleString("en-IN")}.00</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Included GST Breakdown */}
                    <div className="space-y-4 md:pl-8">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                        3. Included GST Breakdown
                      </h4>
                      <div className="space-y-2 text-xs font-semibold text-gray-600">
                        <div className="flex justify-between">
                          <span>Taxable Net Value:</span>
                          <span className="text-black font-bold">
                            ₹{totalTaxableAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>CGST portion:</span>
                          <span className="text-black font-bold">
                            ₹{totalCgst.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST portion:</span>
                          <span className="text-black font-bold">
                            ₹{totalSgst.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="border-t border-gray-100 pt-2 flex justify-between text-xs font-bold text-[#775a19] uppercase tracking-wider">
                          <span>Total GST Refunded:</span>
                          <span>₹{totalGstRefunded.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Card 1: Customer Dossier */}
          <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Customer Details
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-none bg-[#1e293b] text-[#38bdf8] flex items-center justify-center font-bold text-xs shrink-0 select-none">
                  {initials}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-black">{customerName}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Return Requester</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-medium text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-gray-400">mail</span>
                  <span>{displayEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-gray-400">phone</span>
                  <span>{phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm text-gray-400 mt-0.5">location_on</span>
                  <div className="flex-1 text-gray-500">
                    {addr ? (
                      <p className="leading-relaxed">
                        {addr.address_line_1 || addr.addressLine1 || ""}
                        {(addr.address_line_2 || addr.addressLine2) && <><br />{addr.address_line_2 || addr.addressLine2}</>}
                        <br />
                        {addr.city}, {addr.state} - {addr.postal_code || addr.pincode}
                      </p>
                    ) : (
                      <p className="italic">No address snapshot available.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Call and Email links */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {displayEmail && !isFakeEmail(displayEmail) ? (
                  <a
                    href={`mailto:${displayEmail}`}
                    className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all rounded-none border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 no-underline"
                  >
                    <span className="material-symbols-outlined text-sm">mail</span> Email
                  </a>
                ) : (
                  <span className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center opacity-40 select-none rounded-none border border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">mail</span> Email
                  </span>
                )}

                {phone && phone !== "Not provided" ? (
                  <a
                    href={`tel:${phone}`}
                    className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all rounded-none border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 no-underline"
                  >
                    <span className="material-symbols-outlined text-sm">call</span> Call
                  </a>
                ) : (
                  <span className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center opacity-40 select-none rounded-none border border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">call</span> Call
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Return Summary */}
          <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Return Summary
            </h3>
            <div className="space-y-4 text-xs font-semibold text-gray-600">
              <div className="flex justify-between items-center">
                <span>Original Order Value</span>
                <span className="text-black font-bold">₹{order.total.toLocaleString("en-IN")}.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Refund Amount</span>
                <span className="text-[#BA7517] font-bold">
                  ₹{(order.refund_amount !== undefined && order.refund_amount !== null ? order.refund_amount : order.total).toLocaleString("en-IN")}.00
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Refund Method</span>
                <span className={`px-2 py-0.5 rounded-none text-[9px] uppercase tracking-widest font-extrabold ${
                  order.refundOption === "wallet" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                }`}>
                  {order.refundOption === "wallet" ? "Store Wallet" : "Original Source"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Return AWB</span>
                <span className="text-black font-mono font-bold">{order.returnAwb || "Not assigned"}</span>
              </div>
              
              {order.returnAwb && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(order.returnAwb || "");
                    triggerToast("AWB copied to clipboard!");
                  }}
                  className="w-full py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-none text-[9px] font-bold uppercase tracking-widest cursor-pointer text-gray-700 flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span> Copy AWB Code
                </button>
              )}

              {/* Part 5: Admin Loyalty audit details */}
              <div className="pt-4 border-t border-dashed border-gray-200 space-y-2">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Loyalty Status Audit</span>
                <div className="text-[11px] font-medium text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Points At Stake</span>
                    <span className="font-bold text-black">{order.pointsEarned || 0} PTS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Credit Status</span>
                    <span className="font-bold uppercase text-[#BA7517]">{(order as any).pointsCreditStatus || "pending"}</span>
                  </div>
                  {(order as any).pointsCreditScheduledAt && (
                    <div className="flex justify-between">
                      <span>Expected Credit Date</span>
                      <span className="font-mono">{new Date((order as any).pointsCreditScheduledAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  )}
                  {(order as any).creditedAt && (
                    <div className="flex justify-between">
                      <span>Credited Date</span>
                      <span className="font-mono">{new Date((order as any).creditedAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  )}
                  {((order as any).pointsCreditStatus === "cancelled" || orderStatusLower === "return approved" || orderStatusLower === "returned") && (
                    <div className="flex justify-between text-red-600">
                      <span>Reversal / Cancellation</span>
                      <span>Approved Return Reversal</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* Card 3: Actions (status-based) */}
          <div className="p-8 bg-white border border-gray-200 rounded-none shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Return Operations
            </h3>

            {/* STATUS: Return Requested */}
            {orderStatusLower === "return requested" && (
              <div className="space-y-4">
                <button
                  onClick={handleAcceptReturn}
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">check</span> Accept Return Request
                </button>
                
                <div className="pt-4 border-t border-dashed border-gray-200/60">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Rejection Reason</span>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for declining request (required to reject)..."
                    className="w-full border border-gray-200 rounded-none p-3 text-xs resize-none h-20 mb-2 outline-none focus:border-red-400"
                  />
                  <button
                    onClick={handleRejectReturn}
                    disabled={!rejectReason.trim() || isSubmitting}
                    className="w-full border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">close</span> Decline Return Request
                  </button>
                </div>
              </div>
            )}

            {/* STATUS: Return Accepted */}
            {orderStatusLower === "return accepted" && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-none text-xs text-gray-700 space-y-3">
                  <p className="font-bold text-[#775a19] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">local_shipping</span> Schedule Reverse Shipment
                  </p>
                  <p className="text-[11px] leading-relaxed text-gray-550 font-medium">
                    1. Open the Shiprocket dashboard to book the reverse pickup manually.
                  </p>
                  <a
                    href="https://app.shiprocket.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full text-center bg-black hover:bg-zinc-800 text-white py-2.5 rounded-none text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Open Shiprocket Dashboard ↗
                  </a>
                  <p className="text-[11px] leading-relaxed pt-2 border-t border-gray-200 text-gray-550 font-medium">
                    2. Once booked, enter the generated reverse tracking credentials below:
                  </p>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      AWB Tracking Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1432456789"
                      value={awbCode}
                      onChange={(e) => setAwbCode(e.target.value)}
                      className="w-full border border-gray-200 rounded-none p-3 text-xs outline-none focus:border-black font-semibold text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      Courier Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Delhivery"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full border border-gray-200 rounded-none p-3 text-xs outline-none focus:border-black font-semibold text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      Tracking URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.delhivery.com/track/package/..."
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      className="w-full border border-gray-200 rounded-none p-3 text-xs outline-none focus:border-black font-semibold text-black"
                    />
                  </div>
                  <button
                    onClick={() => handleAssignPickup(awbCode, courierName, trackingUrl)}
                    disabled={!awbCode.trim() || !courierName.trim() || isSubmitting}
                    className="w-full bg-[#775a19] hover:bg-[#5f4713] text-[#faf9f8] py-3.5 rounded-none text-xs font-black uppercase tracking-[0.2em] cursor-pointer border-none transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Save Tracking & Set Return In Transit
                  </button>
                </div>
              </div>
            )}

            {(orderStatusLower === "return pickup scheduled" || orderStatus === "Return Pickup Scheduled") && (
              <div className="bg-blue-50 border border-blue-150 rounded-none p-4 text-xs text-blue-800 space-y-3 font-semibold">
                <p className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">inventory_2</span> Pickup Scheduled
                </p>
                <p>
                  Reverse pickup is scheduled with the courier partner.
                </p>
                {order.returnAwb && (
                  <div className="font-mono text-xs bg-blue-100/50 border border-blue-200/50 p-2 rounded-none">
                    Return AWB: {order.returnAwb}
                  </div>
                )}
              </div>
            )}

            {/* STATUS: Return in Transit */}
            {orderStatusLower === "return in transit" && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-150 rounded-none p-4 text-xs leading-relaxed text-purple-800 font-semibold">
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5">local_shipping</span>
                    <div>
                      <p className="font-bold uppercase tracking-wider">Item in transit</p>
                      <p className="mt-1 font-medium">The return package is route back to our warehouse.</p>
                      {order.returnAwb && (
                        <p className="mt-2 font-mono text-[10px] bg-purple-100/50 p-1.5 border border-purple-200/30">
                          Courier: {order.courierName || "Standard"} | AWB: {order.returnAwb}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleMarkReceived}
                  disabled={isSubmitting}
                  className="w-full bg-black hover:bg-zinc-800 text-white py-3.5 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">inventory_2</span> Mark Received at Warehouse
                </button>
              </div>
            )}

            {/* STATUS: Return QC Pending */}
            {orderStatusLower === "return qc pending" && (
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quality Check Inspection</p>
                <button
                  onClick={() => handleQcResult(true, "")}
                  disabled={isSubmitting}
                  className="w-full bg-green-700 hover:bg-green-600 text-white py-3.5 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">check</span> QC Passed — Approve Return
                </button>
                
                <div className="pt-4 border-t border-dashed border-gray-200">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">QC Failure Reason</span>
                  <textarea
                    value={qcFailReason}
                    onChange={(e) => setQcFailReason(e.target.value)}
                    placeholder="Describe defects or missing accessories..."
                    className="w-full border border-gray-200 rounded-none p-3 text-xs resize-none h-20 mb-2 outline-none focus:border-red-400"
                  />
                  <button
                    onClick={() => handleQcResult(false, qcFailReason.trim())}
                    disabled={!qcFailReason.trim() || isSubmitting}
                    className="w-full border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">close</span> QC Failed — Reject Return
                  </button>
                </div>
              </div>
            )}

            {orderStatusLower === "return qc failed" && (
              <div className="space-y-3">
                <button 
                  onClick={handleReship}
                  className="w-full bg-black text-white py-3 rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">local_shipping</span> Reship Item to Customer
                </button>

                <button
                  onClick={handleHoldAtWarehouse}
                  className="w-full border border-gray-300 text-gray-600 bg-gray-50 py-3 rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">inventory_2</span> Hold at Warehouse
                </button>
              </div>
            )}

            {/* STATUS: Refunded / Refund Initiated */}
            {(orderStatusLower === "returned" || orderStatusLower === "refund initiated") && (
              <div className="bg-green-50 border border-green-150 rounded-none p-4 font-semibold text-xs">
                <p className="text-green-800 font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Refund Processed
                </p>
                <div className="text-green-700 space-y-1 mt-2 border-t border-green-200/50 pt-2">
                  <div>Amount: ₹{(order.refund_amount !== undefined && order.refund_amount !== null ? order.refund_amount : order.total).toLocaleString("en-IN")}.00</div>
                  <div>Method: {order.refundOption === "wallet" ? "Store Wallet" : "Original payment source"}</div>
                  {order.refunded_at && <div>Processed: {new Date(order.refunded_at).toLocaleDateString("en-IN")}</div>}
                </div>
                {order.refund_id && (
                  <button
                    onClick={handleVerifyRefund}
                    disabled={verifyingRefund}
                    className="mt-4 w-full bg-white text-green-700 border border-green-200 hover:bg-green-100/30 py-2 rounded-none text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    {verifyingRefund ? "Verifying..." : "Verify Refund Status"}
                  </button>
                )}
              </div>
            )}

            {/* STATUS: Return Approved (QC Passed, Pending Refund Execution) */}
            {orderStatusLower === "return approved" && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-none p-4 text-xs text-amber-800 font-semibold space-y-2">
                  <p className="font-bold uppercase tracking-[0.2em] flex items-center gap-1.5 text-amber-900">
                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                    QC Verified & Approved
                  </p>
                  <p className="text-[11px] leading-relaxed font-medium">Quality check passed. The refund is now pending authorization.</p>
                  <div className="pt-2 border-t border-amber-200/50 font-semibold space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>Calculated Refund:</span>
                      <span>₹{calculatedRefund.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Method:</span>
                      <span>{order.refundOption === "wallet" ? "Store Wallet" : "Original payment source"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      Approved Refund Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={approvedRefund}
                      onChange={(e) => setApprovedRefund(e.target.value)}
                      className="w-full border border-gray-200 rounded-none p-3 text-xs outline-none focus:border-black font-semibold text-black"
                    />
                    <p className="text-[9px] text-gray-400 font-semibold mt-1">
                      Maximum refund remaining: ₹{calculatedRefund.toLocaleString("en-IN")}
                    </p>
                  </div>

                  {Number(approvedRefund) !== calculatedRefund && (
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                        Override Reason *
                      </label>
                      <select
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full border border-gray-200 rounded-none p-3 text-xs outline-none focus:border-black font-semibold text-black bg-white"
                      >
                        <option value="Damaged Product">Damaged Product</option>
                        <option value="Missing Tags">Missing Tags</option>
                        <option value="Used Product">Used Product</option>
                        <option value="Courtesy Adjustment">Courtesy Adjustment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  {/* Validation alerts */}
                  {Number(approvedRefund) <= 0 && (
                    <div className="text-[10px] text-red-600 font-bold bg-red-50 p-2 border border-red-150 rounded-none flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span> Refund amount must be greater than zero.
                    </div>
                  )}
                  {Number(approvedRefund) > calculatedRefund && (
                    <div className="text-[10px] text-red-600 font-bold bg-red-50 p-2 border border-red-150 rounded-none flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span> Refund amount cannot exceed calculated limit (₹{calculatedRefund.toLocaleString("en-IN")}).
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const amount = Number(approvedRefund);
                      const hasChanged = amount !== calculatedRefund;
                      handleIssueRefund(amount, hasChanged ? overrideReason : undefined);
                    }}
                    disabled={
                      Number(approvedRefund) <= 0 ||
                      Number(approvedRefund) > calculatedRefund ||
                      isSubmitting
                    }
                    className="w-full bg-[#775a19] hover:bg-[#5f4713] text-[#faf9f8] py-4 rounded-none text-xs font-black uppercase tracking-[0.2em] cursor-pointer border-none transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span> Issue Refund
                  </button>
                </div>
              </div>
            )}

            {/* STATUS: Return Rejected */}
            {orderStatusLower === "return rejected" && (
              <div className="bg-red-50 border border-red-100 rounded-none p-4 font-semibold text-xs leading-relaxed text-red-800">
                <p className="font-bold flex items-center gap-1.5 text-red-900 mb-1">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Return Declined
                </p>
                <p className="font-medium mt-1">This return request was rejected by admin. The customer has been notified.</p>
                {order.returnRejectReason && (
                  <p className="mt-2 italic opacity-95 text-[11px] bg-red-100/30 p-2 rounded-none">
                    Reason: "{order.returnRejectReason}"
                  </p>
                )}
              </div>
            )}

            {/* STATUS: Reship Requested */}
            {orderStatusLower === "reship requested" && (
              <div className="bg-blue-50 border border-blue-150 rounded-none p-4 font-semibold text-xs leading-relaxed text-blue-800">
                <p className="font-bold flex items-center gap-1.5 text-blue-900 mb-1">
                  <span className="material-symbols-outlined text-sm">local_shipping</span>
                  Reship Requested
                </p>
                <p className="font-medium mt-1">Item is queued to be reshipped back to the customer following a failed QC check.</p>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
