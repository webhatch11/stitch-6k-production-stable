export function buildInvoiceHtml(
  data: InvoiceData,
  compact: boolean = false
): string {

// State codes - complete India list
const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh":"37","Arunachal Pradesh":"12",
  "Assam":"18","Bihar":"10","Chhattisgarh":"22",
  "Goa":"30","Gujarat":"24","Haryana":"06",
  "Himachal Pradesh":"02","Jharkhand":"20",
  "Karnataka":"29","Kerala":"32",
  "Madhya Pradesh":"23","Maharashtra":"27",
  "Manipur":"14","Meghalaya":"17","Mizoram":"15",
  "Nagaland":"13","Odisha":"21","Punjab":"03",
  "Rajasthan":"08","Sikkim":"11",
  "Tamil Nadu":"33","Telangana":"36",
  "Tripura":"16","Uttar Pradesh":"09",
  "Uttarakhand":"05","West Bengal":"19",
  "Andaman and Nicobar Islands":"35",
  "Chandigarh":"04",
  "Dadra and Nagar Haveli and Daman and Diu":"26",
  "Delhi":"07","Jammu and Kashmir":"01",
  "Ladakh":"38","Lakshadweep":"31","Puducherry":"34"
};

const ABBREVIATIONS: Record<string, string> = {
  "TN": "Tamil Nadu",
  "MH": "Maharashtra",
  "KA": "Karnataka",
  "DL": "Delhi",
  "GJ": "Gujarat",
  "UP": "Uttar Pradesh",
  "WB": "West Bengal",
  "TS": "Telangana",
  "AP": "Andhra Pradesh",
  "KL": "Kerala",
  "RJ": "Rajasthan",
  "MP": "Madhya Pradesh",
  "BR": "Bihar",
  "PB": "Punjab",
  "HR": "Haryana",
  "GA": "Goa"
};

const SELLER = {
  name: "JRT TEXTILES (6K Brand)",
  gstin: "33BFOPT4938Q1ZE",
  address: "1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar",
  city: "Tiruchirappalli",
  state: "Tamil Nadu",
  pincode: "620018",
  logo: "/assets/logo.png"
};

// State resolution
const resolvedState = (data.customerState || "Tamil Nadu").trim();
let stateName = resolvedState;
if (ABBREVIATIONS[resolvedState.toUpperCase()]) {
  stateName = ABBREVIATIONS[resolvedState.toUpperCase()];
}
const searchState = Object.keys(STATE_CODES).find(
    (key) => key.toLowerCase() === stateName.toLowerCase()
) || "Tamil Nadu";
const customerStateCode = STATE_CODES[searchState] || "33";
const isLocal = customerStateCode === "33";

let sumItemPrices = 0;
let sumItemTaxable = 0;

const processedItems = data.items.map(item => {
  const qty = item.quantity || 1;
  const rate = item.rate || 0;
  const gstRate = item.gstRate || 12;
  const taxableValue = rate / (1 + gstRate / 100);
  const gstAmt = rate - taxableValue;

  sumItemPrices += rate * qty;
  sumItemTaxable += taxableValue * qty;

  return {
    ...item,
    qty,
    rate,
    gstRate,
    taxableValue,
    gstAmt,
    cgst: isLocal ? gstAmt / 2 : 0,
    sgst: isLocal ? gstAmt / 2 : 0,
    igst: isLocal ? 0 : gstAmt,
    total: rate * qty
  };
});

const blendedGstRate = sumItemPrices > 0 ? (sumItemPrices / sumItemTaxable) - 1 : 0.12;
const taxableBase = data.total / (1 + blendedGstRate);
const totalGst = data.total - taxableBase;
const cgst = isLocal ? totalGst / 2 : 0;
const sgst = isLocal ? totalGst / 2 : 0;
const igst = isLocal ? 0 : totalGst;

// Group items by HSN + GST Rate
const gstGroups: Record<string, { hsn: string; rate: number; taxableBase: number; cgst: number; sgst: number; igst: number; totalTax: number }> = {};
processedItems.forEach(item => {
  const key = `${item.hsn}_${item.gstRate}`;
  const proportion = sumItemPrices > 0 ? (item.rate * item.qty) / sumItemPrices : 0;
  const itemTotal = data.total * proportion;
  const itemTaxableBase = itemTotal / (1 + item.gstRate / 100);
  const itemGst = itemTotal - itemTaxableBase;

  if (!gstGroups[key]) {
    gstGroups[key] = {
      hsn: item.hsn,
      rate: item.gstRate,
      taxableBase: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0
    };
  }
  gstGroups[key].taxableBase += itemTaxableBase;
  if (isLocal) {
    gstGroups[key].cgst += itemGst / 2;
    gstGroups[key].sgst += itemGst / 2;
  } else {
    gstGroups[key].igst += itemGst;
  }
  gstGroups[key].totalTax += itemGst;
});

const walletPaid = data.walletPaid || 0;
const couponDiscount = data.couponDiscount || 0;
const pointsDiscount = data.pointsDiscount || 0;
const originalTotal = data.originalTotal !== undefined ? data.originalTotal : (data.total + pointsDiscount + couponDiscount);
const finalGatewayAmount = Math.max(0, data.total - walletPaid);

const pagePadding = compact ? '20px' : '30px';

return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice - #${data.invoiceNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: ${compact ? '0' : '20px'};
      color: #333;
      background: ${compact ? 'white' : '#f9f9f9'};
    }
    .invoice {
      border: ${compact ? 'none' : '1px solid #ddd'};
      padding: ${pagePadding};
      margin: 0 auto ${compact ? '0' : '30px'} auto;
      max-width: 800px;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      background: white;
    }
    .page-break {
      page-break-after: always;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      position: relative;
      z-index: 10;
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
      margin-bottom: 15px;
      font-size: 11px;
      position: relative;
      z-index: 10;
    }
    .bill-to {
      border-left: 4px solid #775a19;
      padding-left: 20px;
    }
    .bill-to h4, .invoice-details h4 {
      margin: 0 0 5px 0;
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
      font-size: 11px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      position: relative;
      z-index: 10;
    }
    table.items-table th {
      border-bottom: 2px solid #000;
      padding: 6px 0;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      text-align: left;
    }
    table.items-table td {
      padding: 8px 0;
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
      margin-bottom: 15px;
      position: relative;
      z-index: 10;
    }
    .totals-box {
      width: 320px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .grand-total {
      border-top: 1px solid #eee;
      padding-top: 6px;
      font-size: 13px;
      font-weight: 900;
    }
    .tax-breakdown {
      margin-bottom: 15px;
      position: relative;
      z-index: 10;
    }
    .tax-table {
      width: 100%;
      font-size: 9px;
      border: 1px solid #ddd;
      border-collapse: collapse;
    }
    .tax-table th, .tax-table td {
      border: 1px solid #ddd;
      padding: 5px;
      font-weight: bold;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 20px;
      position: relative;
      z-index: 10;
    }
    .declaration {
      font-size: 9px;
      color: #666;
      max-width: 400px;
      line-height: 1.5;
      position: relative;
      z-index: 10;
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
      @page {
        size: A4;
        margin: 5mm 8mm 5mm 8mm;
      }
      body {
        padding: 0;
        margin: 0 !important;
        background: white;
      }
      .invoice {
        border: none;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        height: 280mm !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        page-break-after: always !important;
      }
      .page-break {
        page-break-after: always !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Large centered watermark background -->
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; opacity: 0.10; pointer-events: none; z-index: 0;">
      <img src="/assets/logo.png" alt="6K Watermark" style="width: 450px; height: 450px; object-fit: contain;" />
    </div>

    <div class="header">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <img src="/assets/logo.png" alt="6K Logo" style="height: 40px; width: 40px; object-fit: contain;" />
          <span class="company-title">${SELLER.name}</span>
        </div>
        <div style="font-size: 8px; color: #888; text-transform: uppercase; line-height: 1.5;">
          <p style="margin: 0;">${SELLER.address}</p>
          <p style="margin: 0;">${SELLER.city} – ${SELLER.pincode}, ${SELLER.state}, India</p>
          <p style="margin: 5px 0 0 0; color: black; font-weight: bold;">GSTIN: ${SELLER.gstin}</p>
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
        <p style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">${data.customerName}</p>
        <p style="margin: 5px 0 0 0; font-size: 9px; color: #555; line-height: 1.4; text-transform: uppercase;">
          ${data.customerAddress}<br/>
          ${data.customerCity}, ${data.customerState} ${data.customerPincode}
          ${data.customerPhone ? `<br/>T: ${data.customerPhone}` : ""}
        </p>
      </div>
      <div class="invoice-details" style="text-align: right;">
        <h4>Invoice Details</h4>
        <p><span style="color: #888; font-weight: normal;">Invoice No:</span> <span style="font-family: monospace;">#${data.invoiceNumber}</span></p>
        <p><span style="color: #888; font-weight: normal;">Date:</span> <span>${data.invoiceDate}</span></p>
        <p><span style="color: #888; font-weight: normal;">Supply Place:</span> <span>${stateName} (${customerStateCode})</span></p>
        <p><span style="color: #888; font-weight: normal;">Status:</span> <span>${data.status}</span></p>
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
      <tbody>
        ${processedItems.slice(0, 6).map(item => `
          <tr>
            <td>
              <p style="margin: 0; font-weight: bold; text-transform: uppercase;">${item.name}</p>
              <p style="margin: 3px 0 0 0; font-size: 8px; color: #888; text-transform: uppercase;">${item.category}</p>
            </td>
            <td class="text-center" style="font-family: monospace; font-weight: bold;">${item.hsn}</td>
            <td class="text-center">01</td>
            <td class="text-right" style="font-family: monospace;">₹${item.taxableValue.toFixed(2)}</td>
            <td class="text-right" style="font-family: monospace;">₹${item.taxableValue.toFixed(2)}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <span style="color: #888;">Subtotal (Original)</span>
          <span style="font-family: monospace;">₹${originalTotal.toFixed(2)}</span>
        </div>
        ${couponDiscount > 0 ? `
          <div class="totals-row" style="color: red;">
            <span style="color: #888;">Coupon Discount</span>
            <span style="font-family: monospace;">-₹${couponDiscount.toFixed(2)}</span>
          </div>` : ''}
        ${pointsDiscount > 0 ? `
          <div class="totals-row" style="color: red;">
            <span style="color: #888;">Loyalty Discount (${data.pointsRedeemed} pts)</span>
            <span style="font-family: monospace;">-₹${pointsDiscount.toFixed(2)}</span>
          </div>` : ''}
        <div class="totals-row">
          <span style="color: #888;">Shipping</span>
          <span style="font-family: monospace; color: #775a19;">
            ${data.shippingCharge > 0 ? `₹${data.shippingCharge.toFixed(2)}` : 'FREE'}
          </span>
        </div>
        <div class="totals-row" style="border-top: 1px solid #eee; padding-top: 5px;">
          <span style="color: #888;">Taxable Value</span>
          <span style="font-family: monospace;">₹${taxableBase.toFixed(2)}</span>
        </div>
        ${isLocal ? `
          <div class="totals-row" style="color: #555;">
            <span style="color: #888;">CGST</span>
            <span style="font-family: monospace;">₹${cgst.toFixed(2)}</span>
          </div>
          <div class="totals-row" style="color: #555;">
            <span style="color: #888;">SGST</span>
            <span style="font-family: monospace;">₹${sgst.toFixed(2)}</span>
          </div>` : `
          <div class="totals-row" style="color: #555;">
            <span style="color: #888;">IGST</span>
            <span style="font-family: monospace;">₹${igst.toFixed(2)}</span>
          </div>`}
        <div class="totals-row" style="border-top: 1px solid #eee; padding-top: 5px;">
          <span style="color: #888;">Total (incl. GST)</span>
          <span style="font-family: monospace;">₹${data.total.toFixed(2)}</span>
        </div>
        ${walletPaid > 0 ? `
          <div class="totals-row" style="color: #775a19;">
            <span style="color: #888;">Paid via Wallet</span>
            <span style="font-family: monospace;">-₹${walletPaid.toFixed(2)}</span>
          </div>` : ''}
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
            <th class="text-right">Taxable Value</th>
            ${isLocal ? `
              <th class="text-center">CGST Rate</th>
              <th class="text-right">CGST Amt</th>
              <th class="text-center">SGST Rate</th>
              <th class="text-right">SGST Amt</th>` : `
              <th class="text-center">IGST Rate</th>
              <th class="text-right">IGST Amt</th>`}
            <th class="text-right">Total Tax</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(gstGroups).map(g => `
            <tr style="font-family: monospace;">
              <td style="font-family: sans-serif; font-weight: bold;">${g.hsn}</td>
              <td class="text-right">₹${g.taxableBase.toFixed(2)}</td>
              ${isLocal ? `
                <td class="text-center">${(g.rate / 2).toFixed(1)}%</td>
                <td class="text-right">₹${g.cgst.toFixed(2)}</td>
                <td class="text-center">${(g.rate / 2).toFixed(1)}%</td>
                <td class="text-right">₹${g.sgst.toFixed(2)}</td>` : `
                <td class="text-center">${g.rate.toFixed(1)}%</td>
                <td class="text-right">₹${g.igst.toFixed(2)}</td>`}
              <td class="text-right">₹${g.totalTax.toFixed(2)}</td>
            </tr>`).join('')}
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
  </div>
</body>
</html>`;
}

export function orderToInvoiceData(
  order: any,
  invoiceNumber: string
): InvoiceData {
  const addr = order.addressSnapshot || order.address_snapshot || {};
  
  const customerAddress = [
    addr.address_line_1 || addr.address || addr.line1 || "",
    addr.address_line_2 || ""
  ].filter(Boolean).join(", ");

  const rawItems = order.cartItems || order.cart_items || [];
  const items = (rawItems.length > 0) ? rawItems.map((i: any) => ({
    name: i.productName || i.name || 'Item',
    hsn: i.hsn || i.hsnCode || (i.price <= 1000 ? '6109' : '6205'),
    quantity: i.quantity || 1,
    rate: i.price || 0,
    gstRate: i.gstRate || i.gst_rate || (i.price <= 1000 ? 5 : 12),
    category: i.category || (i.price <= 1000 ? "Premium Gen-Z T-Shirt" : "Premium Woven Luxury Shirt")
  })) : (order.items || []).map((name: string) => {
    const rate = name.includes("Classic") ? 1299 : 1450;
    return {
      name,
      hsn: rate <= 1000 ? "6109" : "6205",
      quantity: 1,
      rate,
      gstRate: rate <= 1000 ? 5 : 12,
      category: rate <= 1000 ? "Premium Gen-Z T-Shirt" : "Premium Woven Luxury Shirt"
    };
  });

  return {
    orderId: order.id,
    invoiceNumber,
    invoiceDate: new Date(
      order.createdAt || order.created_at || Date.now()
    ).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }),
    customerName: addr.name || order.customer || '',
    customerAddress,
    customerCity: addr.city || '',
    customerState: addr.state || 'Tamil Nadu',
    customerPincode: addr.postal_code || addr.pincode || addr.zip || '',
    customerPhone: addr.phone || '',
    items,
    couponDiscount: order.couponDiscount || order.coupon_discount || 0,
    pointsDiscount: order.pointsDiscount || order.points_discount || 0,
    shippingCharge: order.shippingCharge || order.shipping_charge || 0,
    walletPaid: order.walletPaid || order.wallet_paid || 0,
    gatewayPaid: order.gatewayPaid || order.gateway_paid || 0,
    pointsRedeemed: order.pointsRedeemed || order.points_redeemed || 0,
    total: order.total || 0,
    status: order.status || '',
    date: order.date || '',
    originalTotal: order.originalTotal !== undefined ? order.originalTotal : (order.total + (order.pointsDiscount || order.points_discount || 0) + (order.couponDiscount || order.coupon_discount || 0))
  };
}

export interface InvoiceData {
  orderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerPincode: string;
  customerPhone: string;
  items: Array<{
    name: string;
    hsn: string;
    quantity: number;
    rate: number;
    gstRate: number;
    category: string;
  }>;
  couponDiscount: number;
  pointsDiscount: number;
  shippingCharge: number;
  walletPaid: number;
  gatewayPaid: number;
  pointsRedeemed: number;
  total: number;
  status: string;
  date: string;
  originalTotal?: number;
}
