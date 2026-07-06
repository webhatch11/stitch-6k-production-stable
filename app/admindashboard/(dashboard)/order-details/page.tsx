"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Order, Product, OrderNote } from "@/lib/registry";
import { getOrdersAction, getProductsAction } from "@/app/actions/admin-reads";
import {
  bulkUpdateOrderStatusAction,
  approvePendingOrderAction,
  cancelOrderAndRefundAction,
  approveReturnPickupAction,
  processReturnRefundAction,
  rejectReturnAction,
  issueRefundAction,
  getOrderEventsAction,
  addOrderNoteAction,
  deleteOrderNoteAction,
  getOrderNotesAction,
} from "@/app/actions/admin-orders";

function OrderDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [qualityCheck, setQualityCheck] = useState<"passed" | "failed">("passed");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Timeline events state
  const [orderEvents, setOrderEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const loadEvents = async (oId: string) => {
    setEventsLoading(true);
    const res = await getOrderEventsAction(oId);
    if (res.success) setOrderEvents(res.events || []);
    setEventsLoading(false);
  };

  // Order notes state
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const loadNotes = async (oId: string) => {
    setNotesLoading(true);
    const res = await getOrderNotesAction(oId);
    if (res.success) setNotes(res.notes || []);
    setNotesLoading(false);
  };

  const handleAddNote = async () => {
    if (!order || !newNoteText.trim() || newNoteText.length > 500 || noteSubmitting) return;
    setNoteSubmitting(true);
    const res = await addOrderNoteAction(order.id, newNoteText.trim());
    setNoteSubmitting(false);
    if (res.success) {
      setNewNoteText("");
      triggerToast("Note added successfully.");
      await loadNotes(order.id);
    } else {
      triggerToast(res.error || "Failed to add note.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!order) return;
    openConfirmDialog(
      "Delete Internal Note",
      "Are you sure you want to delete this internal note? This action cannot be undone.",
      async () => {
        const res = await deleteOrderNoteAction(noteId);
        if (res.success) {
          triggerToast("Note deleted successfully.");
          await loadNotes(order.id);
        } else {
          triggerToast(res.error || "Failed to delete note.");
        }
      }
    );
  };

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundActionType, setRefundActionType] = useState<"cancel" | "return" | "issue">("cancel");
  const [refundReason, setRefundReason] = useState("");
  const [refundQualityCheck, setRefundQualityCheck] = useState<"passed" | "failed">("passed");
  const [refundLoading, setRefundLoading] = useState(false);

  // Custom Confirmation Dialog States
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState("");
  const [confirmModalDesc, setConfirmModalDesc] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<(() => Promise<void>) | null>(null);

  const openConfirmDialog = (title: string, desc: string, callback: () => Promise<void>) => {
    setConfirmModalTitle(title);
    setConfirmModalDesc(desc);
    setConfirmCallback(() => callback);
    setConfirmModalOpen(true);
  };

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
    loadOrderDetails();

    // Listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "registry_orders" || e.key === "registry_products") {
        loadOrderDetails();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [orderId]);

  const loadOrderDetails = async () => {
    const ordersRes = await getOrdersAction();
    let currentOrder = null;
    if (ordersRes.success) {
      const list = ordersRes.orders || [];
      const matched = list.find((o) => o.id === orderId) || (list.length > 0 ? list[0] : null);
      setOrder(matched ?? null);
      currentOrder = matched ?? null;
    }
    const prodsRes = await getProductsAction();
    if (prodsRes.success) setProducts(prodsRes.products || []);

    if (currentOrder) {
      loadEvents((currentOrder as any).id);
      loadNotes((currentOrder as any).id);
    }
  };

  if (!order) {
    return (
      <div className="p-8 lg:p-16 text-center">
        <h3 className="font-headline text-lg font-black uppercase text-on-surface mb-2">No Order Reference</h3>
        <p className="text-xs text-outline mb-6">Please select an order from the ledger to audit details.</p>
        <button
          onClick={() => router.push("/admindashboard/orders")}
          className="bg-primary text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-secondary rounded-none cursor-pointer border-none"
        >
          View Orders
        </button>
      </div>
    );
  }

  const handleUpdateStatus = (newStatus: string) => {
    openConfirmDialog(
      "Update Order Status",
      `Are you sure you want to update the status of Order #${order.id} to "${newStatus}"?`,
      async () => {
        const res = await bulkUpdateOrderStatusAction([order.id], newStatus);
        if (res.success) {
          triggerToast(`Order status updated to: ${newStatus}`);
          window.dispatchEvent(new Event("storage"));
          await loadOrderDetails();
        } else {
          triggerToast(res.error || "Failed to update status");
        }
      }
    );
  };

  const handleApprovePendingOrder = () => {
    openConfirmDialog(
      "Approve Pending Order",
      `Clear Bank Payment & Mark Paid for Order #${order.id}?`,
      async () => {
        const res = await approvePendingOrderAction(order.id);
        if (res.success) {
          triggerToast("Payment marked as cleared. Status updated to Paid.");
          window.dispatchEvent(new Event("storage"));
          await loadOrderDetails();
        } else {
          triggerToast(res.error || "Failed to approve order");
        }
      }
    );
  };

  const handleShiprocketShip = () => {
    openConfirmDialog(
      "Ship via Shiprocket",
      `Automatically dispatch Order #${order.id} via Shiprocket Courier routing?`,
      async () => {
        try {
          const res = await fetch("/api/logistics/dispatch-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId: order.id }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            triggerToast(`Shiprocket Routing Success! AWB Assigned: ${data.awbCode}${data.isMock ? " (Mock)" : ""}`);
            window.dispatchEvent(new Event("storage"));
            await loadOrderDetails();
          } else {
            triggerToast(`Error: ${data.error || "Dispatch failed."}`);
          }
        } catch (err: any) {
          triggerToast(`Network Error: ${err.message || "Failed to dispatch."}`);
        }
      }
    );
  };

  const handleCancelOrderAndRefund = () => {
    const wPaid = order.walletPaid || 0;
    const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
    const pRedeemed = order.pointsRedeemed || 0;
    
    let refundDetails = "";
    if (wPaid > 0 || gPaid > 0) {
      const parts = [];
      if (gPaid > 0) parts.push(`₹${gPaid.toLocaleString("en-IN")} bank refund`);
      if (wPaid > 0) parts.push(`₹${wPaid.toLocaleString("en-IN")} store wallet credit`);
      refundDetails = parts.join(" and ");
    } else {
      refundDetails = "No monetary amounts to refund";
    }

    const confirmMsg = 
      `You are cancelling Order #${order.id} due to workshop stock issues.\n\n` +
      `Automated Actions Checklist:\n` +
      `- Inventory Restocking: Order items will be restocked in inventory counts\n` +
      `- Refund Actions: ${refundDetails}\n` +
      `${pRedeemed > 0 ? `- Loyalty Points: ${pRedeemed.toLocaleString()} points restored to customer account\n` : ""}\n` +
      `This operation is irreversible. Proceed?`;

    openConfirmDialog(
      "Cancel Order & Refund",
      confirmMsg,
      async () => {
        const res = await cancelOrderAndRefundAction(order.id, "Order cancelled by admin");
        if (res.success) {
          triggerToast("Order Cancelled. Refunds & Restocking completed.");
          window.dispatchEvent(new Event("storage"));
          await loadOrderDetails();
        } else {
          triggerToast(res.error || "Failed to cancel order");
        }
      }
    );
  };

  // Return flows
  const handleApprovePickup = () => {
    openConfirmDialog(
      "Confirm Return Pickup",
      `Confirm scheduled pickup for Order #${order.id}? This will set the order status to "Return in Transit".`,
      async () => {
        const res = await approveReturnPickupAction(order.id);
        if (res.success) {
          triggerToast('Pickup scheduled. Status: "Return in Transit"');
          await loadOrderDetails();
        } else {
          triggerToast(res.error || "Failed to approve pickup");
        }
      }
    );
  };

  const handleConfirmReceipt = () => {
    const wPaid = order.walletPaid || 0;
    const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - wPaid);
    const pRedeemed = order.pointsRedeemed || 0;
    const cDiscount = order.couponDiscount || 0;
    
    let refundDetails = "";
    if (order.refundOption === "wallet") {
      refundDetails = `₹${(gPaid + wPaid).toLocaleString("en-IN")} to Store Wallet`;
    } else {
      const parts = [];
      if (gPaid > 0) parts.push(`₹${gPaid.toLocaleString("en-IN")} to original bank account`);
      if (wPaid > 0) parts.push(`₹${wPaid.toLocaleString("en-IN")} back to Store Wallet`);
      refundDetails = parts.join(" and ");
    }

    const confirmMsg = 
      `You are processing a final return refund for Order #${order.id}.\n\n` +
      `Financial Details:\n` +
      `- Refund Destination: ${refundDetails}\n` +
      `${pRedeemed > 0 ? `- Loyalty Points: ${pRedeemed.toLocaleString()} points will be RESTORED to customer\n` : ""}` +
      `${cDiscount > 0 ? `- Coupon Discount: ₹${cDiscount.toLocaleString()} code discount is VOIDED\n` : ""}` +
      `- Quality Audit Result: ${qualityCheck.toUpperCase()} (${qualityCheck === "passed" ? "Restocks catalog stock count" : "Item failed check; inventory unmodified"})\n\n` +
      `This action cannot be undone. Are you sure you want to authorize the refund?`;

    openConfirmDialog(
      "Confirm Receipt & Refund",
      confirmMsg,
      async () => {
        const res = await processReturnRefundAction(order.id, qualityCheck === "passed", order.returnReason || "Return approved by admin");
        if (res.success) {
          triggerToast(
            qualityCheck === "passed"
              ? "Quality Check Passed: Refunded & Stock Restocked"
              : "Quality Check Failed: Refunded & Stock Unrestocked"
          );
          await loadOrderDetails();
        } else {
          triggerToast(res.error || "Failed to process refund");
        }
      }
    );
  };

  const handleRejectReturn = () => {
    if (!rejectReason.trim()) {
      triggerToast("Please enter a rejection reason.");
      return;
    }
    openConfirmDialog(
      "Reject Return Request",
      `Are you sure you want to REJECT the return request for Order #${order.id}?\n\nReason: "${rejectReason}"\n\nNo refund will be processed and the return request will be closed.`,
      async () => {
        const res = await rejectReturnAction(order.id, rejectReason);
        if (res.success) {
          setRejectModalOpen(false);
          setRejectReason("");
          triggerToast("Return Request Rejected");
          await loadOrderDetails();
        } else {
          triggerToast(res.error || "Failed to reject return");
        }
      }
    );
  };

  const openRefundModal = (type: "cancel" | "return" | "issue") => {
    setRefundActionType(type);
    setRefundReason("");
    setRefundQualityCheck(qualityCheck);
    setRefundModalOpen(true);
  };

  const closeRefundModal = () => {
    setRefundModalOpen(false);
    setRefundReason("");
    setRefundLoading(false);
  };

  const handleRefundSubmit = async () => {
    if (!refundReason.trim()) {
      triggerToast("Please enter a refund reason.");
      return;
    }
    setRefundLoading(true);
    let res: { success: boolean; error?: string };
    if (refundActionType === "cancel") {
      res = await cancelOrderAndRefundAction(order.id, refundReason.trim());
    } else if (refundActionType === "return") {
      res = await processReturnRefundAction(order.id, refundQualityCheck === "passed", refundReason.trim());
    } else {
      res = await issueRefundAction(order.id, refundReason.trim());
    }
    setRefundLoading(false);
    if (res.success) {
      closeRefundModal();
      triggerToast(
        refundActionType === "cancel"
          ? "Order Cancelled. Refunds & Restocking completed."
          : refundActionType === "return"
          ? refundQualityCheck === "passed"
            ? "Quality Check Passed: Refunded & Stock Restocked"
            : "Quality Check Failed: Refunded & Stock Unrestocked"
          : "Refund issued successfully."
      );
      window.dispatchEvent(new Event("storage"));
      await loadOrderDetails();
    } else {
      triggerToast(res.error || "Refund action failed.");
    }
  };

  const s = order.status.toLowerCase();
  const walletPaid = order.walletPaid || 0;
  const gatewayPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - walletPaid);
  const couponDiscount = order.couponDiscount || 0;
  const pointsRedeemed = order.pointsRedeemed || 0;
  const pointsDiscount = order.pointsDiscount || 0;
  const originalTotal = order.originalTotal !== undefined ? order.originalTotal : (order.total + pointsDiscount + couponDiscount);
  const finalGatewayAmount = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - walletPaid);

  let gatewayText = "Razorpay Terminal";
  if (walletPaid > 0) {
    gatewayText = order.total === 0 ? "Internal Store Wallet" : "Razorpay & Wallet";
  }

  // Build split refund HTML indicators
  const renderRefundBreakdown = () => {
    let prefix = "Requested Refund:";
    let successColor = "text-blue-700";

    if (s.includes("transit")) {
      prefix = "Pending Refund:";
      successColor = "text-yellow-700 font-bold";
    } else if (s === "returned") {
      prefix = "Refund Status:";
      successColor = "text-green-700 font-extrabold";
    }

    return (
      <div className="space-y-1.5 mt-2">
        {order.refundOption === "wallet" ? (
          <div className={`font-bold ${successColor}`}>{prefix} ₹{(gatewayPaid + walletPaid).toLocaleString("en-IN")} to Store Wallet</div>
        ) : (
          <>
            {gatewayPaid > 0 && (
              <div className={`font-bold ${successColor}`}>{prefix} ₹{gatewayPaid.toLocaleString("en-IN")} to Bank Account</div>
            )}
            {walletPaid > 0 && (
              <div className={`font-bold ${successColor}`}>
                {s === "returned" ? "Refunded" : "To be refunded"}: ₹{walletPaid.toLocaleString("en-IN")} to Store Wallet
              </div>
            )}
          </>
        )}

        {pointsRedeemed > 0 && (
          <div className="text-green-700 font-bold">
            {s === "returned" ? "Restored" : "To be restored"}: {pointsRedeemed.toLocaleString("en-IN")} Loyalty Points
          </div>
        )}

        {couponDiscount > 0 && (
          <div className="text-red-600 font-bold">
            Voided: ₹{couponDiscount.toLocaleString("en-IN")} Coupon Discount (Code: {order.couponCode || "N/A"})
          </div>
        )}
      </div>
    );
  };

  const getStatusPillColor = () => {
    if (s.includes("transit") || s === "shipped") return "bg-primary text-white";
    if (s.includes("audit") || s.includes("pending") || s.includes("processing") || s === "paid") {
      return "bg-[#fed488] text-primary font-bold";
    }
    if (s === "delivered") return "bg-green-600 text-white";
    if (s === "returned") return "bg-red-600 text-white";
    return "bg-gray-500 text-white";
  };

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      {/* Header section */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <Link href="/admindashboard/orders" className="hover:text-primary transition-colors">
              Orders
            </Link>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Order Details</span>
          </nav>
          <div className="flex items-center gap-6 flex-wrap">
            <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
              Order #{order.id}
            </h2>
            <span className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-none ${getStatusPillColor()}`}>
              {order.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            Review and update customer order details and transition timelines.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="size-12 flex items-center justify-center bg-white border border-gray-200 hover:bg-primary hover:text-white transition-all shadow-sm rounded-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <Link
            href={`/invoice?orderId=${order.id}`}
            className="bg-primary text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg flex items-center justify-center rounded-none"
          >
            View Invoice
          </Link>
        </div>
      </header>

      {/* Returns Warning Banner */}
      {s.includes("return") && (
        <div
          className={`mb-12 border p-6 flex items-start gap-4 rounded-none ${
            s === "return requested"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : s === "return in transit"
              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
              : s === "return rejected"
              ? "bg-gray-50 border-gray-200 text-gray-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span className="material-symbols-outlined text-2xl">
            {s === "return requested"
              ? "info"
              : s === "return in transit"
              ? "local_shipping"
              : s === "return rejected"
              ? "cancel"
              : "warning"}
          </span>
          <div className="w-full">
            <h4 className="text-xs font-black uppercase tracking-widest">
              Return Request Activity: {order.status}
            </h4>
            <p className="text-xs mt-2 font-medium">
              Registered Date: <span className="font-bold">{order.returnDate || order.returnRequestDate || order.date}</span>
            </p>
            <p className="text-xs mt-1 font-semibold italic text-black/70">
              Reason: "{order.returnReason || "No details provided"}"
            </p>
            {order.returnDetails && (
              <p className="text-[10px] mt-1 font-medium opacity-80">
                Merchant Notes: {order.returnDetails}
              </p>
            )}

            {renderRefundBreakdown()}

            {order.returnImage && order.returnImage !== "No image provided" && (
              <div className="mt-4">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-100 px-3 py-1 inline-block border border-blue-200/50 rounded-none">
                  Attached Verification Photo: {order.returnImage}
                </span>
              </div>
            )}

            {/* Return AWB display */}
            {(order.returnAwb || order.return_awb) && (
              <div className="mt-6 pt-6 border-t border-black/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[9px] text-[#0a0a0a] font-black uppercase tracking-widest block mb-1">
                      Return Pickup AWB
                    </span>
                    <span className="font-mono text-xs font-bold text-[#0a0a0a] bg-black/5 px-2 py-1 select-all">
                      {order.returnAwb || order.return_awb}
                    </span>
                    {(order.returnAwb || order.return_awb || "").startsWith("MOCK-") && (
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1 italic">
                        (Mock — real AWB after Shiprocket credentials configured)
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://shiprocket.co/tracking/${order.returnAwb || order.return_awb}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#0a0a0a] text-white hover:bg-secondary transition-all px-4 py-2.5 text-[9px] font-black uppercase tracking-widest self-start rounded-none"
                  >
                    <span className="material-symbols-outlined text-sm">local_shipping</span>
                    Track Return
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid columns */}
      <div className="grid grid-cols-12 gap-12">
        {/* Left Side: Order details summary */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-12">
          <div className="bg-white border border-gray-200 p-10 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-12 rounded-none">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Logistics Status</p>
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    s === "returned" ? "bg-red-500" : s === "cancelled" ? "bg-gray-500" : s === "delivered" ? "bg-green-500" : "bg-amber-500"
                  }`}
                ></span>
                <p className="text-xs font-black uppercase tracking-widest">{order.status}</p>
              </div>
              {(s === "shipped" || s === "delivered" || s.includes("transit")) && (
                <div className="mt-2">
                  <Link
                    href={`/ordertracking?orderId=${order.id}`}
                    target="_blank"
                    className="text-[9px] font-black text-secondary hover:text-primary transition-colors uppercase tracking-widest flex items-center gap-1 mt-1"
                  >
                    <span className="material-symbols-outlined text-[10px]">local_shipping</span>
                    AWB: SR-{order.id.replace("ORD-", "")} (Track)
                  </Link>
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Order Date</p>
              <p className="text-xs font-black uppercase tracking-widest">{order.date}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Payment Gateway</p>
              <p className="text-xs font-black uppercase tracking-widest">{gatewayText}</p>
            </div>
          </div>

          {/* Table summary */}
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
            <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0a0a0a]">
                Ordered Items ({order.items.length})
              </h3>
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-100">
                {order.items.map((itemName, index) => {
                const prod = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase()) || {
                  id: "N/A",
                  title: itemName,
                  price: itemName.includes("Linen") ? 14500 : 1450,
                  image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200",
                  category: "Cotton",
                };
                  return (
                    <tr key={index} className="group">
                      <td className="p-8 w-32">
                        <div className="size-20 bg-gray-50 border border-gray-200 p-1 rounded-none flex items-center justify-center grayscale overflow-hidden group-hover:grayscale-0 transition-all">
                          <img src={prod.image} className="w-full h-full object-cover" alt={prod.title} />
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase tracking-tight">{prod.title}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            SKU: {prod.id || "N/A"} • Qty: 01
                          </span>
                        </div>
                      </td>
                      <td className="p-8 text-right font-headline font-black text-sm">
                        ₹{(prod.price || 0).toLocaleString("en-IN")}.00
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Valuation recap matrix */}
            <div className="p-8 bg-[#fafafa] border-t border-gray-200 flex flex-col gap-3">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>Subtotal (Original Price)</span>
                <span>₹{originalTotal.toLocaleString("en-IN")}.00</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                  <span>Coupon Discount ({order.couponCode || "N/A"})</span>
                  <span>-₹{couponDiscount.toLocaleString("en-IN")}.00</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                  <span>Loyalty Discount ({order.pointsRedeemed} pts)</span>
                  <span>-₹{pointsDiscount.toLocaleString("en-IN")}.00</span>
                </div>
              )}
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400 border-t border-gray-200/50 pt-2">
                <span>Net Total</span>
                <span>₹{order.total.toLocaleString("en-IN")}.00</span>
              </div>
              {walletPaid > 0 && (
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-secondary">
                  <span>Paid via Store Wallet</span>
                  <span>-₹{walletPaid.toLocaleString("en-IN")}.00</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200 text-primary">
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {finalGatewayAmount === 0 ? "Total Paid (Wallet)" : "Grand Total / Gateway Paid"}
                </span>
                <span className="text-2xl font-headline font-black tracking-tighter text-[#0a0a0a]">
                  ₹{(finalGatewayAmount === 0 ? walletPaid : finalGatewayAmount).toLocaleString("en-IN")}.00
                </span>
              </div>
              {order.pointsEarned > 0 && (
                <div className="mt-2 text-right">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-[8px] font-black uppercase tracking-widest rounded-none border border-green-200/50">
                    +{order.pointsEarned} Loyalty Points Awarded
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="p-8 border border-gray-200 bg-white">
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary mb-6">
              Activity Timeline
            </h3>
            {eventsLoading ? (
              <p className="text-xs text-gray-400 italic">Loading events…</p>
            ) : orderEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No events recorded.</p>
            ) : (
              <ol className="relative border-l-2 border-gray-200 pl-6 space-y-6">
                {orderEvents.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[31px] top-1 w-3 h-3 bg-primary border-2 border-white rounded-full" />
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                      {new Date(ev.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-sm font-bold text-primary mt-1">
                      {ev.description}
                    </div>
                    {ev.actor && (
                      <div className="text-[10px] text-gray-400 mt-1 italic">
                        by {ev.actor}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Internal Notes Section */}
          <div className="p-8 border border-gray-200 bg-white">
            <div className="mb-6">
              <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
                Internal Notes
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                Visible to admin only — not shown to customers
              </p>
            </div>

            {/* Notes List */}
            {notesLoading ? (
              <p className="text-xs text-gray-400 italic mb-6">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-6">
                No notes yet. Add a note to keep track of important order information.
              </p>
            ) : (
              <div className="space-y-4 mb-8">
                {notes.map((note) => {
                  const getRelativeTime = (isoString: string) => {
                    const diffMs = Date.now() - new Date(isoString).getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    if (diffMins < 1) return "just now";
                    if (diffMins < 60) return `${diffMins}m ago`;
                    const diffHours = Math.floor(diffMins / 60);
                    if (diffHours < 24) return `${diffHours}h ago`;
                    const diffDays = Math.floor(diffHours / 24);
                    return `${diffDays}d ago`;
                  };
                  return (
                    <div key={note.id} className="p-4 bg-gray-50 border border-gray-100 flex justify-between gap-4 animate-fade-in">
                      <div className="space-y-1 w-full">
                        <p className="text-xs font-semibold text-primary font-mono whitespace-pre-wrap leading-relaxed select-text">
                          {note.note}
                        </p>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5 pt-1">
                          <span>by {note.createdBy}</span>
                          <span>•</span>
                          <span>{getRelativeTime(note.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer self-start p-1"
                        title="Delete Note"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Note Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleAddNote(); }} className="space-y-3 pt-6 border-t border-dashed border-gray-100">
              <div className="flex justify-between items-baseline">
                <label className="text-[9px] font-black uppercase tracking-widest text-[#0a0a0a]">
                  Add Note
                </label>
                <span className={`text-[9px] font-black uppercase tracking-widest ${
                  newNoteText.length > 450 ? "text-orange-600 font-bold" : "text-gray-400"
                }`}>
                  {newNoteText.length}/500 characters
                </span>
              </div>
              <textarea
                placeholder="Add an internal note about this order..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                maxLength={500}
                className="w-full bg-white border border-gray-200 p-4 text-xs font-semibold outline-none focus:border-primary rounded-none h-24 resize-none"
              />
              <button
                type="submit"
                disabled={!newNoteText.trim() || newNoteText.length > 500 || noteSubmitting}
                className={`bg-primary text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all rounded-none cursor-pointer border-none font-bold ${
                  (!newNoteText.trim() || newNoteText.length > 500 || noteSubmitting) ? "opacity-55 cursor-not-allowed bg-gray-400" : ""
                }`}
              >
                {noteSubmitting ? "Adding..." : "Add Note"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Action panel */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          {/* Customer dossier */}
          <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">Customer Dossier</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="size-12 border border-gray-200 grayscale rounded-none flex items-center justify-center bg-gray-50 text-gray-300">
                <span className="material-symbols-outlined text-lg">person</span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">{order.customer}</p>
                <p className="text-[9px] text-gray-400 font-bold lowercase tracking-wider mt-0.5">
                  {order.customer.toLowerCase().replace(/\s+/g, ".")}@example.com
                </p>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Delivery Address</p>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide leading-relaxed italic">
                Apt 402, Sky-High Residency<br />
                7th Main, Sector 4, HSR Layout<br />
                Bengaluru, Karnataka 560102<br />
                India
              </p>
            </div>
          </div>

          {/* Payment Status Card */}
          <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">Payment Status</h3>
            {(() => {
              const isPending = order.status.toLowerCase() === "payment pending";
              const totalAmount = order.total || 0;
              const wPaid = order.walletPaid || 0;
              const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, totalAmount - wPaid);

              if (isPending) {
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm">pending_actions</span>
                      <span>⏳ Awaiting Payment</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-100 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Amount Due</span>
                      <span className="text-sm font-headline font-black text-[#775a19]">₹{totalAmount.toLocaleString("en-IN")}.00</span>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>✓ Payment Confirmed</span>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-gray-100 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Razorpay Gateway</span>
                      <span className="font-semibold text-primary">₹{gPaid.toLocaleString("en-IN")}.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Store Wallet</span>
                      <span className="font-semibold text-primary">₹{wPaid.toLocaleString("en-IN")}.00</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 font-black">
                      <span className="text-[10px] uppercase tracking-widest text-[#0a0a0a]">Total Paid</span>
                      <span className="text-sm font-headline text-[#775a19]">₹{totalAmount.toLocaleString("en-IN")}.00</span>
                    </div>
                  </div>
                  {(order.razorpay_payment_id || order.id) && (
                    <div className="pt-3 border-t border-dashed border-gray-100 space-y-1 text-[9px] text-gray-400 font-mono">
                      {order.razorpay_payment_id && (
                        <p className="truncate">Payment ID: {order.razorpay_payment_id}</p>
                      )}
                      <p className="truncate">Order Ref: {order.id}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Action station container */}
          <div className="bg-primary text-white p-8 shadow-2xl rounded-none">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#fed488] mb-8">Administrative Actions</h3>

            {/* CASE 1: Standard Order Flows */}
            {!s.includes("return") && s !== "returned" && s !== "cancelled" && (
              <div className="space-y-6">
                {s === "payment pending" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 text-xs text-[#fed488] font-bold uppercase tracking-wider leading-relaxed">
                      Warning: Payment stuck in bank portal or verification is pending.
                    </div>
                    <button
                      onClick={handleApprovePendingOrder}
                      className="w-full bg-[#fed488] text-primary py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none"
                    >
                      <span className="material-symbols-outlined text-sm">payments</span> Clear Bank Clearance
                    </button>
                    <button
                      onClick={() => openRefundModal("cancel")}
                      className="w-full text-red-400 hover:text-red-500 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-transparent border border-transparent cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}

                {s === "paid" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 text-xs text-[#fed488] font-bold uppercase tracking-wider leading-relaxed">
                      Awaiting invoice generation to begin processing.
                    </div>
                    <Link
                      href={`/invoice?orderId=${order.id}`}
                      className="w-full bg-[#fed488] text-primary py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none text-center"
                    >
                      <span className="material-symbols-outlined text-sm">print</span> Print Invoice &amp; Process
                    </Link>
                    <button
                      onClick={() => openRefundModal("cancel")}
                      className="w-full text-red-400 hover:text-red-500 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-transparent border border-transparent cursor-pointer"
                    >
                      Cancel Order (Refund)
                    </button>
                  </div>
                )}

                {s === "processing" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 text-xs text-[#fed488] font-bold uppercase tracking-wider leading-relaxed">
                      Order is processing. Ready to dispatch.
                    </div>
                    <button
                      onClick={handleShiprocketShip}
                      className="w-full bg-[#fed488] text-primary py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none"
                    >
                      <span className="material-symbols-outlined text-sm">local_shipping</span> Ship via Shiprocket
                    </button>
                    <button
                      onClick={() => openRefundModal("cancel")}
                      className="w-full text-red-400 hover:text-red-500 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-transparent border border-transparent cursor-pointer"
                    >
                      Cancel Order (Stock Issue)
                    </button>
                  </div>
                )}

                {s === "shipped" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 text-xs text-[#fed488] font-bold uppercase tracking-wider leading-relaxed">
                      Dispatched AWB: <span className="font-mono text-white">{order.shiprocketId}</span>
                    </div>
                    <button
                      onClick={() => handleUpdateStatus("Delivered")}
                      className="w-full bg-[#fed488] text-primary py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span> Mark as Delivered
                    </button>
                  </div>
                )}

                {s === "delivered" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 text-xs text-green-400 font-bold uppercase tracking-wider text-center">
                      Delivered successfully.
                    </div>
                    {order.status === "Delivered" && !order.refund_status && (
                      <button
                        onClick={() => openRefundModal("issue")}
                        className="w-full bg-[#fed488] text-primary py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none"
                      >
                        <span className="material-symbols-outlined text-sm">payments</span> Issue Refund
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CASE 2: Return Requested Actions */}
            {s === "return requested" && (
              <div className="space-y-4">
                <button
                  onClick={handleApprovePickup}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none"
                >
                  Approve & Schedule Pickup
                </button>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="w-full text-red-500 border border-red-500/30 py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/10 transition-all bg-transparent rounded-none cursor-pointer"
                >
                  Reject Return Request
                </button>
              </div>
            )}

            {/* CASE 3: Return In Transit Actions */}
            {s === "return in transit" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/70">
                    Quality Audit Status
                  </label>
                  <select
                    value={qualityCheck}
                    onChange={(e) => setQualityCheck(e.target.value as any)}
                    className="w-full bg-white/10 text-white border border-white/20 px-3 py-3 text-[10px] font-black tracking-widest uppercase focus:border-[#fed488] focus:ring-0 rounded-none cursor-pointer"
                  >
                    <option className="text-[#0a0a0a] font-bold" value="passed">
                      QC: Passed (Restock Item)
                    </option>
                    <option className="text-[#0a0a0a] font-bold" value="failed">
                      QC: Failed (Do Not Restock)
                    </option>
                  </select>
                </div>
                <button
                  onClick={() => openRefundModal("return")}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 rounded-none cursor-pointer border-none mt-2"
                >
                  Confirm Receipt & Refund
                </button>
              </div>
            )}

            {/* CASE 4: Complete/Archived states disabled */}
            {(s === "returned" || s === "cancelled" || s === "return rejected") && (
              <div className="text-center py-6 text-white/50 text-[10px] font-black uppercase tracking-widest">
                No active actions available for {order.status} orders.
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] leading-relaxed">
                <span className="material-symbols-outlined text-xs align-middle mr-1.5">warning</span>
                Merchant actions directly update local inventory values and client ledgers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Refund Status Display */}
      {order.refund_status && (
        <div className={`mt-12 border p-6 flex items-start gap-4 rounded-none ${
          order.refund_status === "processed"
            ? "bg-green-50 border-green-200 text-green-800"
            : order.refund_status === "initiated"
            ? "bg-blue-50 border-blue-200 text-blue-800"
            : order.refund_status === "wallet_only"
            ? "bg-purple-50 border-purple-200 text-purple-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <span className="material-symbols-outlined text-2xl">
            {order.refund_status === "processed"
              ? "check_circle"
              : order.refund_status === "initiated"
              ? "pending"
              : order.refund_status === "wallet_only"
              ? "account_balance_wallet"
              : "error"}
          </span>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-2">
              Refund Status: {order.refund_status.replace(/_/g, " ").toUpperCase()}
            </h4>
            {order.refund_amount !== undefined && (
              <p className="text-xs font-bold">Amount: ₹{order.refund_amount.toLocaleString("en-IN")}</p>
            )}
            {order.refund_reason && (
              <p className="text-xs font-medium mt-1">Reason: {order.refund_reason}</p>
            )}
            {order.refund_id && (
              <p className="text-[10px] font-mono mt-1 opacity-70">Refund ID: {order.refund_id}</p>
            )}
            {order.refunded_at && (
              <p className="text-[10px] mt-1 opacity-70">
                Processed: {new Date(order.refunded_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-md w-full border border-gray-200 shadow-2xl relative rounded-none text-left">
            <h3 className="font-headline text-2xl font-black uppercase tracking-tight mb-4 text-primary">
              Reject Return
            </h3>
            <p className="text-[9px] text-gray-500 mb-6 uppercase tracking-widest font-black">
              Specify reason for return rejection:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 focus:border-[#0a0a0a] focus:ring-0 text-xs py-3 rounded-none bg-[#f9fafb] text-[#111827] mb-6"
              placeholder="e.g. Item returned damaged or outside 7-day window limit."
            />
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason("");
                }}
                className="flex-1 border border-gray-200 text-gray-600 py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-gray-50 transition-colors rounded-none bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectReturn}
                className="flex-1 bg-red-600 text-white py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-red-700 transition-colors rounded-none font-bold cursor-pointer border-none"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-md w-full border border-gray-200 shadow-2xl relative rounded-none text-left">
            <h3 className="font-headline text-2xl font-black uppercase tracking-tight mb-2 text-primary">
              {refundActionType === "cancel"
                ? "Cancel & Refund"
                : refundActionType === "return"
                ? "Confirm Receipt & Refund"
                : "Issue Refund"}
            </h3>
            <p className="text-[9px] text-gray-500 mb-6 uppercase tracking-widest font-black">
              Order #{order.id}
            </p>
            {refundActionType === "return" && (
              <div className="mb-4">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Quality Check Result
                </label>
                <select
                  value={refundQualityCheck}
                  onChange={(e) => setRefundQualityCheck(e.target.value as "passed" | "failed")}
                  className="w-full border border-gray-200 focus:border-[#0a0a0a] focus:ring-0 text-xs py-3 px-3 rounded-none bg-[#f9fafb] text-[#111827] mb-2"
                >
                  <option value="passed">QC: Passed (Restock Item)</option>
                  <option value="failed">QC: Failed (Do Not Restock)</option>
                </select>
              </div>
            )}
            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
              Reason
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 focus:border-[#0a0a0a] focus:ring-0 text-xs py-3 px-3 rounded-none bg-[#f9fafb] text-[#111827] mb-6"
              placeholder="Enter reason for this refund action..."
            />
            <div className="flex gap-4">
              <button
                onClick={closeRefundModal}
                disabled={refundLoading}
                className="flex-1 border border-gray-200 text-gray-600 py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-gray-50 transition-colors rounded-none bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                disabled={refundLoading}
                className="flex-1 bg-primary text-white py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-secondary transition-colors rounded-none cursor-pointer border-none disabled:opacity-50"
              >
                {refundLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/25 shadow-2xl p-8 max-w-md w-full space-y-6 text-center rounded-none animate-zoom-in">
            <div className="mx-auto w-12 h-12 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
            <div className="space-y-3">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-primary">{confirmModalTitle}</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed whitespace-pre-line text-left border border-gray-100 p-4 bg-gray-50 max-h-[220px] overflow-y-auto">
                {confirmModalDesc}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmModalOpen(false);
                  setConfirmCallback(null);
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirmCallback) {
                    await confirmCallback();
                  }
                  setConfirmModalOpen(false);
                  setConfirmCallback(null);
                }}
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

export default function OrderDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary mx-auto"></div>
        </div>
      }
    >
      <OrderDetailsContent />
    </Suspense>
  );
}
