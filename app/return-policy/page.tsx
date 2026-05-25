"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ReturnPolicyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col">
      {/* Header */}
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

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ATELIER GUIDANCE</span>
        <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
          Returns &amp; Refund Policy
        </h1>
        <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">1. Eligibility Threshold</h3>
            <p>
              We offer a strict 7-day return policy starting from the date of package delivery. Product tags must remain attached, and items must be clean and unworn.
            </p>
          </section>
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">2. Return Registration</h3>
            <p>
              Clients can request returns directly from their Order History interface by uploading a photo of the unworn product. Once registered, Shiprocket reverse logistics will coordinate pickup.
            </p>
          </section>
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">3. Refund Processing</h3>
            <p>
              Upon arrival at the workshop and passing quality inspections:
              <br />- Refund to Store Wallet is processed instantly.
              <br />- Refund to Bank Account takes 3-5 business days.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">© 2026 6K Shirts. Crafted in Tamil Nadu.</p>
        </div>
      </footer>
    </div>
  );
}
