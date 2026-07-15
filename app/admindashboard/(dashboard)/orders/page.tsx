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
  generateBulkInvoicePdfAction
} from "@/app/actions/admin-orders";

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
        ['shipped']
          .includes((o.status || '').toLowerCase())
      );
    
    case 'delivered':
      return orders.filter(o =>
        ['delivered']
          .includes((o.status || '').toLowerCase())
      );
    
    case 'pending':
      return orders.filter(o => {
        const isPending = [
          'paid', 'paid via wallet',
          'processing', 'packed'
        ].includes((o.status || '').toLowerCase());
        const isOverdue = parseOrderDate(o) < deadline;
        return isPending && isOverdue;
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

const getStateInfo = (address: any) => {
  if (!address) {
    return { state: "Tamil Nadu", code: "33", isLocal: true };
  }
  const addr = typeof address === "string" ? JSON.parse(address) : address;
  const stateName = (addr.state || "Tamil Nadu").toUpperCase().trim();
  const stateCodes: Record<string, string> = {
    "TAMIL NADU": "33", "TAMILNADU": "33", "TN": "33",
    "MAHARASHTRA": "27", "MH": "27",
    "KARNATAKA": "29", "KA": "29",
    "DELHI": "07", "DL": "07",
    "GUJARAT": "24", "GJ": "24",
    "UTTAR PRADESH": "09", "UP": "09",
    "WEST BENGAL": "19", "WB": "19",
    "TELANGANA": "36", "TS": "36",
    "KERALA": "32", "KL": "32",
    "RAJASTHAN": "08", "RJ": "08",
    "ANDHRA PRADESH": "37", "AP": "37",
    "MADHYA PRADESH": "23", "MP": "23",
    "BIHAR": "10", "BR": "10",
    "PUNJAB": "03", "PB": "03",
    "HARYANA": "06", "HR": "06",
    "GOA": "30", "GA": "30",
  };
  const code = stateCodes[stateName] || "33";
  const isLocal = code === "33";
  return { state: addr.state || "Tamil Nadu", code, isLocal };
};

const getHSN = (category: string) => {
  if (category?.toLowerCase().includes("t-shirt") || category?.toLowerCase().includes("tshirt")) {
    return "6109";
  }
  return "6205";
};

const buildBulkInvoiceHtml = (orders: any[], products: Product[], gstin: string) => {
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Concatenated Tax Invoices</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
      background: white;
    }
    .invoice {
      border: 1px solid #ddd;
      padding: 40px;
      margin: 0 auto 40px auto;
      max-width: 800px;
      position: relative;
    }
    .page-break {
      page-break-after: always;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
    }
    .company-title {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0;
    }
    .invoice-title {
      font-size: 26px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0;
      text-align: right;
    }
    .meta-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      font-size: 11px;
    }
    .bill-to {
      border-left: 4px solid #775a19;
      padding-left: 20px;
    }
    .bill-to h4, .invoice-details h4 {
      margin: 0 0 10px 0;
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .invoice-details {
      text-align: right;
    }
    .invoice-details p {
      margin: 5px 0;
      font-weight: bold;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    table.items-table th {
      border-bottom: 2px solid #000;
      padding: 10px 0;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      text-align: left;
    }
    table.items-table td {
      padding: 15px 0;
      border-bottom: 1px solid #eee;
      font-size: 12px;
    }
    .text-right {
      text-align: right !important;
    }
    .text-center {
      text-align: center !important;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-box {
      width: 320px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .grand-total {
      border-top: 1px solid #eee;
      padding-top: 10px;
      font-size: 13px;
      font-weight: 900;
    }
    .tax-breakdown {
      margin-bottom: 40px;
    }
    .tax-table {
      width: 100%;
      font-size: 9px;
      border: 1px solid #ddd;
      border-collapse: collapse;
    }
    .tax-table th, .tax-table td {
      border: 1px solid #ddd;
      padding: 8px;
      font-weight: bold;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 60px;
    }
    .declaration {
      font-size: 9px;
      color: #666;
      max-width: 400px;
      line-height: 1.5;
    }
    .signature {
      text-align: right;
    }
    .signature-title {
      font-style: italic;
      color: #888;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .signature-line {
      border-top: 1px solid #000;
      padding-top: 5px;
      font-weight: bold;
      font-size: 9px;
      text-transform: uppercase;
    }
    @media print {
      body {
        padding: 0;
      }
      .invoice {
        border: none;
        padding: 0;
        margin: 0;
        max-width: 100%;
      }
      .page-break {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>`;

  orders.forEach((order, orderIdx) => {
    const isLast = orderIdx === orders.length - 1;
    const pageBreakClass = isLast ? "" : "page-break";

    const stateInfo = getStateInfo(order.address_snapshot || (order as any).address);

    let sumItemPrices = 0;
    let sumItemTaxable = 0;

    const itemsWithTax = order.items.map((itemName: string) => {
      const matchedProd = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase());
      const price = matchedProd ? matchedProd.price : (itemName.includes("Classic") ? 1299 : 1450);
      const gstRate = matchedProd?.gstRate ?? (price <= 1000 ? 5 : 12);
      const hsn = getHSN(matchedProd?.category || "");
      const taxableValue = price / (1 + gstRate / 100);
      
      sumItemPrices += price;
      sumItemTaxable += taxableValue;

      return {
        itemName,
        price,
        gstRate,
        hsn,
        taxableValue,
        category: matchedProd ? matchedProd.category : "Premium Handcrafted Shirt"
      };
    });

    const blendedGstRate = sumItemPrices > 0 ? (sumItemPrices / sumItemTaxable) - 1 : 0.12;
    const taxableBase = order.total / (1 + blendedGstRate);
    const totalGst = order.total - taxableBase;
    const cgst = stateInfo.isLocal ? totalGst / 2 : 0;
    const sgst = stateInfo.isLocal ? totalGst / 2 : 0;
    const igst = !stateInfo.isLocal ? totalGst : 0;

    const gstGroups: Record<number, { taxableBase: number; cgst: number; sgst: number; igst: number; totalTax: number }> = {};
    itemsWithTax.forEach((item: any) => {
      const rate = item.gstRate;
      const proportion = sumItemPrices > 0 ? item.price / sumItemPrices : 0;
      const categoryTotal = order.total * proportion;
      const categoryTaxableBase = categoryTotal / (1 + rate / 100);
      const categoryGst = categoryTotal - categoryTaxableBase;

      if (!gstGroups[rate]) {
        gstGroups[rate] = { taxableBase: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      }
      gstGroups[rate].taxableBase += categoryTaxableBase;
      if (stateInfo.isLocal) {
        gstGroups[rate].cgst += categoryGst / 2;
        gstGroups[rate].sgst += categoryGst / 2;
      } else {
        gstGroups[rate].igst += categoryGst;
      }
      gstGroups[rate].totalTax += categoryGst;
    });

    const walletPaid = order.walletPaid || 0;
    const couponDiscount = order.couponDiscount || 0;
    const pointsDiscount = order.pointsDiscount || 0;
    const originalTotal = order.originalTotal !== undefined ? order.originalTotal : (order.total + pointsDiscount + couponDiscount);
    const finalGatewayAmount = order.gatewayPaid !== undefined ? order.gatewayPaid : Math.max(0, order.total - walletPaid);

    let addressHtml = "12/A Sky Gardens, Worli Sea Face<br />Mumbai, Maharashtra 400018";
    if (order.address_snapshot) {
      try {
        const addr = typeof order.address_snapshot === "string" ? JSON.parse(order.address_snapshot) : order.address_snapshot;
        const line1 = addr.address_line_1 || addr.address || "";
        const line2 = addr.address_line_2 || "";
        const city = addr.city || "";
        const state = addr.state || "";
        const zip = addr.postal_code || addr.pincode || "";
        addressHtml = `${line1}${line2 ? `<br />${line2}` : ""}<br />${city}, ${state} ${zip}${addr.phone ? `<br />T: ${addr.phone}` : ""}`;
      } catch (e) {}
    }

    html += `
    <div class="invoice ${pageBreakClass}">
      <div class="header">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="width: 24px; height: 24px; background: black; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px;">6K</div>
            <span class="company-title">JRT TEXTILES (6K Brand)</span>
          </div>
          <div style="font-size: 8px; color: #888; text-transform: uppercase; line-height: 1.5;">
            <p style="margin: 0;">1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar</p>
            <p style="margin: 0;">Tiruchirappalli – 620018, Tamil Nadu, India</p>
            <p style="margin: 5px 0 0 0; color: black; font-weight: bold;">GSTIN: ${gstin}</p>
          </div>
        </div>
        <div class="invoice-details">
          <h1 class="invoice-title">Tax Invoice</h1>
          <p style="margin: 0; font-size: 9px; color: #888; letter-spacing: 0.05em;">Rule 46 CGST Rules 2017</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="bill-to">
          <h4>Bill To / Ship To</h4>
          <p style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">${order.customer}</p>
          <p style="margin: 5px 0 0 0; font-size: 9px; color: #555; line-height: 1.4; text-transform: uppercase;">
            ${addressHtml}
          </p>
        </div>
        <div class="invoice-details" style="text-align: right;">
          <h4>Invoice Details</h4>
          <p><span style="color: #888; font-weight: normal;">Invoice No:</span> <span style="font-family: monospace;">#${order.id}</span></p>
          <p><span style="color: #888; font-weight: normal;">Date:</span> <span>${order.date}</span></p>
          <p><span style="color: #888; font-weight: normal;">Supply Place:</span> <span>${stateInfo.state} (${stateInfo.code})</span></p>
          <p><span style="color: #888; font-weight: normal;">Status:</span> <span>${order.status}</span></p>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th class="text-center" style="width: 80px;">HSN</th>
            <th class="text-center" style="width: 50px;">Qty</th>
            <th class="text-right" style="width: 100px;">Taxable Rate</th>
            <th class="text-right" style="width: 100px;">Taxable Value</th>
          </tr>
        </thead>
        <tbody>`;

    itemsWithTax.forEach((item: any) => {
      html += `
          <tr>
            <td>
              <p style="margin: 0; font-weight: bold; text-transform: uppercase;">${item.itemName}</p>
              <p style="margin: 3px 0 0 0; font-size: 8px; color: #888; text-transform: uppercase;">${item.category}</p>
            </td>
            <td class="text-center" style="font-family: monospace; font-weight: bold;">${item.hsn}</td>
            <td class="text-center">01</td>
            <td class="text-right" style="font-family: monospace;">₹${item.taxableValue.toFixed(2)}</td>
            <td class="text-right" style="font-family: monospace;">₹${item.taxableValue.toFixed(2)}</td>
          </tr>`;
    });

    html += `
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row">
            <span style="color: #888;">Subtotal (Original)</span>
            <span style="font-family: monospace;">₹${originalTotal.toFixed(2)}</span>
          </div>`;

    if (couponDiscount > 0) {
      html += `
          <div class="totals-row" style="color: red;">
            <span style="color: #888;">Coupon Discount (${order.couponCode || "N/A"})</span>
            <span style="font-family: monospace;">-₹${couponDiscount.toFixed(2)}</span>
          </div>`;
    }

    if (pointsDiscount > 0) {
      html += `
          <div class="totals-row" style="color: red;">
            <span style="color: #888;">Loyalty Discount (${order.pointsRedeemed} pts)</span>
            <span style="font-family: monospace;">-₹${pointsDiscount.toFixed(2)}</span>
          </div>`;
    }

    html += `
          <div class="totals-row">
            <span style="color: #888;">Shipping</span>
            <span style="font-family: monospace; color: #775a19;">FREE</span>
          </div>
          <div class="totals-row" style="border-top: 1px solid #eee; padding-top: 5px;">
            <span style="color: #888;">Taxable Value</span>
            <span style="font-family: monospace;">₹${taxableBase.toFixed(2)}</span>
          </div>`;

    if (stateInfo.isLocal) {
      html += `
          <div class="totals-row" style="color: #555;">
            <span style="color: #888;">CGST</span>
            <span style="font-family: monospace;">₹${cgst.toFixed(2)}</span>
          </div>
          <div class="totals-row" style="color: #555;">
            <span style="color: #888;">SGST</span>
            <span style="font-family: monospace;">₹${sgst.toFixed(2)}</span>
          </div>`;
    } else {
      html += `
          <div class="totals-row" style="color: #555;">
            <span style="color: #888;">IGST</span>
            <span style="font-family: monospace;">₹${igst.toFixed(2)}</span>
          </div>`;
    }

    html += `
          <div class="totals-row" style="border-top: 1px solid #eee; padding-top: 5px;">
            <span style="color: #888;">Total (incl. GST)</span>
            <span style="font-family: monospace;">₹${order.total.toFixed(2)}</span>
          </div>`;

    if (walletPaid > 0) {
      html += `
          <div class="totals-row" style="color: #775a19;">
            <span style="color: #888;">Paid via Wallet</span>
            <span style="font-family: monospace;">-₹${walletPaid.toFixed(2)}</span>
          </div>`;
    }

    html += `
          <div class="totals-row grand-total">
            <span>${finalGatewayAmount === 0 ? "Total Paid (Wallet)" : "Total Gateway Paid"}</span>
            <span style="font-family: monospace; font-size: 15px;">₹${(finalGatewayAmount === 0 ? walletPaid : finalGatewayAmount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="tax-breakdown">
        <h4 style="margin: 0 0 10px 0; font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.1em;">GST Tax Breakup</h4>
        <table class="tax-table">
          <thead>
            <tr style="background: #f5f5f5;">
              <th>HSN</th>
              <th class="text-right">Taxable Value</th>`;

    if (stateInfo.isLocal) {
      html += `
              <th class="text-center">CGST Rate</th>
              <th class="text-right">CGST Amt</th>
              <th class="text-center">SGST Rate</th>
              <th class="text-right">SGST Amt</th>`;
    } else {
      html += `
              <th class="text-center">IGST Rate</th>
              <th class="text-right">IGST Amt</th>`;
    }

    html += `
              <th class="text-right">Total Tax</th>
            </tr>
          </thead>
          <tbody>`;

    Object.entries(gstGroups).forEach(([rateStr, group]: any) => {
      const rate = Number(rateStr);
      html += `
            <tr style="font-family: monospace;">
              <td style="font-family: sans-serif;">6205</td>
              <td class="text-right">₹${group.taxableBase.toFixed(2)}</td>`;

      if (stateInfo.isLocal) {
        html += `
              <td class="text-center">${(rate / 2).toFixed(1)}%</td>
              <td class="text-right">₹${group.cgst.toFixed(2)}</td>
              <td class="text-center">${(rate / 2).toFixed(1)}%</td>
              <td class="text-right">₹${group.sgst.toFixed(2)}</td>`;
      } else {
        html += `
              <td class="text-center">${rate.toFixed(1)}%</td>
              <td class="text-right">₹${group.igst.toFixed(2)}</td>`;
      }

      html += `
              <td class="text-right">₹${group.totalTax.toFixed(2)}</td>
            </tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>

      <p class="declaration">
        <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
      </p>

      <div class="footer">
        <p style="font-size: 8px; color: #888; max-width: 250px; text-transform: uppercase; margin: 0; line-height: 1.4;">
          This document serves as a compliant GST Tax Invoice. Thank you for shopping with us.
        </p>
        <div class="signature">
          <div class="signature-title">Workshop Manager</div>
          <div class="signature-line">Authorized Signature</div>
        </div>
      </div>
    </div>`;
  });

  html += `
</body>
</html>`;
  return html;
};

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
      const html = buildBulkInvoiceHtml(res.orders, res.products, res.gstin || "33BFOPT4938Q1ZE");
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);

      const printWindow = window.open(blobUrl, "_blank");
      if (!printWindow) {
        triggerToast("Pop-up blocked! Please allow popups for this dashboard.");
        setSubmitting(false);
        return;
      }

      printWindow.focus();
      
      const idsToMarkPacked = [...selectedIds];
      let hasRun = false;

      const runStatusUpdate = async () => {
        if (hasRun) return;
        hasRun = true;
        await handleBulkMarkPacked(idsToMarkPacked);
        URL.revokeObjectURL(blobUrl);
      };

      printWindow.onafterprint = runStatusUpdate;

      const checkWindowClosed = setInterval(() => {
        if (printWindow.closed) {
          clearInterval(checkWindowClosed);
          runStatusUpdate();
        }
      }, 1000);

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
    const res = await generateBulkInvoicePdfAction([orderId]);
    setSubmitting(false);
    if (res.success && res.orders && res.products) {
      const html = buildBulkInvoiceHtml(res.orders, res.products, res.gstin || "33BFOPT4938Q1ZE");
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, "_blank");
      if (printWindow) {
        printWindow.focus();
        let hasRun = false;
        const runUpdate = async () => {
          if (hasRun) return;
          hasRun = true;
          await markOrderPackedAction(orderId);
          await loadOrders();
          URL.revokeObjectURL(blobUrl);
        };
        printWindow.onafterprint = runUpdate;
        const checkWindow = setInterval(() => {
          if (printWindow.closed) {
            clearInterval(checkWindow);
            runUpdate();
          }
        }, 1000);
      }
    } else {
      triggerToast("Failed to print invoice");
    }
  };

  const handleSingleGenerateLabel = async (orderId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await generateBulkLabelsAction([orderId]);
      if (res.success && res.results && res.results[0].success) {
        triggerToast("Label generated successfully. Status: Shipped.");
        await loadOrders();
      } else {
        triggerToast(res.results?.[0]?.error || "Failed to generate label");
      }
    } catch (err: any) {
      triggerToast(err.message || "Label generation failed");
    } finally {
      setSubmitting(false);
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
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all
                  ${tab.id === 'pending' 
                    ? 'bg-red-100 text-red-700'
                    : tab.id === 'live'
                      ? 'bg-green-100 text-green-700'
                      : isActive 
                        ? 'bg-gray-200 text-gray-800'
                        : 'bg-gray-100 text-gray-500'
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
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-green-800">
              ✓ {selectedIds.length} order(s) selected
            </span>
            <button
              onClick={handleBulkAccept}
              disabled={submitting}
              className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors border-none"
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
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-blue-800">
              🖨️ {selectedIds.length} order(s) selected
            </span>
            <button
              onClick={handleBulkPrintInvoices}
              disabled={submitting}
              className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors border-none"
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
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-amber-800">
              📦 {selectedIds.length} order(s) selected
            </span>
            <button
              onClick={handleBulkGenerateLabels}
              disabled={submitting}
              className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors border-none"
            >
              Generate Shiprocket Labels ({selectedIds.length})
            </button>
          </div>
          <button onClick={clearSelection} className="text-gray-500 text-xs font-bold uppercase hover:text-black cursor-pointer bg-transparent border-none">
            Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'shipped' && (
        <div className="flex justify-end mb-6">
          <button
            onClick={handlePrintManifest}
            disabled={submitting}
            className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors border-none"
          >
            <span className="material-symbols-outlined text-sm">assignment</span>
            Print Shipped Manifests
          </button>
        </div>
      )}

      {/* Main Ledger Table */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl"/>
          <div className="h-32 bg-gray-200 rounded-xl"/>
          <div className="h-64 bg-gray-200 rounded-xl"/>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-xl">
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
                    const detailLink = `/admindashboard/order-details?orderId=${order.id}`;
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
                            {order.shiprocketId && (
                              <span className="text-[9px] text-[#775a19] font-mono mt-1">
                                AWB: {order.shiprocketId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black font-headline text-black text-sm">
                          ₹{order.total.toLocaleString("en-IN")}.00
                        </td>
                        <td className="px-8 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <span className={`inline-block px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md ${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-3 font-bold text-[10px] uppercase tracking-wider">
                            {activeTab === 'live' && (
                              <button
                                onClick={() => handleSingleAccept(order.id)}
                                className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors border-none"
                              >
                                Accept
                              </button>
                            )}
                            {activeTab === 'processing' && (
                              <button
                                onClick={() => handleSinglePrintInvoice(order.id)}
                                className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors border-none"
                              >
                                Print Invoice
                              </button>
                            )}
                            {activeTab === 'packed' && (
                              <button
                                onClick={() => handleSingleGenerateLabel(order.id)}
                                className="bg-[#0a0a0a] text-white hover:bg-gray-800 px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors border-none"
                              >
                                Generate Label
                              </button>
                            )}
                            {isPendingTab && (
                              <Link
                                href={detailLink}
                                className="bg-[#775a19] text-white hover:bg-[#634812] px-3 py-1.5 rounded text-[10px] font-bold transition-colors text-center no-underline"
                              >
                                Process Now
                              </Link>
                            )}
                            {activeTab === 'payment_pending' && (
                              <Link
                                href={detailLink}
                                className="bg-amber-600 text-white hover:bg-amber-700 px-3 py-1.5 rounded text-[10px] font-bold transition-colors text-center no-underline"
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
          <div className="bg-white border border-gray-200 shadow-2xl rounded-2xl p-8 max-w-md w-full animate-zoom-in">
            <h3 className="text-lg font-black uppercase tracking-wider text-black mb-4">
              Generating Shipping Labels...
            </h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4 leading-relaxed">
              Dispatching shipments and requesting label generation from Shiprocket sequentially to respect rate limits.
            </p>
            <div className="space-y-2.5 max-h-64 overflow-y-auto mb-6 border border-gray-100 p-4 rounded-xl bg-gray-50/50">
              {labelResults.map(result => (
                <div key={result.orderId} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0 text-xs">
                  {result.pending ? (
                    <span className="text-amber-500 animate-pulse text-base">⏳</span>
                  ) : result.success ? (
                    <span className="text-green-600 text-base">✅</span>
                  ) : (
                    <span className="text-red-600 text-base">❌</span>
                  )}
                  <span className="font-bold font-mono flex-1 text-gray-700">
                    #{result.orderId}
                  </span>
                  {result.success && result.awb && (
                    <span className="text-[10px] bg-green-50 text-green-700 font-mono px-2 py-0.5 rounded border border-green-200/50">
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
                  className="bg-black text-white hover:bg-gray-800 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-none"
                >
                  Done
                </button>
              </div>
            )}
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
