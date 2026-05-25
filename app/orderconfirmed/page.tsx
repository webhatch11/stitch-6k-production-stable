"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order } from "@/lib/registry";
import { db } from "@/lib/db";

export default function OrderConfirmedPage() {
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadLastOrder() {
      const orders = await db.getOrders();
      if (orders.length > 0) {
        setLastOrder(orders[0]); // Fetch the most recently placed order
      }
    }
    loadLastOrder();
  }, []);

  const orderId = lastOrder ? lastOrder.id : "ORD-4022";
  const customer = lastOrder ? lastOrder.customer : "Valued Client";
  const total = lastOrder ? lastOrder.total : 14500;
  const items = lastOrder ? lastOrder.items : ["Signature Linen Shirt"];

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col">
      {/* Top Announcement Scrolling Marquee */}
      <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] relative z-[60]">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
        </div>
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="size-6 text-on-surface group-hover:text-secondary transition-colors">
                <svg fill="none" viewBox="0 0 48 48">
                  <path
                    d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h2 className="text-on-surface font-headline text-xl font-extrabold tracking-tighter">6K</h2>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">Home</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/shopallshirts">Shop All</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/orderhistory">Order History</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/ordertracking">Track Order</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors">shopping_bag</Link>
            <Link href="/myprofile" className="material-symbols-outlined text-outline hover:text-primary transition-colors">person</Link>
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">admin_panel_settings</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="material-symbols-outlined md:hidden">menu</button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="flex flex-col mt-4 space-y-4 md:hidden">
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/">Home</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">Shop All</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/orderhistory">Order History</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">Track Order</Link>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-16 lg:py-32 flex-grow w-full">
        {/* Hero Section */}
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary mb-8 block">Order Confirmation</span>
          <h1 className="font-headline text-5xl lg:text-7xl font-black tracking-tighter text-on-surface uppercase leading-none mb-6">
            Order<br />
            <span className="opacity-30">Confirmed.</span>
          </h1>
          <div className="h-px bg-gradient-to-r from-transparent via-[#d1c5b4] to-transparent w-32 mx-auto mb-8"></div>
          <p className="text-xs font-bold text-outline uppercase tracking-[0.2em] leading-relaxed">
            Your order has been recorded in our system. <br />
            Reference: <span className="text-on-surface font-mono font-bold">#{orderId}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* Left Column: Timeline */}
          <div className="lg:col-span-7 space-y-16">
            <section>
              <h3 className="font-headline text-xs font-black uppercase tracking-[0.3em] mb-12 border-l-2 border-secondary pl-6">Order Timeline</h3>
              <div className="space-y-12">
                <div className="flex gap-8">
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest pt-1 flex-shrink-0 w-24">Immediate</span>
                  <div>
                    <h4 className="font-headline font-black text-lg uppercase tracking-tight">Workshop Preparation</h4>
                    <p className="text-sm text-outline mt-2 leading-relaxed font-medium">Your shirt is undergoing final inspection and preparation for packaging.</p>
                  </div>
                </div>
                <div className="flex gap-8 opacity-50">
                  <span className="text-[10px] font-black text-outline uppercase tracking-widest pt-1 flex-shrink-0 w-24">12-24 Hours</span>
                  <div>
                    <h4 className="font-headline font-black text-lg uppercase tracking-tight">Quality Inspection</h4>
                    <p className="text-sm text-outline mt-2 leading-relaxed font-medium">A certificate of premium quality is prepared and enclosed in your package.</p>
                  </div>
                </div>
                <div className="flex gap-8 opacity-50">
                  <span className="text-[10px] font-black text-outline uppercase tracking-widest pt-1 flex-shrink-0 w-24">48 Hours</span>
                  <div>
                    <h4 className="font-headline font-black text-lg uppercase tracking-tight">Express Dispatch</h4>
                    <p className="text-sm text-outline mt-2 leading-relaxed font-medium">Handover to Shiprocket Premium for insured shipping to your address.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Order summary details */}
          <div className="lg:col-span-5 space-y-12">
            <div className="bg-surface p-10 border border-outline-variant/20 shadow-[-20px_20px_60px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-outline-variant/10">
                <h3 className="font-headline text-[10px] font-black uppercase tracking-[0.4em]">Order Details</h3>
                <span className="text-[8px] font-black bg-on-surface text-surface px-2 py-1 uppercase tracking-widest">Secure Order</span>
              </div>

              {items.map((itemName, index) => (
                <div key={index} className="flex gap-8 items-start mb-10">
                  <div className="w-24 h-32 bg-surface-container overflow-hidden flex-shrink-0 grayscale">
                    <img
                      src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"
                      className="w-full h-full object-cover"
                      alt={itemName}
                    />
                  </div>
                  <div>
                    <h4 className="font-headline font-black text-xl uppercase tracking-tighter">{itemName}</h4>
                    <p className="text-[9px] font-black uppercase tracking-widest text-outline mt-1 font-bold">Atelier Selection • XL</p>
                    <p className="font-headline font-black text-xl mt-6 text-on-surface">
                      ₹ {(total / items.length).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              ))}

              <div className="space-y-4 py-8 border-t border-outline-variant/10">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-outline">Order Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-secondary">
                  <span>Premium Shipping</span>
                  <span>Included</span>
                </div>
              </div>

              <div className="pt-10 flex flex-col gap-4">
                <Link
                  href={`/ordertracking?orderId=${orderId}`}
                  className="bg-on-surface text-surface text-center py-5 text-[10px] font-black uppercase tracking-[0.3em] hover:opacity-90 transition-opacity"
                >
                  Track Order
                </Link>
                <Link
                  href={`/invoice?orderId=${orderId}`}
                  className="bg-[#775a19] text-white text-center py-5 text-[10px] font-black uppercase tracking-[0.3em] hover:opacity-90 transition-opacity"
                >
                  Download Invoice
                </Link>
                <Link
                  href="/orderhistory"
                  className="border border-outline-variant text-center py-5 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-surface-container-low transition-colors"
                >
                  Order History
                </Link>
              </div>
            </div>

            <div className="p-8 border border-secondary/10 bg-surface-container-low text-center">
              <p className="text-[10px] font-bold text-outline leading-relaxed uppercase tracking-wider">
                An order confirmation message has been sent to your email. Please retain this reference for tracking your delivery.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="size-8 text-secondary">
                  <svg fill="currentColor" viewBox="0 0 48 48">
                    <path d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z" />
                  </svg>
                </div>
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K Shirts</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">© 2026 6K Shirts. Crafted in Tamil Nadu.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
