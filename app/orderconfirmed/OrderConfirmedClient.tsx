"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trackPurchase } from "@/lib/analytics";

interface OrderConfirmedClientProps {
  lastOrder: any;
  marquee?: any;
}

export default function OrderConfirmedClient({ lastOrder }: OrderConfirmedClientProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [animationDone, setAnimationDone] = useState(false);
  const trackedOrders = useRef<Record<string, boolean>>({});

  const order = lastOrder;

  // Auto redirect after 5 seconds - with guard
  useEffect(() => {
    if (!order) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/orderhistory");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [order, router]);

  // Show checkmark animation after mount - with guard
  useEffect(() => {
    if (!order) return;
    const timerId = setTimeout(() => setAnimationDone(true), 500);
    return () => clearTimeout(timerId);
  }, [order]);

  // Analytics tracking effect - with guard
  useEffect(() => {
    if (!order) return;
    if (order && !trackedOrders.current[order.id]) {
      trackedOrders.current[order.id] = true;

      // 1. Meta Pixel Purchase
      const timestamp = order.created_at ? new Date(order.created_at).getTime() : Date.now();
      const eventId = `purchase_${order.id}_${timestamp}`;

      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Purchase", {
          value: order.total,
          currency: "INR",
          content_ids: order.cartItems?.map((i: any) => i.productId) || [],
          content_type: "product",
          num_items: order.cartItems?.length || 1,
          order_id: order.id,
        }, { eventID: eventId });
      }

      // 2. Google Ads conversion
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", {
          send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL}`,
          value: order.total,
          currency: "INR",
          transaction_id: order.id,
        });
      }

      // 3. GA4 purchase conversion
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "purchase", {
          transaction_id: order.id,
          value: order.total,
          currency: "INR",
          coupon: order.couponCode || "",
          items: order.cartItems?.map((item: any, index: number) => ({
            item_id: item.productId,
            item_name: item.productName || item.name,
            price: item.price,
            quantity: item.quantity || 1,
            index: index,
            item_category: "Shirts",
          })) || [],
        });
      }

      // 4. GTM dataLayer push
      if (typeof window !== "undefined") {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
          event: "purchase",
          ecommerce: {
            transaction_id: order.id,
            value: order.total,
            currency: "INR",
            coupon: order.couponCode || "",
            items: order.cartItems?.map((item: any) => ({
              item_id: item.productId,
              item_name: item.productName,
              price: item.price,
              quantity: item.quantity || 1,
            })) || [],
          },
        });
      }

      // 5. Custom Analytics fallback wrapper
      const itemsMapped = order.cartItems || (order.items || []).map((name: string) => ({
        productId: order.id,
        productName: name,
        price: order.total,
        quantity: 1,
      }));
      trackPurchase({
        orderId: order.id,
        total: order.total,
        items: itemsMapped,
        couponCode: order.couponCode,
      });
    }
  }, [order]);

  // Conditional returns placed AFTER all hook definitions
  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f8] px-6 py-12 relative overflow-hidden">
        <div className="absolute inset-0 ambient-glow-gold pointer-events-none opacity-40" />
        <div className="w-full max-w-md bg-white border border-[#7f7667]/20 p-8 md:p-12 text-center relative z-10 rounded-none shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className="w-16 h-16 border border-[#775a19]/30 flex items-center justify-center mx-auto mb-6 bg-[#faf9f8] rounded-none">
            <svg className="w-6 h-6 text-[#775a19]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-headline font-black tracking-tighter text-[#1a1c1c] uppercase leading-none mb-3">Order Placed!</h2>
          <p className="text-xs text-[#7f7667] mb-8 font-medium uppercase tracking-wider">Check your email for confirmation.</p>
          <Link
            href="/orderhistory"
            className="w-full flex items-center justify-center bg-[#1a1c1c] text-[#faf9f8] py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all duration-300 rounded-none cursor-pointer border-none"
          >
            View Orders
          </Link>
        </div>
      </div>
    );
  }

  const isWallet = (order.walletPaid || 0) > 0 && (order.gatewayPaid || 0) === 0;
  const isSplit = (order.walletPaid || 0) > 0 && (order.gatewayPaid || 0) > 0;

  return (
    <div className="min-h-screen bg-[#faf9f8] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 ambient-glow-gold pointer-events-none opacity-40" />

      {/* Main content box */}
      <div className="w-full max-w-md bg-white border border-[#7f7667]/20 p-8 md:p-12 relative z-10 rounded-none shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        {/* Top Gold Bar */}
        <div className="w-full h-1 bg-[#775a19] mb-8" />

        {/* Success animation / indicator */}
        <div
          className={`transition-all duration-700 mx-auto mb-6 w-16 h-16 border border-[#775a19]/30 bg-[#faf9f8] flex items-center justify-center rounded-none ${
            animationDone ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <svg className="w-6 h-6 text-[#775a19]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Headings */}
        <h1 className="text-3xl font-headline font-black tracking-tighter text-[#1a1c1c] text-center uppercase leading-none mb-2">
          Order Placed
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] text-center mb-8">
          {isWallet
            ? "Paid via Store Wallet"
            : isSplit
            ? "Paid via Razorpay + Wallet"
            : "Paid via Razorpay"}
        </p>

        {/* Order details card (Brutalist Receipt Style) */}
        <div className="w-full bg-[#faf9f8] border border-[#7f7667]/15 p-6 mb-8 rounded-none">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#7f7667]/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#7f7667]">Order ID</span>
            <span className="font-mono font-bold text-xs text-[#1a1c1c]">#{order.id}</span>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {order.cartItems?.slice(0, 3).map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-start py-1">
                <span className="text-xs text-[#1a1c1c] font-medium leading-tight max-w-[200px]">
                  {item.productName || item.name}
                  {item.size ? <span className="text-[9px] text-[#7f7667] block font-black uppercase tracking-wider mt-0.5">Size: {item.size}</span> : ""}
                </span>
                <span className="text-xs font-bold text-[#1a1c1c] whitespace-nowrap">
                  ₹{item.price?.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>

          {order.cartItems && order.cartItems.length > 3 && (
            <p className="text-[9px] font-black uppercase tracking-wider text-[#7f7667] mt-3 pt-3 border-t border-[#7f7667]/5">
              + {order.cartItems.length - 3} more items
            </p>
          )}

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#7f7667]/15">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#1a1c1c]">Total Paid</span>
            <span className="font-headline font-black text-lg text-[#775a19]">
              ₹{order.total?.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Delivery estimate */}
          <div className="mt-4 pt-4 border-t border-[#7f7667]/10 flex items-center gap-3">
            <svg className="w-5 h-5 text-[#7f7667] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16v-4a1 1 0 00-.3-.7l-3-3a1 1 0 00-.7-.3H13v8" />
            </svg>
            <span className="text-[10px] text-[#7f7667] font-bold uppercase tracking-wider leading-tight">
              Estimated delivery in 3-5 business days
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full space-y-3">
          <Link
            href="/orderhistory"
            className="w-full flex items-center justify-center bg-[#1a1c1c] text-[#faf9f8] py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all duration-300 rounded-none cursor-pointer border-none"
          >
            View My Orders
          </Link>
          <Link
            href="/shopallshirts"
            className="w-full flex items-center justify-center border border-[#7f7667]/20 text-[#1a1c1c] py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:border-[#1a1c1c] transition-all duration-300 rounded-none cursor-pointer bg-white"
          >
            Continue Shopping
          </Link>
        </div>

        {/* Auto redirect countdown & Email note */}
        <div className="mt-8 pt-6 border-t border-[#7f7667]/10 text-center">
          <p className="text-[9px] text-[#7f7667] font-bold uppercase tracking-widest">
            Redirecting to orders in <span className="font-black text-[#1a1c1c]">{countdown}s</span>...
          </p>
          <p className="text-[9px] text-[#7f7667]/80 font-bold uppercase tracking-wide mt-2 max-w-xs mx-auto leading-normal">
            A confirmation email has been sent to your registered email address
          </p>
        </div>
      </div>
    </div>
  );
}
