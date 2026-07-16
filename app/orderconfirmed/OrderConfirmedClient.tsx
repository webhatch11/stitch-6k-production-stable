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

  // Auto redirect after 5 seconds
  useEffect(() => {
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
  }, [router]);

  // Show checkmark animation after mount
  useEffect(() => {
    setTimeout(() => setAnimationDone(true), 500);
  }, []);

  // Analytics tracking effect
  useEffect(() => {
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

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Order Placed!</h2>
          <p className="text-gray-500 mb-8">Check your email for confirmation.</p>
          <Link
            href="/orderhistory"
            className="bg-black text-white px-8 py-3 rounded-full font-medium"
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      {/* Success animation */}
      <div
        className={`transition-all duration-700 ${
          animationDone ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">✅</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
        Order Placed Successfully!
      </h1>
      <p className="text-gray-500 text-center mb-8">
        {isWallet
          ? "Paid via Store Wallet"
          : isSplit
          ? "Paid via Razorpay + Wallet"
          : "Paid via Razorpay"}
      </p>

      {/* Order details card */}
      <div className="w-full max-w-md bg-gray-50 rounded-2xl p-6 mb-8">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
          <span className="text-gray-500 text-sm">Order ID</span>
          <span className="font-mono font-bold">#{order.id}</span>
        </div>

        {/* Items */}
        {order.cartItems?.slice(0, 3).map((item: any, i: number) => (
          <div key={i} className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-700">
              {item.productName || item.name}
              {item.size ? ` (${item.size})` : ""}
            </span>
            <span className="text-sm font-medium">
              ₹{item.price?.toLocaleString("en-IN")}
            </span>
          </div>
        ))}

        {order.cartItems && order.cartItems.length > 3 && (
          <p className="text-xs text-gray-400 mt-1 mb-2">
            +{order.cartItems.length - 3} more items
          </p>
        )}

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <span className="font-medium">Total Paid</span>
          <span className="font-bold text-lg">
            ₹{order.total?.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Delivery estimate */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
          <span className="text-lg">🚚</span>
          <span className="text-sm text-gray-600">
            Estimated delivery in 3-5 business days
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-md space-y-3">
        <Link
          href="/orderhistory"
          className="w-full flex items-center justify-center bg-black text-white py-4 rounded-2xl font-medium hover:bg-gray-800 transition-colors"
        >
          View My Orders
        </Link>
        <Link
          href="/shopallshirts"
          className="w-full flex items-center justify-center border border-gray-300 text-gray-700 py-4 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>

      {/* Auto redirect countdown */}
      <p className="text-xs text-gray-400 mt-6">
        Redirecting to orders in {countdown}s...
      </p>

      {/* Email confirmation note */}
      <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">
        A confirmation email has been sent to your registered email address
      </p>
    </div>
  );
}
