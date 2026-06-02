"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
              <div className="w-11 h-11 rounded-full bg-white p-1.5 flex items-center justify-center shadow-md border border-[#775a19]/15">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">Home</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/genz">GEN-Z</Link>
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
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/genz">GEN-Z</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">Shop All</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/orderhistory">Order History</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">Track Order</Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">GET IN TOUCH</span>
        <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
          Contact Concierge
        </h1>
        <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">Atelier Concierge</h3>
            <p>
              Email: support@stitch6k.com
              <br />
              Concierge Line: +91 6000 6000 (Available 24/7)
            </p>
          </section>
          <section className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h3 className="text-on-surface font-black text-lg mb-4">Workshop Location</h3>
            <p>
              The Stitch 6K Workshop
              <br />
              Tiruppur Textile District
              <br />
              Tamil Nadu, India 641604
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
