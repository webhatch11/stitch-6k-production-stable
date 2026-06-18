"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary mt-auto">
      <div className="max-w-7xl mx-auto">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 text-secondary">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="h-8 w-auto object-contain"
                  draggable={false}
                />
              </div>
              <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">Stitch 6K</span>
            </div>
            <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
              Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
            </p>
            <Link
              href="/admindashboard"
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300"
            >
              <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              Admin Portal
            </Link>
          </div>

          <div className="lg:text-right flex flex-col lg:items-end justify-center">
            <h4 className="text-lg font-headline font-black uppercase tracking-tight mb-2 text-white">
              Join the Atelier
            </h4>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-4">
              Early access to limited runs and private sales.
            </p>
            <div className="flex w-full lg:max-w-md border-b border-white/20 pb-2 focus-within:border-secondary transition-colors">
              <input
                type="email"
                placeholder="ENTER YOUR EMAIL"
                className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-white/30 px-2"
              />
              <button className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors px-2 bg-transparent border-none cursor-pointer">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Links Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">
          <div className="col-span-1 md:col-span-2">
            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
            <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4">
              <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
              <span>
                The Stitch 6K Workshop
                <br />
                Tiruppur Textile District
                <br />
                Tamil Nadu, India 641604
                <br />
                <span className="text-[8px] text-white/40 mt-1 block">Global Distribution Center</span>
              </span>
            </p>
          </div>
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Client Services</h4>
            <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70 list-none p-0">
              <li>
                <Link href="/shipping-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                  Global Shipping
                </Link>
              </li>
              <li>
                <Link href="/return-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                  Returns & Exchanges
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                  Size Guide
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                  Contact Concierge
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Legal & Policy</h4>
            <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70 list-none p-0">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-white transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/cancellation-policy" className="hover:text-white transition-colors">
                  Cancellation Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-between items-center gap-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">
            © 2026 STITCH 6K • HANDCRAFTED IN TAMIL NADU, INDIA
          </p>
        </div>
      </div>
    </footer>
  );
}
