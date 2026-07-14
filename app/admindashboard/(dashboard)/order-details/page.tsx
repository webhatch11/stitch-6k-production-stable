"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Order, Product, OrderNote } from "@/lib/types";
import { getOrdersAction, getProductsAction, getCustomerProfileAction } from "@/app/actions/admin-reads";
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
  verifyPaymentAction,
  verifyRefundAction,
  generateShipmentLabelAction,
  getShipmentByOrderIdAction,
} from "@/app/actions/admin-orders";

function OrderDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerProfile, setCustomerProfile] = useState<{ name: string | null; email: string | null; phone: string | null } | null>(null);
  const [qualityCheck, setQualityCheck] = useState<"passed" | "failed">("passed");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [verifyingRefund, setVerifyingRefund] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [manifestDownloadUrl, setManifestDownloadUrl] = useState<string | null>(null);
  const [shipment, setShipment] = useState<any>(null);

  const handlePrintShippingLabel = async () => {
    if (!order) return;
    setPrintingLabel(true);
    try {
      const res = await generateShipmentLabelAction(order.id);
      if (res.success && res.labelUrl) {
        window.open(res.labelUrl, "_blank");
        triggerToast("Label opened in new tab");
        if (res.manifestUrl) {
          setManifestDownloadUrl(res.manifestUrl);
        }
      } else {
        triggerToast(res.error || "Failed to generate shipping label");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to generate shipping label");
    } finally {
      setPrintingLabel(false);
    }
  };

  const handleVerifyRefund = async () => {
    if (!order || verifyingRefund) return;
    setVerifyingRefund(true);
    const res = await verifyRefundAction(order.id);
    setVerifyingRefund(false);
    if (res.success) {
      triggerToast(`Refund status updated: ${res.status}`);
      await loadOrderDetails();
    } else {
      triggerToast(res.error || "Failed to verify refund");
    }
  };

  const handleVerifyPayment = async () => {
    if (!order || verifyingPayment) return;
    setVerifyingPayment(true);
    const res = await verifyPaymentAction(order.id);
    setVerifyingPayment(false);
    if (res.success) {
      if (res.status === "activated") {
        triggerToast("Payment confirmed. Order activated.");
        await loadOrderDetails();
      } else if (res.status === "failed") {
        triggerToast("Payment failed. Order cancelled.");
        await loadOrderDetails();
      } else {
        triggerToast(`Payment status: ${res.status}. No changes made.`);
      }
    } else {
      triggerToast(res.error || "Failed to verify payment");
    }
  };

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
  }, [orderId]);

  const loadOrderDetails = async () => {
    const ordersRes = await getOrdersAction();
    let currentOrder: Order | null = null;
    if (ordersRes.success) {
      const list = ordersRes.orders || [];
      const matched = list.find((o) => o.id === orderId) || (list.length > 0 ? list[0] : null);
      setOrder(matched ?? null);
      currentOrder = matched ?? null;
    }
    const prodsRes = await getProductsAction();
    if (prodsRes.success) setProducts(prodsRes.products || []);

    if (currentOrder) {
      loadEvents(currentOrder.id);
      loadNotes(currentOrder.id);
      
      getShipmentByOrderIdAction(currentOrder.id).then((shipmentRes) => {
        if (shipmentRes.success && shipmentRes.shipment) {
          setShipment(shipmentRes.shipment);
          if (shipmentRes.shipment.manifest_url) {
            setManifestDownloadUrl(shipmentRes.shipment.manifest_url);
          }
        } else {
          setShipment(null);
        }
      }).catch(err => console.error("Error loading shipment details:", err));
      
      const uId = currentOrder.userId || currentOrder.user_id;
      if (uId) {
        const profileRes = await getCustomerProfileAction(uId);
        if (profileRes.success && profileRes.profile) {
          setCustomerProfile(profileRes.profile);
        } else {
          setCustomerProfile(null);
        }
      } else {
        setCustomerProfile(null);
      }
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

  const getStatusPillInlineStyle = () => {
    if (s === "delivered") return { backgroundColor: "var(--bg-success)", color: "var(--text-success)" };
    if (s === "shipped" || s === "processing" || s.includes("pending") || s.includes("audit") || s === "paid") {
      return { backgroundColor: "var(--bg-warning)", color: "var(--text-warning)" };
    }
    if (s === "cancelled" || s.includes("return")) {
      return { backgroundColor: "var(--bg-danger)", color: "var(--text-danger)" };
    }
    return { backgroundColor: "var(--surface-1)", color: "var(--text-secondary)" };
  };

  const getLogisticsStatusDotClass = () => {
    if (s === "returned" || s === "cancelled") return "bg-red-500";
    if (s === "delivered") return "bg-green-500";
    return "bg-amber-500";
  };

  const toProperCase = (str: string) => {
    if (!str) return "";
    return str.toLowerCase()
      .split(' ')
      .map(word => {
        if (word.startsWith("no:")) {
          return "No:" + word.slice(3);
        }
        if (word === "hsr") return "HSR";
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#ffffff] p-8 lg:p-16">
      {/* Dynamic Styling Overrides for Dark Mockup Appearance */}
      <style>{`
        :root {
          --surface-2: #16161a;
          --surface-1: #222228;
          --border: #25252b;
          --border-strong: #33333d;
          --text-primary: #ffffff;
          --text-secondary: #a0a0ab;
          --text-muted: #60606b;
          --bg-success: rgba(16, 185, 129, 0.15);
          --text-success: #10b981;
          --bg-warning: rgba(245, 158, 11, 0.15);
          --text-warning: #f59e0b;
          --bg-danger: rgba(239, 68, 68, 0.15);
          --text-danger: #ef4444;
          --border-warning: rgba(245, 158, 11, 0.3);
          --border-danger: rgba(239, 68, 68, 0.3);
          --radius: 8px;
        }

        /* Set page wrapper environment to dark */
        body {
          background-color: #0c0c0e !important;
        }
      `}</style>

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
            <span className="text-gray-400">Admin</span>
            <span className="material-symbols-outlined text-xs opacity-30">chevron_right</span>
            <Link href="/admindashboard/orders" className="text-gray-400 hover:text-primary transition-colors">
              Orders
            </Link>
            <span className="material-symbols-outlined text-xs opacity-30">chevron_right</span>
            <span className="text-white italic">{order.id}</span>
          </nav>
          <div className="flex items-center gap-6 flex-wrap">
            <h2 className="text-3xl font-headline font-black tracking-tight uppercase leading-none" style={{ color: "var(--text-primary)" }}>
              Order #{order.id}
            </h2>
            <span
              className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-[4px]"
              style={getStatusPillInlineStyle()}
            >
              {order.status}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium tracking-wide">
            Placed {order.date} - {gatewayText}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/invoice?orderId=${order.id}`}
            className="border border-[#25252b] bg-[#16161a] hover:bg-[#222228] text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center rounded-[6px]"
          >
            📄 View invoice
          </Link>
          <button
            onClick={() => router.back()}
            className="border border-[#25252b] bg-[#16161a] hover:bg-[#222228] text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center rounded-[6px] cursor-pointer"
          >
            ← Back
          </button>
        </div>
      </header>

      {/* Main Grid: 2 columns layout matching mockup template */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        
        {/* Left Column (Main Details) */}
        <div className="flex flex-col gap-8">
          
          {/* 1. Order Meta Strip */}
          <div
            className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Logistics status</p>
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${getLogisticsStatusDotClass()}`}></span>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>{order.status}</p>
              </div>
              {order.shiprocketId ? (
                <div className="mt-1.5 space-y-1">
                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                    AWB: <span className="font-bold text-white font-mono">{shipment?.awb_code || order.shiprocketId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shipment?.awb_code || order.shiprocketId || "");
                        triggerToast("AWB copied to clipboard");
                      }}
                      className="inline-flex items-center justify-center p-0.5 hover:text-white text-gray-400 bg-transparent border-none cursor-pointer"
                      title="Copy AWB"
                    >
                      <span className="material-symbols-outlined text-[10px]">content_copy</span>
                    </button>
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium block">
                    Courier: <span className="font-bold text-white">{shipment?.courier_name || "Shiprocket Partner"}</span>
                  </span>
                  {shipment?.label_url && (
                    <span className="text-[10px] text-gray-400 font-medium block">
                      Label: <a href={shipment.label_url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-white font-bold underline">Download</a>
                    </span>
                  )}
                </div>
              ) : (s === "shipped" || s === "delivered" || s.includes("transit")) ? (
                <div className="mt-1">
                  <span className="text-[10px] text-gray-400 font-medium block">
                    AWB: IN-2026-SMRT (Fraud)
                  </span>
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Order date</p>
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{order.date}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Payment gateway</p>
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{gatewayText}</p>
            </div>
          </div>

          {/* 2. Ordered Items Card */}
          <div
            className="overflow-hidden"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <div className="p-6 border-b border-gray-200/10 bg-[#fafafa]/5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                ORDERED ITEMS ({order.items.length})
              </h3>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              {order.items.map((itemName, index) => {
                const prod = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase()) || {
                  id: "FLNL-SHIRT-GREY",
                  title: itemName,
                  price: 1568,
                  image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200",
                  category: "Cotton",
                };
                return (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="size-14 bg-[#222228] border border-gray-800 p-1 rounded-[6px] flex items-center justify-center overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={prod.image} className="w-full h-full object-cover rounded-[4px]" alt={prod.title} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{prod.title}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                          SKU: {prod.id || "N/A"} - Size M - Qty 1
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      ₹{(prod.price || 0).toLocaleString("en-IN")}.00
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 3. Financial Recap Card nested inside Items card to mirror mockup structure */}
            <div className="p-6 bg-[#121215] border-t border-gray-200/10 flex flex-col gap-3">
              <div className="flex justify-between items-center text-[11px] font-medium text-gray-400">
                <span>Subtotal (original price)</span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>₹{originalTotal.toLocaleString("en-IN")}.00</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between items-center text-[11px] font-medium text-red-400">
                  <span>Coupon Discount ({order.couponCode || "N/A"})</span>
                  <span className="font-bold">-₹{couponDiscount.toLocaleString("en-IN")}.00</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between items-center text-[11px] font-medium text-red-400">
                  <span>Loyalty Discount ({order.pointsRedeemed} pts)</span>
                  <span className="font-bold">-₹{pointsDiscount.toLocaleString("en-IN")}.00</span>
                </div>
              )}
              <div className="flex justify-between items-center text-[11px] font-medium text-gray-400">
                <span>GST (12%)</span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>₹11.00</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-medium text-gray-400">
                <span>Shipping</span>
                <span className="text-green-500 font-bold">Free</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200/10 text-primary">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  Grand total / gateway paid
                </span>
                <span className="text-sm font-bold font-headline" style={{ color: "var(--text-primary)" }}>
                  ₹{order.total.toLocaleString("en-IN")}.00
                </span>
              </div>
            </div>
          </div>

          {/* 4. Returns Banner (Conditional placement here in the left stack) */}
          {s.includes("return") && (
            <div
              className="border p-6 flex items-start gap-4 rounded-none"
              style={{
                backgroundColor: s === "return requested" ? "var(--bg-warning)" : s === "return in transit" ? "var(--bg-warning)" : "var(--bg-danger)",
                borderColor: s === "return rejected" ? "var(--border)" : "var(--border-strong)"
              }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: s.includes("rejected") ? "var(--text-secondary)" : "var(--text-danger)" }}>
                {s === "return requested"
                  ? "info"
                  : s === "return in transit"
                  ? "local_shipping"
                  : s === "return rejected"
                  ? "cancel"
                  : "warning"}
              </span>
              <div className="w-full">
                <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                  Return Request Activity: {order.status}
                </h4>
                <p className="text-xs mt-2 font-medium" style={{ color: "var(--text-secondary)" }}>
                  Registered Date: <span className="font-bold">{order.returnDate || order.returnRequestDate || order.date}</span>
                </p>
                <p className="text-xs mt-1 font-semibold italic" style={{ color: "var(--text-primary)" }}>
                  Reason: "{order.returnReason || "No details provided"}"
                </p>
                {order.returnDetails && (
                  <p className="text-[10px] mt-1 font-medium opacity-80" style={{ color: "var(--text-secondary)" }}>
                    Merchant Notes: {order.returnDetails}
                  </p>
                )}

                {/* Split refund breakdown display */}
                <div className="space-y-1.5 mt-2 text-xs">
                  {order.refundOption === "wallet" ? (
                    <div className="font-bold" style={{ color: "var(--text-primary)" }}>Pending Wallet Refund: ₹{(gatewayPaid + walletPaid).toLocaleString("en-IN")}</div>
                  ) : (
                    <>
                      {gatewayPaid > 0 && (
                        <div className="font-bold" style={{ color: "var(--text-primary)" }}>Refund to Bank: ₹{gatewayPaid.toLocaleString("en-IN")}</div>
                      )}
                      {walletPaid > 0 && (
                        <div className="font-bold" style={{ color: "var(--text-primary)" }}>Refund to Wallet: ₹{walletPaid.toLocaleString("en-IN")}</div>
                      )}
                    </>
                  )}
                </div>

                {order.returnImage && order.returnImage !== "No image provided" && (
                  <div className="mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-black/5 px-3 py-1 inline-block border border-black/10 rounded-none" style={{ color: "var(--text-primary)" }}>
                      Attached Photo: {order.returnImage}
                    </span>
                  </div>
                )}

                {/* Return AWB display */}
                {(order.returnAwb || order.return_awb) && (
                  <div className="mt-6 pt-6 border-t border-black/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: "var(--text-secondary)" }}>
                          Return Pickup AWB
                        </span>
                        <span className="font-mono text-xs font-bold bg-black/5 px-2 py-1 select-all" style={{ color: "var(--text-primary)" }}>
                          {order.returnAwb || order.return_awb}
                        </span>
                        {(order.returnAwb || order.return_awb || "").startsWith("MOCK-") && (
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1 italic">
                            (Mock Reverse Logistic Routing)
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

          {/* 5. Activity Timeline Card */}
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6" style={{ color: "var(--text-secondary)" }}>
              ACTIVITY TIMELINE
            </h3>
            {eventsLoading ? (
              <p className="text-xs text-gray-400 italic">Loading events…</p>
            ) : orderEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No activity recorded yet</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-800">
                {orderEvents.map((ev, index) => {
                  let dotColor = "bg-green-500"; // Past events
                  if (index === 0) {
                    dotColor = "bg-blue-500"; // Most recent event
                  }
                  
                  return (
                    <div key={ev.id || index} className="relative flex flex-col gap-1">
                      <span className={`absolute -left-[26px] top-1.5 w-3 h-3 rounded-full border-2 border-[#16161a] ${dotColor}`} />
                      <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        {ev.description || ev.message}
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        {new Date(ev.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {ev.actor && ` - ${ev.actor}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Internal Notes Card */}
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <div className="mb-6">
              <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                INTERNAL NOTES
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                Visible to admins only - not shown to customers
              </p>
            </div>

            {/* Notes List */}
            {notesLoading ? (
              <p className="text-xs text-gray-400 italic mb-6">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-6">
                No notes yet. Add one below.
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
                    <div key={note.id} className="p-4 flex justify-between gap-4 animate-fade-in" style={{ backgroundColor: "var(--surface-1)", border: "0.5px solid var(--border)" }}>
                      <div className="space-y-1 w-full">
                        <p className="text-xs font-semibold font-mono whitespace-pre-wrap leading-relaxed select-text" style={{ color: "var(--text-primary)" }}>
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
            <form onSubmit={(e) => { e.preventDefault(); handleAddNote(); }} className="space-y-3 pt-6 border-t border-dashed border-gray-200/20">
              <textarea
                placeholder="Add a note about this order..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                maxLength={500}
                className="w-full p-4 text-xs font-semibold outline-none focus:border-primary rounded-[6px] h-24 resize-none"
                style={{
                  backgroundColor: "var(--surface-1)",
                  border: "0.5px solid var(--border)",
                  color: "var(--text-primary)"
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className={`text-[9px] font-black uppercase tracking-widest ${
                  newNoteText.length > 450 ? "text-orange-600 font-bold" : "text-gray-400"
                }`}>
                  {newNoteText.length}/500 characters
                </span>
                <button
                  type="submit"
                  disabled={!newNoteText.trim() || newNoteText.length > 500 || noteSubmitting}
                  className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-[6px] border border-gray-800 bg-[#16161a] hover:bg-[#222228] text-white disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  {noteSubmitting ? "Adding..." : "Add note"}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column (Sidebar Panels) */}
        <div className="flex flex-col gap-8">
          
          {/* 1. Customer Dossier Card */}
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6" style={{ color: "var(--text-secondary)" }}>CUSTOMER</h3>
            {(() => {
              const isFakeEmail = (email: string) => 
                !email || 
                email.includes('@example.com') ||
                email.includes('@placeholder') ||
                email.includes('@test.com') ||
                email === 'aditya.singhania@heritage.com';

              const profileEmail = customerProfile?.email || "";
              const snapshotEmail = order.address_snapshot?.email || "";
              let displayEmail = "Email not provided";
              if (profileEmail && !isFakeEmail(profileEmail)) {
                displayEmail = profileEmail;
              } else if (snapshotEmail && !isFakeEmail(snapshotEmail)) {
                displayEmail = snapshotEmail;
              }

              const customerName = customerProfile?.name || order.address_snapshot?.name || order.customer;
              const phone = customerProfile?.phone || order.address_snapshot?.phone || "Not provided";
              const addr = order.address_snapshot;
              const initials = customerName ? customerName.slice(0, 2).toUpperCase() : "NC";

              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="size-11 rounded-full bg-[#1e293b] text-[#38bdf8] flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      {initials}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>{customerName}</p>
                      <p className="text-[10px] text-gray-500 font-bold tracking-wider mt-0.5">
                        First order
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 text-xs font-medium text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">phone</span>
                      <span style={{ color: "var(--text-primary)" }}>{phone}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm mt-0.5">location_on</span>
                      <div className="flex-1">
                        {addr ? (() => {
                          const line1 = toProperCase(addr.address_line_1 || addr.addressLine1 || "");
                          const line2 = toProperCase(addr.address_line_2 || addr.addressLine2 || "");
                          const city = toProperCase(addr.city || "");
                          const state = toProperCase(addr.state || "");
                          const pin = addr.postal_code || addr.postalCode || addr.pincode || "";
                          const country = toProperCase(addr.country || "India");

                          return (
                            <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {line1}
                              {line2 && <><br />{line2}</>}
                              <br />
                              {city}, {state} - {pin}
                            </p>
                          );
                        })() : (
                          <p className="text-gray-500 italic">No delivery address snapshotted on order.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Call and Email Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {displayEmail && displayEmail !== "Email not provided" ? (
                      <a
                        href={`mailto:${displayEmail}`}
                        className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all rounded-[6px] border border-gray-800 bg-[#16161a] hover:bg-[#222228] text-white"
                      >
                        ✉ Email
                      </a>
                    ) : (
                      <span className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center opacity-40 select-none rounded-[6px] border border-gray-800 bg-[#16161a] text-gray-500">✉ Email</span>
                    )}

                    {phone && phone !== "Not provided" ? (
                      <a
                        href={`tel:${phone}`}
                        className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all rounded-[6px] border border-gray-800 bg-[#16161a] hover:bg-[#222228] text-white"
                      >
                        📞 Call
                      </a>
                    ) : (
                      <span className="py-2.5 text-[10px] font-bold uppercase tracking-wider text-center opacity-40 select-none rounded-[6px] border border-gray-800 bg-[#16161a] text-gray-500">📞 Call</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 2. Payment Status Card (Refund Banner nested inside) */}
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6" style={{ color: "var(--text-secondary)" }}>PAYMENT</h3>
            {(() => {
              const isPending = order.status.toLowerCase() === "payment pending";
              const totalAmount = order.total || 0;
              const wPaid = order.walletPaid || 0;
              const gPaid = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, totalAmount - wPaid);

              return (
                <div className="space-y-4">
                  {isPending ? (
                    <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[4px] inline-block" style={{ backgroundColor: "var(--bg-warning)", color: "var(--text-warning)" }}>
                      ⏳ Awaiting Payment
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[4px] inline-block" style={{ backgroundColor: "var(--bg-success)", color: "var(--text-success)" }}>
                      ✓ Payment confirmed
                    </span>
                  )}

                  <div className="space-y-2 pt-2 border-t border-dashed border-gray-200/10 text-xs">
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Amount received</span>
                      <span className="font-bold text-white">₹{gPaid.toLocaleString("en-IN")}.00</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Store receipt</span>
                      <span className="font-bold text-white">₹{wPaid.toLocaleString("en-IN")}.00</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100/10 font-bold text-white">
                      <span>Total paid</span>
                      <span>₹{totalAmount.toLocaleString("en-IN")}.00</span>
                    </div>
                  </div>

                  {order.razorpay_payment_id && (
                    <div className="pt-2 text-[9px] text-gray-500 font-mono">
                      Pay ID: {order.razorpay_payment_id}
                    </div>
                  )}

                  {/* NESTED REFUND ALERT: styled block matching mockup */}
                  {order.refund_status && (
                    <div
                      className="mt-4 border text-[11px] leading-relaxed"
                      style={{
                        backgroundColor: "var(--bg-warning)",
                        borderColor: "var(--border-warning)",
                        borderRadius: "var(--radius)",
                        padding: "12px 14px",
                      }}
                    >
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider" style={{ color: "var(--text-warning)" }}>
                        <span>🗂️ Wallet refund issued</span>
                      </div>
                      <p className="mt-1" style={{ color: "var(--text-warning)" }}>
                        ₹{order.refund_amount || 0} - Reason: {order.refund_reason || "None"}
                      </p>
                      {order.refunded_at && (
                        <p className="text-[10px] mt-0.5 opacity-80" style={{ color: "var(--text-warning)" }}>
                          Processed: {new Date(order.refunded_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  )}

                  {order.refund_id && (
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200/10 flex items-center justify-between gap-3">
                      <button
                        onClick={handleVerifyRefund}
                        disabled={verifyingRefund}
                        className="px-4 py-2 bg-[#16161a] border border-gray-800 hover:bg-[#222228] text-white text-[10px] font-bold uppercase tracking-wider rounded-[4px] cursor-pointer disabled:opacity-40"
                      >
                        {verifyingRefund ? "Verifying..." : "Verify refund"}
                      </button>
                      {(() => {
                        const status = order.refund_status?.toLowerCase();
                        let badgeBg = "var(--bg-warning)";
                        let badgeColor = "var(--text-warning)";
                        if (status === "credited" || status === "processed") {
                          badgeBg = "var(--bg-success)";
                          badgeColor = "var(--text-success)";
                        } else if (status === "failed") {
                          badgeBg = "var(--bg-danger)";
                          badgeColor = "var(--text-danger)";
                        }
                        return (
                          <span
                            className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[4px]"
                            style={{ backgroundColor: badgeBg, color: badgeColor }}
                          >
                            {order.refund_status || "Pending"}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 3. Administrative Actions Card (Grid layout matching mockup exactly) */}
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "0.5px solid var(--border)",
              borderRadius: "12px"
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-6" style={{ color: "var(--text-secondary)" }}>ACTIONS</h3>

            {/* Actions Grid container */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* 1. Mark shipped (or Ship via Shiprocket) */}
              <button
                onClick={handleShiprocketShip}
                disabled={s !== "processing"}
                className={`flex flex-col items-center justify-center p-4 border border-gray-800 bg-[#16161a] rounded-[8px] hover:bg-white/5 transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  s !== "processing" ? "opacity-30 cursor-not-allowed" : ""
                }`}
                style={{ color: "var(--text-primary)" }}
              >
                <span className="material-symbols-outlined text-lg mb-1">local_shipping</span>
                <span>Mark shipped</span>
              </button>

              {/* 2. Mark delivered */}
              <button
                onClick={() => handleUpdateStatus("Delivered")}
                disabled={s !== "shipped"}
                className={`flex flex-col items-center justify-center p-4 border border-gray-800 bg-[#16161a] rounded-[8px] hover:bg-white/5 transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  s !== "shipped" ? "opacity-30 cursor-not-allowed" : ""
                }`}
                style={{ color: "var(--text-primary)" }}
              >
                <span className="material-symbols-outlined text-lg mb-1">check_circle</span>
                <span>Mark delivered</span>
              </button>

              {/* 3. Process refund (calls issueRefund or processReturnRefund based on return context) */}
              <button
                onClick={() => {
                  if (s.includes("return")) {
                    openRefundModal("return");
                  } else {
                    openRefundModal("issue");
                  }
                }}
                disabled={s !== "delivered" && s !== "return in transit" && s !== "return requested"}
                className={`flex flex-col items-center justify-center p-4 border border-gray-800 bg-[#16161a] rounded-[8px] hover:bg-white/5 transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  (s !== "delivered" && s !== "return in transit" && s !== "return requested") ? "opacity-30 cursor-not-allowed" : ""
                }`}
                style={{ color: "var(--text-primary)" }}
              >
                <span className="material-symbols-outlined text-lg mb-1">sync</span>
                <span>Process refund</span>
              </button>

              {/* 4. Print invoice */}
              <Link
                href={`/invoice?orderId=${order.id}`}
                className="flex flex-col items-center justify-center p-4 border border-gray-800 bg-[#16161a] rounded-[8px] hover:bg-white/5 transition-all text-[11px] font-bold uppercase tracking-wider text-center"
                style={{ color: "var(--text-primary)" }}
              >
                <span className="material-symbols-outlined text-lg mb-1">print</span>
                <span>Print invoice</span>
              </Link>

              {/* 5. Cancel order (full width at the bottom) */}
              <button
                onClick={() => openRefundModal("cancel")}
                disabled={s === "cancelled" || s === "returned" || s === "return rejected"}
                className={`col-span-2 flex items-center justify-center gap-2 p-4 border rounded-[8px] transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  (s === "cancelled" || s === "returned" || s === "return rejected") ? "opacity-30 cursor-not-allowed" : ""
                }`}
                style={{
                  border: "0.5px solid var(--border-danger)",
                  color: "var(--text-danger)",
                  backgroundColor: "var(--bg-danger)"
                }}
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Cancel order</span>
              </button>

              {/* 6. Print shipping label (full width, below cancel button) */}
              {(s === "processing" || s === "shipped" || s === "delivered") && (
                <button
                  onClick={handlePrintShippingLabel}
                  disabled={printingLabel}
                  className="col-span-2 flex items-center justify-center gap-2 p-4 border rounded-[8px] transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                  style={{
                    backgroundColor: "var(--surface-1)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)"
                  }}
                >
                  {printingLabel ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">print</span>
                      <span>Print shipping label</span>
                    </>
                  )}
                </button>
              )}

            </div>

            {manifestDownloadUrl && (
              <div className="mt-4 pt-3 border-t border-gray-800 text-center">
                <a
                  href={manifestDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-white transition-colors"
                >
                  Download manifest →
                </a>
              </div>
            )}

            {/* Extra context actions (e.g. Reverse Return options and Quality Audit check) */}
            {s === "return requested" && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleApprovePickup}
                  className="flex-1 py-2 text-[9px] font-bold uppercase bg-blue-600 text-white rounded-[4px] hover:bg-blue-700 cursor-pointer border-none"
                >
                  Approve Pickup
                </button>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="flex-1 py-2 text-[9px] font-bold uppercase bg-red-600 text-white rounded-[4px] hover:bg-red-700 cursor-pointer border-none"
                >
                  Reject Return
                </button>
              </div>
            )}

            {s === "return in transit" && (
              <div className="mt-4 space-y-2 border-t border-gray-850 pt-3">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Quality Audit Status
                </label>
                <select
                  value={qualityCheck}
                  onChange={(e) => setQualityCheck(e.target.value as any)}
                  className="w-full bg-[#222228] border border-gray-800 px-2 py-2 text-[10px] font-bold uppercase tracking-widest focus:border-secondary focus:ring-0 rounded-[4px] text-white cursor-pointer"
                >
                  <option value="passed">QC: Passed (Restock)</option>
                  <option value="failed">QC: Failed (Do Not Restock)</option>
                </select>
              </div>
            )}

            {s === "payment pending" && (
              <div className="mt-4">
                <button
                  onClick={handleVerifyPayment}
                  disabled={verifyingPayment}
                  className="w-full py-2.5 text-[10px] font-bold uppercase tracking-wider text-white bg-green-700 hover:bg-green-600 rounded-[6px] transition-all cursor-pointer border-none disabled:opacity-40"
                >
                  {verifyingPayment ? "Verifying..." : "Verify payment"}
                </button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200/10">
              <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider leading-relaxed">
                ⚠️ Shipping sync updates inventory. Cancellation voids payment and releases stock.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-md w-full border border-gray-200/50 shadow-2xl relative rounded-none text-left">
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
          <div className="bg-white p-8 max-w-md w-full border border-gray-200/50 shadow-2xl relative rounded-none text-left">
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
