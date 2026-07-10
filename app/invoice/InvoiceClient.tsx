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
}

export default function InvoiceClient({
  initialOrder,
  products,
  originalTotal,
  finalGatewayAmount,
  pointsDiscount,
  walletPaid,
  couponDiscount,
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

  return (
    <div className="bg-[#f9f9f9] text-on-surface font-body min-h-screen py-12 px-6">
      {/* Control Actions */}
      <div className="fixed top-6 right-6 flex gap-4 print:hidden z-50">
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

      <div className="bg-white max-w-[800px] mx-auto p-10 sm:p-16 border border-gray-200 shadow-sm relative overflow-hidden print:border-none print:shadow-none print:p-8">
        {/* Watermark Logo */}
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

        {/* Brand identity header */}
        <div className="flex justify-between items-start mb-20">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="size-8 bg-black text-white flex items-center justify-center font-headline font-black text-xs">6K</div>
              <span className="font-headline text-xl font-black tracking-tighter uppercase">JRT TEXTILES (6K Brand)</span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-loose">
              1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar<br />
              Tiruchirappalli – 620018, Tamil Nadu<br />
              India
            </p>
          </div>
          <div className="text-right">
            <h1 className="font-headline text-3xl font-black tracking-tighter uppercase mb-2">Invoice</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Order Summary</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-20 mb-20">
          <div className="border-l-4 border-[#775a19] pl-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Customer Details</h4>
            <p className="font-headline font-bold text-sm uppercase">{matchedOrder.customer}</p>
            <p className="text-[10px] text-gray-500 font-medium mt-2 leading-relaxed uppercase tracking-wider">
              {renderAddress()}
            </p>
          </div>
          <div className="text-right">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Order Details</h4>
            <div className="space-y-2 text-[10px] font-bold uppercase">
              <p><span className="text-gray-400">Ref ID:</span> <span className="font-mono">#{matchedOrder.id}</span></p>
              <p><span className="text-gray-400">Date:</span> <span>{matchedOrder.date}</span></p>
              <p><span className="text-gray-400">Status:</span> {matchedOrder.status}</p>
            </div>
          </div>
        </div>

        {/* Invoice Item Table */}
        <table className="w-full mb-20 text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-4 text-[10px] font-black uppercase tracking-widest">Item Description</th>
              <th className="py-4 text-center text-[10px] font-black uppercase tracking-widest">Qty</th>
              <th className="py-4 text-right text-[10px] font-black uppercase tracking-widest">Valuation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {matchedOrder.items.map((itemName, index) => {
              const matchedProd = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase());
              const price = matchedProd ? matchedProd.price : (itemName.includes("Classic") ? 1299 : (itemName.includes("Midnight") ? 1450 : 14500));
              return (
                <tr key={index}>
                  <td className="py-8">
                    <p className="font-headline font-bold text-sm uppercase">{itemName}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Premium Handcrafted Shirt</p>
                  </td>
                  <td className="py-8 text-center font-bold">01</td>
                  <td className="py-8 text-right font-headline font-bold">₹{price.toLocaleString("en-IN")}.00</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals Box */}
        <div className="flex justify-end mb-20">
          <div className="w-64 space-y-4 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal (Original Price)</span>
              <span>₹{originalTotal.toLocaleString("en-IN")}.00</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="text-gray-400">Coupon Discount ({matchedOrder.couponCode || "N/A"})</span>
                <span>-₹{couponDiscount.toLocaleString("en-IN")}.00</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="text-gray-400">Loyalty Discount ({matchedOrder.pointsRedeemed} pts)</span>
                <span>-₹{pointsDiscount.toLocaleString("en-IN")}.00</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Premium Shipping</span>
              <span>
                {matchedOrder.shippingAmount || matchedOrder.shipping_amount ? (
                  `₹${(matchedOrder.shippingAmount || matchedOrder.shipping_amount || 0).toLocaleString("en-IN")}.00`
                ) : (
                  <span className="text-[#775a19] font-bold">FREE</span>
                )}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-400">Subtotal (excl. GST)</span>
              <span>₹{(matchedOrder.total / 1.12).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">GST (12%)</span>
              <span>₹{(matchedOrder.total - (matchedOrder.total / 1.12)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-400">Total (incl. GST)</span>
              <span>₹{matchedOrder.total.toLocaleString("en-IN")}.00</span>
            </div>
            {walletPaid > 0 && (
              <div className="flex justify-between text-[#775a19]">
                <span className="text-gray-400">Paid via Wallet</span>
                <span>-₹{walletPaid.toLocaleString("en-IN")}.00</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-4">
              <span className="text-black font-black">
                {finalGatewayAmount === 0 ? "Total Paid (Wallet)" : "Grand Total / Gateway Paid"}
              </span>
              <span className="text-xl font-headline font-black">
                ₹{(finalGatewayAmount === 0 ? walletPaid : finalGatewayAmount).toLocaleString("en-IN")}.00
              </span>
            </div>
          </div>
        </div>

        {/* Footer Signature */}
        <div className="border-t border-gray-100 pt-12 flex justify-between items-end">
          <div>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-relaxed max-w-xs">
              This document serves as an official order details and receipt. Thank you for shopping with us.
            </p>
          </div>
          <div className="text-right">
            <div className="mb-2 italic font-headline font-bold text-gray-300">Workshop Manager</div>
            <p className="text-[9px] font-black uppercase tracking-widest border-t border-black pt-2 inline-block">
              Authorized Signature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
