"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Order, Product } from "@/lib/types";
import { updateOrderToProcessingAction } from "@/app/actions/orders";

interface InvoiceClientProps {
  initialOrder: Order;
  products: Product[];
  originalTotal: number;
  finalGatewayAmount: number;
  pointsDiscount: number;
  walletPaid: number;
  couponDiscount: number;
  gstin?: string;
}

const getStateInfo = (address: any) => {
  if (!address) {
    return {
      state: "Tamil Nadu",
      code: "33",
      isLocal: true,
    };
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

  return {
    state: addr.state || "Tamil Nadu",
    code,
    isLocal,
  };
};

const getHSN = (category: string) => {
  if (category?.toLowerCase().includes("t-shirt") || category?.toLowerCase().includes("tshirt")) {
    return "6109";
  }
  return "6205"; // Default: woven shirts
};

export default function InvoiceClient({
  initialOrder,
  products,
  originalTotal,
  finalGatewayAmount,
  pointsDiscount,
  walletPaid,
  couponDiscount,
  gstin = "33BFOPT4938Q1ZE",
}: InvoiceClientProps) {
  const router = useRouter();
  const [matchedOrder, setMatchedOrder] = useState<Order>(initialOrder);

  const handlePrint = async () => {
    if (matchedOrder && matchedOrder.status === "Paid") {
      const res = await updateOrderToProcessingAction(matchedOrder.id);
      if (res.success && res.order) {
        setMatchedOrder(res.order);
        window.dispatchEvent(new Event("storage"));
      }
    }
    window.print();
  };

  const renderAddress = () => {
    if (!matchedOrder.address_snapshot) {
      return (
        <>
          12/A Sky Gardens, Worli Sea Face<br />
          Mumbai, Maharashtra 400018
        </>
      );
    }

    try {
      const addr = typeof matchedOrder.address_snapshot === "string"
        ? JSON.parse(matchedOrder.address_snapshot)
        : matchedOrder.address_snapshot;

      const line1 = addr.address_line_1 || addr.address || "";
      const line2 = addr.address_line_2 || "";
      const city = addr.city || "";
      const state = addr.state || "";
      const zip = addr.postal_code || addr.pincode || "";

      return (
        <>
          {line1}
          {line2 ? <><br />{line2}</> : null}
          <br />
          {city}, {state} {zip}
          {addr.phone ? <><br />T: {addr.phone}</> : null}
        </>
      );
    } catch (e) {
      return (
        <>
          12/A Sky Gardens, Worli Sea Face<br />
          Mumbai, Maharashtra 400018
        </>
      );
    }
  };

  const stateInfo = getStateInfo(matchedOrder.address_snapshot || (matchedOrder as any).address);

  // Calculate item-by-item GST rates dynamically to handle mixed 5% and 12% products correctly
  let sumItemPrices = 0;
  let sumItemTaxable = 0;
  
  const itemsWithTax = matchedOrder.items.map((itemName) => {
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
  const taxableBase = matchedOrder.total / (1 + blendedGstRate);
  const totalGst = matchedOrder.total - taxableBase;
  const cgst = stateInfo.isLocal ? totalGst / 2 : 0;
  const sgst = stateInfo.isLocal ? totalGst / 2 : 0;
  const igst = !stateInfo.isLocal ? totalGst : 0;

  // Group items by GST rate for GST tax breakup table
  const gstGroups: Record<number, { taxableBase: number; cgst: number; sgst: number; igst: number; totalTax: number }> = {};
  itemsWithTax.forEach((item) => {
    const rate = item.gstRate;
    const proportion = sumItemPrices > 0 ? item.price / sumItemPrices : 0;
    const categoryTotal = matchedOrder.total * proportion;
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

  return (
    <div className="bg-[#f9f9f9] text-on-surface font-body min-h-screen py-12 px-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .invoice-container { 
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}} />

      <div className="fixed top-6 right-6 flex gap-4 no-print z-50">
        <button
          onClick={handlePrint}
          className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-all shadow-xl rounded-none cursor-pointer"
        >
          Print / Download PDF
        </button>
        <button
          onClick={() => router.back()}
          className="bg-white border border-gray-200 text-gray-500 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all rounded-none cursor-pointer"
        >
          Go Back
        </button>
      </div>

      <div className="invoice-container bg-white max-w-[800px] mx-auto p-10 sm:p-16 border border-gray-200 shadow-sm relative overflow-hidden print:border-none print:shadow-none print:p-8">
        <div className="absolute top-0 right-0 opacity-[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-[#faf9f8] p-1 flex items-center justify-center shadow-sm border border-[#775a19]/15">
            <Image 
              src="/assets/logo.png" 
              alt="6K Logo" 
              width={32}
              height={32}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>
        </div>

        <div className="flex justify-between items-start mb-16">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 bg-black text-white flex items-center justify-center font-headline font-black text-xs">6K</div>
              <span className="font-headline text-xl font-black tracking-tighter uppercase">JRT TEXTILES (6K Brand)</span>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-loose">
              <p>1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar</p>
              <p>Tiruchirappalli – 620018, Tamil Nadu, India</p>
              <p className="text-black font-extrabold mt-1">GSTIN: {gstin}</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-headline text-3xl font-black tracking-tighter uppercase mb-2">Tax Invoice</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Rule 46 CGST Rules 2017</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-20 mb-16">
          <div className="border-l-4 border-[#775a19] pl-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Bill To / Ship To</h4>
            <p className="font-headline font-bold text-sm uppercase">{matchedOrder.customer}</p>
            <p className="text-[10px] text-gray-500 font-medium mt-2 leading-relaxed uppercase tracking-wider">
              {renderAddress()}
            </p>
          </div>
          <div className="text-right">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Invoice Details</h4>
            <div className="space-y-2 text-[10px] font-bold uppercase">
              <p><span className="text-gray-400">Invoice No:</span> <span className="font-mono">#{matchedOrder.id}</span></p>
              <p><span className="text-gray-400">Date:</span> <span>{matchedOrder.date}</span></p>
              <p><span className="text-gray-400">Place of Supply:</span> <span className="text-black">{stateInfo.state} ({stateInfo.code})</span></p>
              <p><span className="text-gray-400">Status:</span> {matchedOrder.status}</p>
            </div>
          </div>
        </div>

        <table className="w-full mb-12 text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-4 text-[10px] font-black uppercase tracking-widest">Item Description</th>
              <th className="py-4 text-center text-[10px] font-black uppercase tracking-widest w-20">HSN</th>
              <th className="py-4 text-center text-[10px] font-black uppercase tracking-widest w-16">Qty</th>
              <th className="py-4 text-right text-[10px] font-black uppercase tracking-widest w-28">Taxable Rate</th>
              <th className="py-4 text-right text-[10px] font-black uppercase tracking-widest w-28">Taxable Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {itemsWithTax.map((item, index) => {
              return (
                <tr key={index}>
                  <td className="py-6">
                    <p className="font-headline font-bold text-sm uppercase">{item.itemName}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      {item.category}
                    </p>
                  </td>
                  <td className="py-6 text-center font-mono font-bold text-xs">{item.hsn}</td>
                  <td className="py-6 text-center font-bold">01</td>
                  <td className="py-6 text-right font-mono font-bold">₹{item.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-6 text-right font-mono font-bold">₹{item.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mb-16">
          <div className="w-72 space-y-4 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal (Original Price)</span>
              <span className="font-mono">₹{originalTotal.toLocaleString("en-IN")}.00</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="text-gray-400">Coupon Discount ({matchedOrder.couponCode || "N/A"})</span>
                <span className="font-mono">-₹{couponDiscount.toLocaleString("en-IN")}.00</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="text-gray-400">Loyalty Discount ({matchedOrder.pointsRedeemed} pts)</span>
                <span className="font-mono">-₹{pointsDiscount.toLocaleString("en-IN")}.00</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Premium Shipping</span>
              <span className="font-mono">
                {matchedOrder.shippingAmount || matchedOrder.shipping_amount ? (
                  `₹${(matchedOrder.shippingAmount || matchedOrder.shipping_amount || 0).toLocaleString("en-IN")}.00`
                ) : (
                  <span className="text-[#775a19] font-bold">FREE</span>
                )}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-400">Taxable Value</span>
              <span className="font-mono">₹{taxableBase.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            {stateInfo.isLocal ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span className="text-gray-400">CGST</span>
                  <span className="font-mono">₹{cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="text-gray-400">SGST</span>
                  <span className="font-mono">₹{sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-gray-600">
                <span className="text-gray-400">IGST</span>
                <span className="font-mono">₹{igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-400">Total (incl. GST)</span>
              <span className="font-mono">₹{matchedOrder.total.toLocaleString("en-IN")}.00</span>
            </div>
            {walletPaid > 0 && (
              <div className="flex justify-between text-[#775a19]">
                <span className="text-gray-400">Paid via Wallet</span>
                <span className="font-mono">-₹{walletPaid.toLocaleString("en-IN")}.00</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-4">
              <span className="text-black font-black">
                {finalGatewayAmount === 0 ? "Total Paid (Wallet)" : "Grand Total / Gateway Paid"}
              </span>
              <span className="text-xl font-headline font-black font-mono">
                ₹{(finalGatewayAmount === 0 ? walletPaid : finalGatewayAmount).toLocaleString("en-IN")}.00
              </span>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">GST Tax Breakup</h4>
          <table className="w-full text-left border border-gray-200 border-collapse text-[10px] font-bold uppercase">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 border-r border-gray-200">HSN</th>
                <th className="p-3 border-r border-gray-200 text-right">Taxable Value</th>
                {stateInfo.isLocal ? (
                  <>
                    <th className="p-3 border-r border-gray-200 text-center w-20">CGST Rate</th>
                    <th className="p-3 border-r border-gray-200 text-right">CGST Amt</th>
                    <th className="p-3 border-r border-gray-200 text-center w-20">SGST Rate</th>
                    <th className="p-3 border-r border-gray-200 text-right">SGST Amt</th>
                  </>
                ) : (
                  <>
                    <th className="p-3 border-r border-gray-200 text-center w-24">IGST Rate</th>
                    <th className="p-3 border-r border-gray-200 text-right">IGST Amt</th>
                  </>
                )}
                <th className="p-3 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gstGroups).map(([rateStr, group]) => {
                const rate = Number(rateStr);
                return (
                  <tr key={rate} className="font-mono border-b border-gray-100">
                    <td className="p-3 border-r border-gray-200 font-sans font-bold">6205</td>
                    <td className="p-3 border-r border-gray-200 text-right">₹{group.taxableBase.toFixed(2)}</td>
                    {stateInfo.isLocal ? (
                      <>
                        <td className="p-3 border-r border-gray-200 text-center">{(rate / 2).toFixed(1)}%</td>
                        <td className="p-3 border-r border-gray-200 text-right">₹{group.cgst.toFixed(2)}</td>
                        <td className="p-3 border-r border-gray-200 text-center">{(rate / 2).toFixed(1)}%</td>
                        <td className="p-3 border-r border-gray-200 text-right">₹{group.sgst.toFixed(2)}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 border-r border-gray-200 text-center">{rate}%</td>
                        <td className="p-3 border-r border-gray-200 text-right">₹{group.igst.toFixed(2)}</td>
                      </>
                    )}
                    <td className="p-3 text-right">₹{group.totalTax.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide leading-relaxed mb-12 border-t border-gray-100 pt-6">
          <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </p>

        <div className="flex justify-between items-end">
          <div>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-relaxed max-w-xs">
              This document serves as a compliant GST Tax Invoice. Thank you for shopping with us.
            </p>
          </div>
          <div className="text-right">
            <div className="mb-2 italic font-headline font-bold text-gray-400">Workshop Manager</div>
            <p className="text-[9px] font-black uppercase tracking-widest border-t border-black pt-2 inline-block">
              Authorized Signature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
