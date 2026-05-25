"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Order, Product } from "@/lib/registry";
import { db } from "@/lib/db";

function InvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");

  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function loadInvoiceData() {
      const allProducts = await db.getProducts();
      const allOrders = await db.getOrders();
      setProducts(allProducts);

      let order = allOrders.find((o) => o.id === orderIdParam);
      if (!order && allOrders.length > 0) {
        order = allOrders[0];
      }
      if (order) {
        setMatchedOrder(order);
      }
    }
    loadInvoiceData();
  }, [orderIdParam]);

  if (!matchedOrder) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center">
        <h3 className="font-headline text-lg font-black uppercase text-on-surface mb-2">No Order Selected</h3>
        <p className="text-xs text-outline mb-6">Please choose an order from your Order History.</p>
        <button onClick={() => router.push("/orderhistory")} className="bg-primary text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-secondary">
          Go To History
        </button>
      </div>
    );
  }

  const pointsDiscount = matchedOrder.pointsDiscount || 0;
  const walletPaid = matchedOrder.walletPaid || 0;
  const couponDiscount = matchedOrder.couponDiscount || 0;
  const originalTotal = matchedOrder.originalTotal !== undefined ? matchedOrder.originalTotal : (matchedOrder.total + pointsDiscount + couponDiscount);
  const finalGatewayAmount = matchedOrder.gatewayPaid !== undefined ? matchedOrder.gatewayPaid : Math.max(0, matchedOrder.total - walletPaid);

  return (
    <div className="bg-[#f9f9f9] text-on-surface font-body min-h-screen py-12 px-6">
      {/* Control Actions */}
      <div className="fixed top-6 right-6 flex gap-4 print:hidden z-50">
        <button
          onClick={() => window.print()}
          className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-all shadow-xl rounded-none"
        >
          Print / Download PDF
        </button>
        <button
          onClick={() => router.back()}
          className="bg-white border border-gray-200 text-gray-500 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all rounded-none"
        >
          Go Back
        </button>
      </div>

      <div className="bg-white max-w-[800px] mx-auto p-10 sm:p-16 border border-gray-200 shadow-sm relative overflow-hidden print:border-none print:shadow-none print:p-8">
        {/* Watermark SVG */}
        <div className="absolute top-0 right-0 opacity-[0.03] -translate-y-1/2 translate-x-1/2 pointer-events-none">
          <svg width="400" height="400" viewBox="0 0 48 48" fill="currentColor">
            <path d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z" />
          </svg>
        </div>

        {/* Brand identity header */}
        <div className="flex justify-between items-start mb-20">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="size-8 bg-black text-white flex items-center justify-center font-headline font-black text-xs">6K</div>
              <span className="font-headline text-xl font-black tracking-tighter uppercase">6K Shirts</span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-loose">
              Flat 102, Sector 4<br />
              Varanasi, UP 221001<br />
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
              12/A Sky Gardens, Worli Sea Face<br />
              Mumbai, Maharashtra 400018
            </p>
          </div>
          <div className="text-right">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Order Details</h4>
            <div className="space-y-2 text-[10px] font-bold uppercase">
              <p><span className="text-gray-400">Ref ID:</span> <span className="font-mono">#{matchedOrder.id}</span></p>
              <p><span className="text-gray-400">Date:</span> <span>{matchedOrder.date}</span></p>
              <p><span className="text-gray-400">Status:</span> Authorized / Paid</p>
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
              <span className="text-[#775a19]">Complimentary</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-400">Net Total</span>
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

export default function InvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    }>
      <InvoiceContent />
    </Suspense>
  );
}
