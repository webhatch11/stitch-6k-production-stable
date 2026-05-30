"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function PrivacyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
              <img 
                src="/assets/logo.png" 
                alt="6K Logo" 
                className="h-10 w-auto object-contain" 
                draggable={false}
              />
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
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">DATA SAFEGUARDS</span>
        <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
          Privacy Policy
        </h1>
        <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">1. Data Collected</h3>
            <p>
              We gather client details purely to execute transaction dispatches and process delivery locations. No details are shared with external entities beyond payment and shipping APIs (Razorpay, Shiprocket).
            </p>
          </section>
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">2. Secure Payment Gateway</h3>
            <p>
              Credit credentials and billing histories are processed securely by Razorpay standard gateways. No payment tokens are recorded on our local database endpoints.
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
