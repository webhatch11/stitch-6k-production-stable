"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Order } from "@/lib/registry";
import { motion } from "framer-motion";

const timelineStatuses = ["Pending", "Processing", "Shipped", "Delivered"];

export default function OrderTrackingPage() {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    // Auto-load last order from local storage if available
    const localHistory = localStorage.getItem("orders_history");
    if (localHistory) {
      try {
        const parsed = JSON.parse(localHistory);
        if (parsed.length > 0) {
          setTrackedOrder(parsed[0]);
          setOrderIdInput(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse local orders", e);
      }
    }
  }, []);

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdInput.trim()) return;

    setLoading(true);
    setError("");
    setTrackedOrder(null);

    try {
      const orders = await db.getOrders();
      const found = orders.find((o) => o.id === orderIdInput.trim());
      if (found) {
        setTrackedOrder(found);
      } else {
        setError("Order not found. Please verify the ID and try again.");
      }
    } catch (err) {
      setError("Failed to fetch order details.");
    } finally {
      setLoading(false);
    }
  };

  if (!isHydrated) return null;

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col pt-24">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-1.5 shadow-sm">
              <img src="/assets/logo.png" alt="6K Logo" className="w-full h-full object-contain" />
            </div>
          </Link>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">
            Order Tracking Portal
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto w-full px-6 py-12 md:py-24">
        <div className="text-center space-y-4 mb-16 animate-fade-in">
          <span className="text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Client Services</span>
          <h1 className="text-3xl md:text-5xl font-headline font-black uppercase tracking-tight text-on-surface">
            Track Your Order
          </h1>
          <p className="text-xs uppercase tracking-widest text-outline/80 max-w-lg mx-auto">
            Enter your order ID below to view the real-time status of your bespoke garment.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleTrackOrder} className="max-w-md mx-auto mb-16 relative">
          <div className="flex bg-white/30 backdrop-blur-md rounded-xl p-2 border border-outline-variant/20 shadow-sm focus-within:border-secondary transition-all">
            <input
              type="text"
              placeholder="ENTER ORDER ID (e.g. ORD-1234)"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              className="flex-grow bg-transparent border-none outline-none px-4 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder-on-surface/40"
            />
            <button
              type="submit"
              disabled={loading || !orderIdInput.trim()}
              className="bg-on-surface text-surface px-6 py-3 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Locating..." : "Track"}
            </button>
          </div>
          {error && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mt-4 text-center absolute -bottom-8 left-0 right-0">
              {error}
            </p>
          )}
        </form>

        {/* Timeline Visualization */}
        {trackedOrder && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/40 border border-white/20 backdrop-blur-xl p-8 md:p-12 rounded-[2rem] shadow-[0_8px_32px_rgba(119,90,25,0.03)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-9xl">local_shipping</span>
            </div>

            <div className="relative z-10 mb-12">
              <h2 className="text-xl font-headline font-black uppercase tracking-tight text-on-surface mb-2">
                Order #{trackedOrder.id}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                Placed on: {trackedOrder.date}
              </p>
            </div>

            {/* Timeline Graphic */}
            <div className="relative mb-12">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-outline-variant/30 -translate-y-1/2 rounded-full hidden md:block"></div>
              <div className="flex flex-col md:flex-row justify-between relative z-10 gap-8 md:gap-0">
                {timelineStatuses.map((status, index) => {
                  const currentIdx = timelineStatuses.indexOf(
                    ["Pending", "Processing", "Shipped", "Delivered"].includes(trackedOrder.status)
                      ? trackedOrder.status
                      : "Pending" // Fallback if custom status like 'Returned'
                  );
                  const isCompleted = index <= currentIdx;
                  const isCurrent = index === currentIdx;

                  return (
                    <div key={status} className="flex md:flex-col items-center gap-4 md:gap-3 group relative">
                      <div
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
                          isCompleted
                            ? "border-[#fed488] bg-on-surface text-[#fed488] shadow-lg scale-110"
                            : "border-outline-variant/30 bg-surface text-outline/40"
                        }`}
                      >
                        {isCompleted ? (
                          <span className="material-symbols-outlined text-sm md:text-base font-black">check</span>
                        ) : (
                          <span className="text-[10px] md:text-xs font-black">{index + 1}</span>
                        )}
                      </div>
                      
                      {/* Mobile connector line */}
                      {index < timelineStatuses.length - 1 && (
                        <div className="absolute top-10 left-5 w-1 h-full bg-outline-variant/30 -z-10 md:hidden"></div>
                      )}

                      <div className="md:text-center">
                        <p
                          className={`text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors ${
                            isCurrent ? "text-[#775a19]" : isCompleted ? "text-on-surface" : "text-outline/60"
                          }`}
                        >
                          {status}
                        </p>
                        {isCurrent && (
                          <p className="text-[8px] uppercase tracking-widest text-secondary mt-1 hidden md:block">
                            Current Status
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Details Summary */}
            <div className="border-t border-outline-variant/20 pt-8 mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div>
                <h3 className="text-[10px] font-black tracking-widest uppercase text-secondary mb-4">Destination</h3>
                <p className="text-[10px] uppercase tracking-wide font-bold text-on-surface">
                  {trackedOrder.customer}
                </p>
              </div>
              <div>
                <h3 className="text-[10px] font-black tracking-widest uppercase text-secondary mb-4">Summary</h3>
                <p className="text-[10px] uppercase tracking-wide font-bold text-on-surface">
                  {trackedOrder.items?.length || 0} Items • ₹ {trackedOrder.total.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
