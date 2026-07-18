"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, Product } from "@/lib/types";
import { getOrdersAction } from "@/app/actions/admin-reads";
import {
  acceptOrderAction,
  markOrderPackedAction,
  bulkAcceptOrdersAction,
  bulkMarkPackedAction,
  generateBulkLabelsAction,
  printManifestAction,
  generateBulkInvoicePdfAction,
  manualDeliveryOverrideAction,
  manualReturnArrivedOverrideAction,
  bulkUpdateOrderStatusAction
} from "@/app/actions/admin-orders";
import { buildInvoiceHtml, orderToInvoiceData } from "@/lib/invoice-template";

const tabs = [
  { 
    id: 'live', 
    label: 'Live Orders',
    description: 'Paid, awaiting acceptance',
    color: 'green'
  },
  { 
    id: 'processing', 
    label: 'Processing',
    description: 'Accepted, invoice pending',
    color: 'blue'
  },
  { 
    id: 'packed', 
    label: 'Packed',
    description: 'Invoice printed, label pending',
    color: 'amber'
  },
  { 
    id: 'shipped', 
    label: 'Shipped',
    description: 'Label generated, in transit',
    color: 'purple'
  },
  { 
    id: 'delivered', 
    label: 'Delivered',
    description: 'Delivered to customer',
    color: 'green'
  },
  { 
    id: 'pending', 
    label: 'Pending',
    description: 'Overdue — not processed in 24h',
    color: 'red'
  },
  { 
    id: 'payment_pending', 
    label: 'Payment Pending',
    description: 'Awaiting payment confirmation',
    color: 'gray'
  }
];

const parseOrderDate = (o: any): Date => {
  const orderDateStr = o.created_at || o.createdAt || o.date;
  if (!orderDateStr) return new Date();
  let orderTime = Date.parse(orderDateStr);
  if (isNaN(orderTime)) {
    const parts = orderDateStr.split("/");
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      return new Date();
    }
  }
  return new Date(orderTime);
};

const filterByTab = (orders: Order[], tab: string) => {
  const now = new Date();
  const deadline = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  switch(tab) {
    case 'live':
      return orders.filter(o => 
        ['paid', 'paid via wallet']
          .includes((o.status || '').toLowerCase()) &&
        parseOrderDate(o) >= deadline
      );
    
    case 'processing':
      return orders.filter(o =>
        ['processing']
          .includes((o.status || '').toLowerCase())
      );
    
    case 'packed':
      return orders.filter(o =>
        ['packed']
          .includes((o.status || '').toLowerCase())
      );
    
    case 'shipped':
      return orders.filter(o =>
        ['shipped', 'out for delivery']
          .includes((o.status || '').toLowerCase())
      );
    
    case 'delivered':
      return orders.filter(o =>
        ['delivered']
          .includes((o.status || '').toLowerCase())
      );
    
    case 'pending':
      return orders.filter(o => {
        const status = (o.status || '').toLowerCase();
        const createdAt = parseOrderDate(o);

        const isPaidStatus = ['paid', 'paid via wallet'].includes(status);
        const isProcessingStatus = ['processing', 'packed'].includes(status);

        if (isPaidStatus) {
          // Paid orders < 24hrs → Live Orders tab
          // Paid orders > 24hrs → Pending tab (overdue, admin hasn't accepted)
          return createdAt < deadline;
        }

        if (isProcessingStatus) {
          // Processing/Packed orders > 24hrs → Pending tab (stuck, admin hasn't progressed)
          return createdAt < deadline;
        }

        return false;
      });
    
    case 'payment_pending':
      return orders.filter(o =>
        ['payment pending', 'failed', 'pending']
          .includes((o.status || '').toLowerCase())
      );
    
    default:
      return orders;
  }
};

function buildBulkInvoiceHtml(
  orders: any[],
  _products?: any[],
  _gstin?: string,
  origin?: string
): string {
  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <title>Concatenated Tax Invoices</title>
  <style>
    @media print {
      @page { size: A4; margin: 6mm; }
      .page-break { page-break-after: always; }
      .no-print { display: none !important; }
    }
    body { margin: 0; padding: 0; background: #f9f9f9; padding-top: 80px; }
    @media print {
      body { background: white; padding-top: 0; }
    }
  </style>
  </head><body>
  <div class="no-print" style="position: fixed; top: 20px; right: 20px; display: flex; gap: 15px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <button onclick="window.print()" style="background: black; color: white; border: none; padding: 12px 24px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
      Print / Download PDF
    </button>
    <button onclick="window.close()" style="background: white; color: #666; border: 1px solid #ddd; padding: 12px 20px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; cursor: pointer;">
      Go Back
    </button>
  </div>` +
  orders.map((order, i) => {
    const data = orderToInvoiceData(
      order,
      order.id.replace('6K-RPO-','')
        .replace('6K-WPO-','')
    )
    const fullHtml = buildInvoiceHtml(data, true, origin || "")
    return fullHtml + (i < orders.length - 1 
      ? '<div class="page-break"></div>' 
      : '')
  }).join('') + '</body></html>'
}

export default function OrdersKanbanPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "xlsx" | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>("live");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Label Progress Modal states
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelsGenerating, setLabelsGenerating] = useState(false);
  const [labelResults, setLabelResults] = useState<Array<{
    orderId: string;
    success: boolean;
    pending: boolean;
    awb?: string;
    error?: string;
  }>>([]);

  // Toast notifications
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Manual Delivery Override Modal States
  const [deliveryOverrideModalOpen, setDeliveryOverrideModalOpen] = useState(false);
  const [targetOrderIdForOverride, setTargetOrderIdForOverride] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("Webhook Failure");
  const [customOverrideDetails, setCustomOverrideDetails] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, searchQuery]);

  const loadOrders = async () => {
    setLoading(true);
    const res = await getOrdersAction();
    if (!res.success) {
      triggerToast(res.error || "Failed to load orders");
      setLoading(false);
      return;
    }
    setOrders(res.orders || []);
    setLoading(false);
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>, filteredTabOrders: Order[]) => {
    if (e.target.checked) {
      setSelectedIds(filteredTabOrders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk Operations
  const handleBulkAccept = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await bulkAcceptOrdersAction(selectedIds);
      if (res.success) {
        triggerToast(`Successfully accepted ${res.accepted} order(s), ${res.failed} failed.`);
        await loadOrders();
        setSelectedIds([]);
      } else {
        triggerToast(res.error || "Failed to bulk accept orders");
      }
    } catch (err: any) {
      triggerToast(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkMarkPacked = async (ids: string[]) => {
    try {
      const res = await bulkMarkPackedAction(ids);
      if (res.success) {
        triggerToast(`Invoice generated. Marked ${res.packed} orders as Packed.`);
        await loadOrders();
        setSelectedIds([]);
      } else {
        triggerToast(res.error || "Failed to update order status to Packed");
      }
    } catch (err: any) {
      triggerToast(err.message || "An error occurred updating status");
    }
  };

  const handleBulkPrintInvoices = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await generateBulkInvoicePdfAction(selectedIds);
      if (!res.success || !res.orders || !res.products) {
        triggerToast(res.error || "Failed to load invoice data");
        setSubmitting(false);
        return;
      }

      // Generate HTML
      const html = buildBulkInvoiceHtml(res.orders, res.products, res.gstin || "33BFOPT4938Q1ZE", window.location.origin);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);

      const printWindow = window.open(blobUrl, "_blank");
      if (!printWindow) {
        triggerToast("Pop-up blocked! Please allow popups for this dashboard.");
        setSubmitting(false);
        return;
      }

      printWindow.focus();
      
      const idsToMarkPacked = [...selectedIds];
      await handleBulkMarkPacked(idsToMarkPacked);
      URL.revokeObjectURL(blobUrl);

    } catch (err: any) {
      triggerToast(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkGenerateLabels = async () => {
    if (selectedIds.length === 0 || submitting) return;
    
    // Open modal and set initial pending states
    setLabelResults(selectedIds.map(id => ({ orderId: id, success: false, pending: true })));
    setLabelModalOpen(true);
    setLabelsGenerating(true);
    setSubmitting(true);

    try {
      const res = await generateBulkLabelsAction(selectedIds);
      if (res.success && res.results) {
        setLabelResults(res.results.map(r => ({
          orderId: r.orderId,
          success: r.success,
          pending: false,
          awb: r.awb,
          error: r.error
        })));
        await loadOrders();
        setSelectedIds([]);
      } else {
        triggerToast("Label generation failed");
        setLabelModalOpen(false);
      }
    } catch (err: any) {
      triggerToast(err.message || "Label generation encountered an error");
      setLabelModalOpen(false);
    } finally {
      setLabelsGenerating(false);
      setSubmitting(false);
    }
  };

  const handlePrintManifest = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await printManifestAction();
      if (res.success) {
        if (res.orderCount === 0 || res.manifestUrls.length === 0) {
          triggerToast("No new manifests to print.");
        } else {
          res.manifestUrls.forEach(url => {
            window.open(url, "_blank");
          });
          triggerToast(`Manifests generated for ${res.orderCount} order(s). Opened in new tabs.`);
          await loadOrders();
        }
      } else {
        triggerToast(res.error || "Failed to print manifests");
      }
    } catch (err: any) {
      triggerToast(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Row Quick Actions
  const handleSingleAccept = async (orderId: string) => {
    if (submitting) return;
    setSubmitting(true);
    const res = await acceptOrderAction(orderId);
    setSubmitting(false);
    if (res.success) {
      triggerToast("Order accepted successfully.");
      await loadOrders();
    } else {
      triggerToast(res.error || "Failed to accept order");
    }
  };

  const handleSinglePrintInvoice = async (orderId: string) => {
    if (submitting) return;
    setSubmitting(true);
    const invoiceUrl = `/invoice?orderId=${orderId}`;
    const printWindow = window.open(invoiceUrl, "_blank");
    setSubmitting(false);
    if (printWindow) {
      printWindow.focus();
      let hasRun = false;
      const runUpdate = async () => {
        if (hasRun) return;
        hasRun = true;
        await markOrderPackedAction(orderId);
        await loadOrders();
      };
      const checkWindow = setInterval(() => {
        if (printWindow.closed) {
          clearInterval(checkWindow);
          runUpdate();
        }
      }, 1000);
    } else {
      triggerToast("Pop-up blocked! Please allow popups for this dashboard.");
    }
  };

  const handleSingleShipOverride = async (orderId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await bulkUpdateOrderStatusAction([orderId], "Shipped");
      if (res.success) {
        triggerToast("Order marked as Shipped manually.");
        await loadOrders();
      } else {
        triggerToast(res.error || "Failed to update status");
      }
    } catch (err: any) {
      triggerToast(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleDeliverOverride = (orderId: string) => {
    setTargetOrderIdForOverride(orderId);
    setDeliveryOverrideModalOpen(true);
  };

  const handleManualDeliveryOverrideSubmit = async () => {
    if (!targetOrderIdForOverride || overrideSubmitting) return;
    setOverrideSubmitting(true);
    try {
      const finalReason = overrideReason === "Other" ? (customOverrideDetails || "Manual Override") : overrideReason;
      const res = await manualDeliveryOverrideAction(targetOrderIdForOverride, finalReason);
      if (res.success) {
        triggerToast("Order marked as Delivered manually.");
        setDeliveryOverrideModalOpen(false);
        setTargetOrderIdForOverride(null);
        setCustomOverrideDetails("");
        await loadOrders();
      } else {
        triggerToast(res.error || "Failed to confirm manual delivery");
      }
    } catch (err: any) {
      triggerToast(err.message || "An error occurred");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === "shipped") return "bg-purple-100 text-purple-700 border border-purple-200";
    if (s === "packed") return "bg-amber-100 text-amber-700 border border-amber-200";
    if (s === "processing") return "bg-blue-100 text-blue-700 border border-blue-200";
    if (s === "paid" || s === "paid via wallet") return "bg-green-100 text-green-700 border border-green-200";
    if (s === "delivered") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (s === "cancelled" || s.includes("return") || s === "failed") return "bg-red-100 text-red-700 border border-red-200";
    return "bg-gray-100 text-gray-700 border border-gray-200";
  };

  // Search and Filter Application
  const searchFilter = (o: Order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (o.id || "").toLowerCase().includes(q) ||
      (o.customer || "").toLowerCase().includes(q) ||
      (o.shiprocketId || "").toLowerCase().includes(q)
    );
  };

  const tabFiltered = filterByTab(orders, activeTab);
  const finalFilteredOrders = tabFiltered.filter(searchFilter);

  return (
    <div className="p-8 lg:p-16 min-h-screen bg-[#fafafa]">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Kanban Workflow</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Orders</h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            Manage customer orders using the 7-tab Kanban fulfillment board.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-secondary transition-colors">
              search
            </span>
            <input
              type="text"
              placeholder="Search ID, customer, AWB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3.5 bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-widest focus:border-[#0a0a0a] focus:ring-0 outline-none w-full sm:w-72 shadow-sm rounded-none"
            />
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport("csv")}
            className="px-6 py-3 bg-[#0a0a0a] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors border-none cursor-pointer disabled:opacity-50"
          >
            {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport("xlsx")}
            className="px-6 py-3 bg-[#775a19] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#634812] transition-colors border-none cursor-pointer disabled:opacity-50"
          >
            {exportingFormat === "xlsx" ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </header>

      {/* Tab Header with Badges */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 mb-8 scrollbar-hide">
        {tabs.map(tab => {
          const count = filterByTab(orders, tab.id).length;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all bg-transparent border-t-0 border-x-0 cursor-pointer
                ${isActive 
                  ? 'border-black text-black' 
                  : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              title={tab.description}
            >
              {tab.label}
              {count > 0 && (
                <span className={`px-2 py-0.5 rounded-none text-[10px] font-black transition-all border
                  ${tab.id === 'pending' 
                    ? 'bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20'
                    : tab.id === 'live'
                      ? 'bg-[#775a19]/10 text-[#775a19] border-[#775a19]/20'
                      : isActive 
                        ? 'bg-[#1a1c1c] text-[#faf9f8] border-[#1a1c1c]'
                        : 'bg-[#faf9f8] text-[#7f7667] border-[#7f7667]/20'
                  }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bulk Action Panels */}
      {activeTab === 'live' && selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-[#7f7667]/20 rounded-none p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#775a19]">
              SELECT: {selectedIds.length} order(s) selected
            </span>
            <button
              onClick={handleBulkAccept}
              disabled={submitting}
              className="bg-[#1a1c1c] text-[#faf9f8] hover:bg-[#775a19] px-6 py-2.5 rounded-none text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors border-none"
            >
              Accept Selected Orders
            </button>
          </div>
          <button onClick={clearSelection} className="text-gray-500 text-xs font-bold uppercase hover:text-black cursor-pointer bg-transparent border-none">
            Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'processing' && selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-[#7f7667]/20 rounded-none p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#775a19]">
              INVOICE: {selectedIds.length} order(s) selected
            </span>
            <button
              onClick={handleBulkPrintInvoices}
              disabled={submitting}
              className="bg-[#1a1c1c] text-[#faf9f8] hover:bg-[#775a19] px-6 py-2.5 rounded-none text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors border-none"
            >
              Print Concatenated Invoices ({selectedIds.length})
            </button>
          </div>
          <button onClick={clearSelection} className="text-gray-500 text-xs font-bold uppercase hover:text-black cursor-pointer bg-transparent border-none">
            Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'packed' && selectedIds.length > 0 && (
        <div className="flex items-center gap-4 bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <span className="text-sm font-medium">
            {selectedIds.length} orders selected
          </span>
          
          <a
            href="https://app.shiprocket.in/new-orders"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium no-underline"
          >
            Open Shiprocket to Generate Labels →
          </a>
        </div>
      )}

      {activeTab === 'shipped' && (
        <div className="flex justify-end mb-6">
          <a
            href="https://app.shiprocket.in/manifests"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-500 underline"
          >
            Print Manifest in Shiprocket →
          </a>
        </div>
      )}

      {/* Main Ledger Table */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-none"/>
          <div className="h-32 bg-gray-200 rounded-none"/>
          <div className="h-64 bg-gray-200 rounded-none"/>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 border-b border-gray-200 bg-gray-50/50">
                  <th className="px-8 py-5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={finalFilteredOrders.length > 0 && finalFilteredOrders.every(o => selectedIds.includes(o.id))}
                      onChange={(e) => handleSelectAll(e, finalFilteredOrders)}
                      className="accent-black cursor-pointer size-4 align-middle"
                    />
                  </th>
                  <th className="px-8 py-5">Order ID</th>
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Customer</th>
                  <th className="px-8 py-5">Details</th>
                  <th className="px-8 py-5 text-right">Amount</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {finalFilteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-8 py-24 text-center text-xs font-bold uppercase tracking-widest text-gray-400 opacity-60">
                      No orders found in this queue.
                    </td>
                  </tr>
                ) : (
                  finalFilteredOrders.map(order => {
                    const isPendingTab = activeTab === 'pending';
                    const detailLink = `/admindashboard/order-details?orderId=${order.id}&from=${activeTab}`;
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                        onClick={() => router.push(detailLink)}
                      >
                        <td className="px-8 py-6 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(order.id)}
                            onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                            className="accent-black cursor-pointer size-4 align-middle"
                          />
                        </td>
                        <td className="px-8 py-6 text-sm font-black font-headline text-black">
                          #{order.id}
                        </td>
                        <td className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {order.date}
                        </td>
                        <td className="px-8 py-6 font-bold text-gray-800">
                          {order.customer}
                        </td>
                        <td className="px-8 py-6 text-gray-500 font-medium">
                          <div className="flex flex-col">
                            <span>{(order.items || []).join(", ")}</span>
                            {order.courierName && <span className="text-[9px] text-[#775a19] font-mono mt-1">Courier: {order.courierName}</span>}
                            {(order.awbCode || order.shiprocketId) && (
                              <span className="text-[9px] text-[#775a19] font-mono mt-1">
                                AWB: {(order.awbCode || order.shiprocketId)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black font-headline text-black text-sm">
                          ₹{order.total.toLocaleString("en-IN")}.00
                        </td>
                        <td className="px-8 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <span className={`inline-block px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-none ${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-3 font-bold text-[10px] uppercase tracking-wider">
                            {activeTab === 'live' && (
                              <button
                                onClick={() => handleSingleAccept(order.id)}
                                className="bg-[#1a1c1c] text-[#faf9f8] hover:bg-[#775a19] px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors border-none"
                              >
                                Accept
                              </button>
                            )}
                            {activeTab === 'processing' && (
                              <button
                                onClick={() => handleSinglePrintInvoice(order.id)}
                                className="bg-[#1a1c1c] text-[#faf9f8] hover:bg-[#775a19] px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors border-none"
                              >
                                Print Invoice
                              </button>
                            )}
                            {activeTab === 'packed' && (
                              <>
                                <a
                                  href="https://app.shiprocket.in/new-orders"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest text-white transition-colors no-underline"
                                  style={{background:'#f97316'}}
                                >
                                  Open Shiprocket
                                </a>
                                <button
                                  onClick={() => handleSingleShipOverride(order.id)}
                                  className="bg-zinc-800 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors border-none"
                                >
                                  Mark Shipped
                                </button>
                              </>
                            )}
                            {activeTab === 'shipped' && (
                              <button
                                onClick={() => handleSingleDeliverOverride(order.id)}
                                className="bg-secondary text-white hover:bg-primary px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors border-none"
                              >
                                Mark Delivered
                              </button>
                            )}
                            {isPendingTab && (
                              <Link
                                href={detailLink}
                                className="bg-[#775a19] text-[#faf9f8] hover:bg-[#634812] px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest transition-colors text-center no-underline"
                              >
                                Process Now
                              </Link>
                            )}
                            {activeTab === 'payment_pending' && (
                              <Link
                                href={detailLink}
                                className="bg-[#1a1c1c] text-[#faf9f8] hover:bg-[#775a19] px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest transition-colors text-center no-underline"
                              >
                                Verify Payment
                              </Link>
                            )}
                            <Link href={detailLink} className="text-gray-400 hover:text-black font-extrabold uppercase ml-2 tracking-widest no-underline">
                              View →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Label Generation Progress Modal */}
      {labelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white border border-[#7f7667]/20 shadow-2xl rounded-none p-8 max-w-md w-full animate-zoom-in">
            <h3 className="text-lg font-headline font-black uppercase tracking-tighter text-black mb-4">
              Generating Shipping Labels...
            </h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4 leading-relaxed">
              Dispatching shipments and requesting label generation from Shiprocket sequentially to respect rate limits.
            </p>
            <div className="space-y-2.5 max-h-64 overflow-y-auto mb-6 border border-gray-100 p-4 rounded-none bg-gray-50/50">
              {labelResults.map(result => (
                <div key={result.orderId} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0 text-xs">
                  {result.pending ? (
                    <span className="text-amber-500 animate-pulse text-xs font-bold uppercase">Pending</span>
                  ) : result.success ? (
                    <span className="text-green-600 text-xs font-bold uppercase">Success</span>
                  ) : (
                    <span className="text-red-600 text-xs font-bold uppercase">Failed</span>
                  )}
                  <span className="font-bold font-mono flex-1 text-gray-700">
                    #{result.orderId}
                  </span>
                  {result.success && result.awb && (
                    <span className="text-[10px] bg-green-50 text-green-700 font-mono px-2 py-0.5 rounded-none border border-green-200/50">
                      AWB: {result.awb}
                    </span>
                  )}
                  {!result.success && result.error && (
                    <span className="text-red-500 text-[10px] font-bold max-w-[150px] truncate" title={result.error}>
                      {result.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!labelsGenerating && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {labelResults.filter(r => r.success).length} success / {labelResults.filter(r => !r.success).length} failed
                </span>
                <button
                  onClick={() => {
                    setLabelModalOpen(false);
                    loadOrders();
                  }}
                  className="bg-black text-white hover:bg-gray-800 px-6 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer border-none"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Manual Delivery Modal */}
      {deliveryOverrideModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-4 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto border border-[#775a19]/25 shadow-2xl relative rounded-none text-left space-y-6">
            <h3 className="font-headline font-black text-sm uppercase tracking-wider text-[#1a1c1c]">
              Confirm Manual Delivery
            </h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
              Use this option only when automatic Shiprocket tracking updates did not reach the platform for Order #{targetOrderIdForOverride}.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  Reason for Override
                </label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 text-[10px] font-bold uppercase tracking-wider rounded-none focus:outline-none focus:border-secondary"
                >
                  <option value="Webhook Failure">Webhook Failure</option>
                  <option value="Courier Confirmation">Courier Confirmation</option>
                  <option value="Customer Confirmation">Customer Confirmation</option>
                  <option value="Operational Correction">Operational Correction</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {overrideReason === "Other" && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                    Specify Custom Reason
                  </label>
                  <textarea
                    rows={3}
                    value={customOverrideDetails}
                    onChange={(e) => setCustomOverrideDetails(e.target.value)}
                    placeholder="Enter details..."
                    className="w-full bg-zinc-50 border border-zinc-200 p-3 text-[10px] font-bold rounded-none focus:outline-none focus:border-secondary"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeliveryOverrideModalOpen(false);
                  setTargetOrderIdForOverride(null);
                  setCustomOverrideDetails("");
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideSubmitting}
                onClick={handleManualDeliveryOverrideSubmit}
                className="flex-1 bg-secondary text-white hover:bg-primary text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer rounded-none border-none font-bold disabled:opacity-40"
              >
                {overrideSubmitting ? "Processing..." : "Confirm Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert popup */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}
    </div>
  );
}

