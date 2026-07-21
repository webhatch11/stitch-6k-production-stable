"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface BusinessData {
  phone?: string;
  email?: string;
  address?: string;
  gst_no?: string;
  instagram?: string;
  facebook?: string;
}

interface FooterProps {
  business?: BusinessData;
}

export default function Footer({ business }: FooterProps) {
  const [clientServicesOpen, setClientServicesOpen] = useState(false);
  const [legalPolicyOpen, setLegalPolicyOpen] = useState(false);

  const phone = business?.phone?.trim() || "";
  const email = business?.email?.trim() || "";
  const address = business?.address?.trim() || "";
  const gst_no = business?.gst_no?.trim() || "";
  const instagram = business?.instagram?.trim() || "";
  const facebook = business?.facebook?.trim() || "";

  return (
    <footer className="pt-12 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary mt-auto">
      <div className="max-w-7xl mx-auto">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 text-secondary">
                <Image
                  src="/assets/logo.png"
                  alt="6K Logo"
                  width={32}
                  height={32}
                  className="h-8 w-auto object-contain"
                  draggable={false}
                />
              </div>
              <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K</span>
            </div>
            <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
              Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
            </p>
            <Link
              href="/admindashboard/login"
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
              Follow us on Instagram for updates
            </p>
            {(instagram || facebook) && (
              <div className="flex items-center gap-4 mt-2">
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-secondary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-secondary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Links Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">

          {/* Our Atelier — address + contact + legal */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
            <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4 mb-5">
              <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
              <span>
                {address || "JRT TEXTILES (6K Brand), 1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar, Tiruchirappalli – 620018, Tamil Nadu"}
                <br />
                <span className="text-[8px] text-white/40 mt-1 block">Global Distribution Center</span>
              </span>
            </p>

            {/* Contact block — only shows if values set */}
            {(phone || email) && (
              <div className="flex flex-col gap-2 mb-4 ml-8">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    id="footer-phone-link"
                    className="flex items-center gap-2 text-[10px] font-light uppercase tracking-widest text-white/70 hover:text-secondary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm text-secondary">call</span>
                    {phone}
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    id="footer-email-link"
                    className="flex items-center gap-2 text-[10px] font-light uppercase tracking-widest text-white/70 hover:text-secondary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm text-secondary">mail</span>
                    {email}
                  </a>
                )}
              </div>
            )}

            {/* GST / Legal ID */}
            {gst_no && (
              <p id="footer-gst" className="text-[9px] font-bold tracking-widest text-white/40 ml-8 uppercase">
                GSTIN: {gst_no}
              </p>
            )}

            {/* Social Links — hidden on mobile to avoid duplication */}
            {(instagram || facebook) && (
              <div className="hidden md:flex items-center gap-4 mt-5 ml-8">
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="footer-instagram-link"
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-secondary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="footer-facebook-link"
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-secondary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Client Services */}
          <div>
            <button
              onClick={() => setClientServicesOpen(!clientServicesOpen)}
              className="w-full flex items-center justify-between py-3 md:py-0 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 border-b border-white/5 md:border-b-0 text-left md:pointer-events-none focus:outline-none bg-transparent border-none cursor-pointer"
            >
              <span>Client Services</span>
              <span 
                className="material-symbols-outlined text-sm md:hidden transition-transform duration-300"
                style={{ transform: clientServicesOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                keyboard_arrow_down
              </span>
            </button>
            <ul className={`${clientServicesOpen ? "block animate-fadeIn" : "hidden"} md:block mt-4 md:mt-0 space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70 list-none p-0`}>
              <li>
                <Link href="/shipping-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                  Global Shipping
                </Link>
              </li>
              <li>
                <Link href="/return-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                  Returns &amp; Exchanges
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

          {/* Legal & Policy */}
          <div>
            <button
              onClick={() => setLegalPolicyOpen(!legalPolicyOpen)}
              className="w-full flex items-center justify-between py-3 md:py-0 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 border-b border-white/5 md:border-b-0 text-left md:pointer-events-none focus:outline-none bg-transparent border-none cursor-pointer"
            >
              <span>Legal &amp; Policy</span>
              <span 
                className="material-symbols-outlined text-sm md:hidden transition-transform duration-300"
                style={{ transform: legalPolicyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                keyboard_arrow_down
              </span>
            </button>
            <ul className={`${legalPolicyOpen ? "block animate-fadeIn" : "hidden"} md:block mt-4 md:mt-0 space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70 list-none p-0`}>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="hover:text-white transition-colors">
                  Shipping &amp; Delivery Policy
                </Link>
              </li>
              <li>
                <Link href="/payment-policy" className="hover:text-white transition-colors">
                  Payment Policy
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
              <li>
                <Link href="/return-policy" className="hover:text-white transition-colors">
                  Return &amp; Exchange Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">
            © 2026 6K • HANDCRAFTED IN TAMIL NADU, INDIA
          </p>
          {gst_no && (
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
              GSTIN: {gst_no}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
