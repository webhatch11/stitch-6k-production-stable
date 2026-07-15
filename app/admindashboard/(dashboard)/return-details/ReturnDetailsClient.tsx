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
        // Reload page to reflect updated DB state
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

  const handleAssignPickup = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await assignShiprocketReturnPickupAction(order.id);
      if (res.success && res.awb) {
        triggerToast(`Pickup assigned. AWB: ${res.awb}`);
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
    handleAction(() => processQcResultAction(order.id, passed, reason), passed ? "QC Passed & Refund Initiated." : "QC Failed & Customer Notified.");

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
    (order as any).returnImageUrl || 
    (order as any).return_image_url ||
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
              Original Order:{" "}
              <Link href={`/admindashboard/order-details?orderId=${order.id}`} className="text-black hover:underline no-underline">
                #{order.id}
              </Link>
            </span>
            <span>•</span>
            <Link href="/admindashboard/returns" className="text-[#BA7517] hover:underline no-underline">
              ← Back to Returns
            </Link>
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          
          {/* Card 1: Return Information */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
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
                <Link href={`/admindashboard/order-details?orderId=${order.id}`} className="font-bold text-black hover:underline text-sm no-underline">
                  #{order.id}
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
                <span className="font-bold text-black">
                  {order.refundOption === "bank" ? "🏦 Bank Refund" : "💳 Store Wallet"}
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
                  <p className="text-gray-800 bg-gray-50 p-4 rounded-xl italic border border-gray-200/50">
                    "{order.returnDetails}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Customer Uploaded Image */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Customer Uploaded Image
            </h3>
            {returnImage ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Image uploaded by customer:</p>
                {isImageUrl ? (
                  <div className="group relative max-w-sm rounded-xl overflow-hidden border border-gray-200 shadow-sm transition-all hover:shadow-md">
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
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs text-gray-700 flex items-center justify-between">
                    <span>Attached: {returnImage}</span>
                    <button
                      type="button"
                      onClick={() => window.open(`/uploads/returns/${returnImage}`, "_blank")}
                      className="text-xs font-bold text-[#BA7517] hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Download File 📥
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
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Items Being Returned
            </h3>
            <div className="divide-y divide-gray-150">
              {order.cartItems && order.cartItems.length > 0 ? (
                order.cartItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="size-14 bg-zinc-900 border border-zinc-800 p-1 rounded-md flex items-center justify-center overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"}
                          className="w-full h-full object-cover rounded-sm"
                          alt={item.productName || item.title || "Returned item"}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900">{item.productName || item.title}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                          SKU: {item.productId || item.id || "N/A"} - Size: {item.size || "M"} - Qty: {item.quantity || 1}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-900">
                      ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString("en-IN")}.00
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400 italic">No return items found.</div>
              )}
            </div>
          </div>

          {/* Card 4: Return Timeline */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Return History & Events
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No return events logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200">
                {events.map((ev, index) => {
                  let dotColor = "bg-green-500";
                  if (index === events.length - 1) {
                    dotColor = "bg-blue-500";
                  }
                  return (
                    <div key={ev.id || index} className="relative flex flex-col gap-1">
                      <span className={`absolute -left-[26px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${dotColor}`} />
                      <div className="text-xs font-bold text-gray-900">
                        {ev.event || ev.description}
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        {new Date(ev.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Internal Notes card for returns */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Internal Return Notes
            </h3>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-6">No return notes created yet.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {notes.map((n) => (
                  <div key={n.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-800 leading-relaxed font-sans">{n.note}</p>
                    <div className="text-[9px] text-gray-400 uppercase font-black tracking-widest mt-2">
                      by {n.createdBy} • {new Date(n.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddNote} className="space-y-3 pt-6 border-t border-dashed border-gray-200/50">
              <textarea
                placeholder="Add return internal note..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                maxLength={500}
                className="w-full p-4 text-xs font-semibold bg-white border border-gray-200 rounded-xl h-24 outline-none focus:border-black resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                  {newNoteText.length}/500 chars
                </span>
                <button
                  type="submit"
                  disabled={!newNoteText.trim() || noteSubmitting}
                  className="px-6 py-2.5 bg-black text-white hover:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors border-none cursor-pointer disabled:opacity-40"
                >
                  {noteSubmitting ? "Adding..." : "Add Note"}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Card 1: Customer Dossier */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Customer Details
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-full bg-[#1e293b] text-[#38bdf8] flex items-center justify-center font-bold text-xs shrink-0 select-none">
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
                    className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 no-underline"
                  >
                    ✉ Email
                  </a>
                ) : (
                  <span className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center opacity-40 select-none rounded-lg border border-gray-200 bg-gray-50 text-gray-400">✉ Email</span>
                )}

                {phone && phone !== "Not provided" ? (
                  <a
                    href={`tel:${phone}`}
                    className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 no-underline"
                  >
                    📞 Call
                  </a>
                ) : (
                  <span className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center opacity-40 select-none rounded-lg border border-gray-200 bg-gray-50 text-gray-400">📞 Call</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Return Summary */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
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
                <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-extrabold ${
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
                  className="w-full py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-[9px] font-bold uppercase tracking-widest cursor-pointer text-gray-700"
                >
                  📋 Copy AWB Code
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Actions (status-based) */}
          <div className="p-8 bg-white border border-gray-200 rounded-[12px] shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6 text-gray-400">
              Return Operations
            </h3>

            {/* STATUS: Return Requested */}
            {orderStatusLower === "return requested" && (
              <div className="space-y-4">
                <button
                  onClick={handleAcceptReturn}
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50"
                >
                  ✓ Accept Return Request
                </button>
                
                <div className="pt-4 border-t border-dashed border-gray-200/60">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Rejection Reason</span>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for declining request (required to reject)..."
                    className="w-full border border-gray-200 rounded-lg p-3 text-xs resize-none h-20 mb-2 outline-none focus:border-red-400"
                  />
                  <button
                    onClick={handleRejectReturn}
                    disabled={!rejectReason.trim() || isSubmitting}
                    className="w-full border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    ✗ Decline Return Request
                  </button>
                </div>
              </div>
            )}

            {/* STATUS: Return Accepted */}
            {orderStatusLower === "return accepted" && (
              <button
                onClick={handleAssignPickup}
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-zinc-800 text-white py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50"
              >
                📦 Assign Shiprocket Pickup
              </button>
            )}

            {(orderStatusLower === "return pickup scheduled" || orderStatus === "Return Pickup Scheduled") && (
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 space-y-3">
                <p className="font-medium">
                  📦 Pickup Scheduled
                </p>
                <p>
                  Shiprocket courier will collect the item from the customer in 2-3 days.
                </p>
                {order.returnAwb && (
                  <div className="font-mono text-xs bg-blue-100 rounded-lg p-2">
                    Return AWB: {order.returnAwb}
                  </div>
                )}
              </div>
            )}

            {/* STATUS: Return in Transit */}
            {orderStatusLower === "return in transit" && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs leading-relaxed text-purple-800 font-medium">
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5">local_shipping</span>
                    <div>
                      <p className="font-bold">Item in transit.</p>
                      <p className="mt-1">Shipment is currently route to the warehouse. Tracking updates automatically.</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleMarkReceived}
                  disabled={isSubmitting}
                  className="w-full bg-black hover:bg-zinc-800 text-white py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50"
                >
                  📦 Mark Received at Warehouse
                </button>
              </div>
            )}

            {/* STATUS: Return QC Pending */}
            {orderStatusLower === "return qc pending" && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quality Check Inspection</p>
                <button
                  onClick={() => handleQcResult(true, "")}
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors disabled:opacity-50"
                >
                  ✅ QC Passed — Initiate Refund
                </button>
                
                <div className="pt-4 border-t border-dashed border-gray-200/60">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">QC Failure Reason</span>
                  <textarea
                    value={qcFailReason}
                    onChange={(e) => setQcFailReason(e.target.value)}
                    placeholder="Describe item defects, damage, or wear..."
                    className="w-full border border-gray-200 rounded-lg p-3 text-xs resize-none h-20 mb-2 outline-none focus:border-red-400"
                  />
                  <button
                    onClick={() => handleQcResult(false, qcFailReason.trim())}
                    disabled={!qcFailReason.trim() || isSubmitting}
                    className="w-full border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    ❌ QC Failed — Reject Return
                  </button>
                </div>
              </div>
            )}

            {orderStatusLower === "return qc failed" && (
              <div className="space-y-3">
                <button 
                  onClick={handleReship}
                  className="w-full bg-black text-white py-3 rounded-xl font-medium"
                >
                  🚚 Reship Item to Customer
                </button>

                <button
                  onClick={handleHoldAtWarehouse}
                  className="w-full border border-gray-300 text-gray-600 bg-gray-50 py-3 rounded-xl font-medium"
                >
                  📦 Hold at Warehouse
                </button>
              </div>
            )}

            {/* STATUS: Refunded / Refund Initiated / Return Approved */}
            {(orderStatusLower === "returned" || orderStatusLower === "return approved" || orderStatusLower === "refund initiated") && (
              <div className="bg-green-50 border border-green-150 rounded-xl p-4 font-medium text-xs">
                <p className="text-green-800 font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Refund Processed
                </p>
                <div className="text-green-700 space-y-1 mt-2 border-t border-green-200/50 pt-2 font-semibold">
                  <div>Amount: ₹{(order.refund_amount !== undefined && order.refund_amount !== null ? order.refund_amount : order.total).toLocaleString("en-IN")}.00</div>
                  <div>Method: {order.refundOption === "wallet" ? "Store Wallet" : "Original payment source"}</div>
                  {order.refunded_at && <div>Processed: {new Date(order.refunded_at).toLocaleDateString("en-IN")}</div>}
                </div>
                {order.refund_id && (
                  <button
                    onClick={handleVerifyRefund}
                    disabled={verifyingRefund}
                    className="mt-4 w-full bg-white text-green-700 border border-green-200 hover:bg-green-100/30 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    {verifyingRefund ? "Verifying..." : "Verify Refund Status"}
                  </button>
                )}
              </div>
            )}

            {/* STATUS: Return Rejected */}
            {orderStatusLower === "return rejected" && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 font-semibold text-xs leading-relaxed text-red-800">
                <p className="font-bold flex items-center gap-1.5 text-red-900 mb-1">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Return Declined
                </p>
                <p className="font-medium mt-1">This return request was rejected by admin. The customer has been notified.</p>
                {order.returnRejectReason && (
                  <p className="mt-2 italic opacity-95 text-[11px] bg-red-100/30 p-2 rounded">
                    Reason: "{order.returnRejectReason}"
                  </p>
                )}
              </div>
            )}

            {/* STATUS: Reship Requested */}
            {orderStatusLower === "reship requested" && (
              <div className="bg-blue-50 border border-blue-150 rounded-xl p-4 font-semibold text-xs leading-relaxed text-blue-800">
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
