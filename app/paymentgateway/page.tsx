"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";

interface CheckoutState {
  customer: string;
  originalTotal: number;
  couponDiscount: number;
  couponCode: string;
  netTotal: number;
  walletDeduction: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  finalPayable: number;
  items: string[];
}

export default function PaymentGatewayPage() {
  const router = useRouter();
  const [state, setState] = useState<CheckoutState | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal & Simulation States
  const [modalOpen, setModalOpen] = useState(false);
  const [rzpStatus, setRzpStatus] = useState("Verifying with Bank...");
  const [successState, setSuccessState] = useState(false);

  useEffect(() => {
    // Read state from sessionStorage
    const stateStr = sessionStorage.getItem("checkoutState");
    if (stateStr) {
      try {
        setState(JSON.parse(stateStr));
      } catch (e) {
        console.error("Failed to parse checkoutState", e);
      }
    } else {
      // Fallback fallback if directly visited
      setState({
        customer: "Guest Customer",
        originalTotal: 14500,
        couponDiscount: 0,
        couponCode: "",
        netTotal: 14500,
        walletDeduction: 0,
        pointsRedeemed: 0,
        pointsDiscount: 0,
        finalPayable: 14500,
        items: ["Signature Linen Shirt"],
      });
    }
  }, []);

  const simulatePayment = () => {
    if (!state) return;

    setModalOpen(true);
    setRzpStatus("Verifying with Bank...");
    setSuccessState(false);

    // Timeline simulations
    setTimeout(() => {
      setRzpStatus("Securing Transaction...");
      setTimeout(async () => {
        setRzpStatus("Payment Successful");
        setSuccessState(true);

        // SAVE ORDER to db
        const orderId = "ORD-" + Math.floor(Math.random() * 9000 + 1000);

        try {
          if (state.walletDeduction > 0) {
            await db.applyWalletDebit(state.walletDeduction, orderId);
          }
          if (state.pointsRedeemed > 0) {
            await db.applyLoyaltyDebit(state.pointsRedeemed, orderId);
          }

          // Earn loyalty points on net total spendings
          await db.awardLoyaltyPoints(state.netTotal, orderId);

          // Save formal order
          await db.saveOrder({
            id: orderId,
            customer: state.customer,
            date: new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            total: state.netTotal,
            originalTotal: state.originalTotal,
            couponDiscount: state.couponDiscount,
            couponCode: state.couponCode,
            walletPaid: state.walletDeduction,
            gatewayPaid: state.finalPayable,
            pointsRedeemed: state.pointsRedeemed,
            pointsDiscount: state.pointsDiscount,
            pointsEarned: Math.floor(state.netTotal / 10),
            status: "Paid",
            items: state.items,
          });
        } catch (err) {
          console.error("Failed to complete database transaction for payment:", err);
        }

        setTimeout(() => {
          router.push("/orderconfirmed");
        }, 1000);
      }, 1500);
    }, 1500);
  };

  if (!state) return null;

  const subtotal = state.netTotal / 1.12;
  const gst = state.netTotal - subtotal;

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col">
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

      {/* TopNavBar */}
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

      {/* Main Payment Section */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-16 flex-grow w-full">
        {/* Left Column: Payment selection */}
        <section className="lg:col-span-7 space-y-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="https://razorpay.com/favicon.png" className="size-6 object-contain" alt="Razorpay" />
              <h1 className="text-4xl font-headline font-extrabold tracking-tighter">Payment Selection</h1>
            </div>
            <p className="text-outline font-body">Powered by <span className="font-bold">Razorpay Standard Checkout</span>. Select your payment method below.</p>
          </div>

          <div className="bg-white border border-outline-variant/30 overflow-hidden rounded-none shadow-sm">
            <div className="bg-[#1d2745] p-6 flex justify-between items-center text-white">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Total Amount</p>
                <p className="text-2xl font-bold tracking-tight">₹{state.finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
              <img src="https://cdn.razorpay.com/static/assets/logo/pay_out_white.png" className="h-5" alt="Razorpay" />
            </div>

            <div className="p-4 space-y-2">
              <button
                onClick={simulatePayment}
                className="w-full text-left p-5 hover:bg-surface-container-low transition-colors flex items-center justify-between border border-transparent hover:border-outline-variant/30 rounded-none bg-transparent"
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[#3395FF]">qr_code_2</span>
                  <span className="font-bold text-sm">UPI / QR</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button
                onClick={simulatePayment}
                className="w-full text-left p-5 hover:bg-surface-container-low transition-colors flex items-center justify-between border border-transparent hover:border-outline-variant/30 rounded-none bg-transparent"
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[#3395FF]">credit_card</span>
                  <span className="font-bold text-sm">Card (Visa, Master, Amex, RuPay)</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button
                onClick={simulatePayment}
                className="w-full text-left p-5 hover:bg-surface-container-low transition-colors flex items-center justify-between border border-transparent hover:border-outline-variant/30 rounded-none bg-transparent"
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[#3395FF]">account_balance</span>
                  <span className="font-bold text-sm">Netbanking</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button
                onClick={simulatePayment}
                className="w-full text-left p-5 hover:bg-surface-container-low transition-colors flex items-center justify-between border border-transparent hover:border-outline-variant/30 rounded-none bg-transparent"
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[#3395FF]">wallet</span>
                  <span className="font-bold text-sm">Wallets</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-8 grayscale opacity-40">
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl">verified_user</span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-center">PCI-DSS Compliant</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl">security</span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-center">SSL Secure</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl">shield_with_heart</span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-center">Razorpay Partner</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl">workspace_premium</span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-center">100% Authentic</span>
            </div>
          </div>
        </section>

        {/* Right Column: Order Summary (Sticky) */}
        <aside className="lg:col-span-5">
          <div className="sticky top-32 space-y-8">
            <div className="bg-surface-container-low p-8 border border-outline-variant/10">
              <h2 className="text-xl font-headline font-extrabold tracking-tighter mb-8 pb-4 border-b border-outline-variant/30 uppercase">Order Summary</h2>
              
              <div className="space-y-6 mb-8">
                {state.items.map((itemName, index) => (
                  <div key={index} className="flex gap-6">
                    <div className="w-24 h-32 bg-white overflow-hidden flex-shrink-0">
                      <img
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                        src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"
                        alt={itemName}
                      />
                    </div>
                    <div className="flex-grow flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-headline font-bold uppercase text-sm tracking-wide">{itemName}</h4>
                        <p className="text-[10px] uppercase tracking-widest text-outline/60 mt-1">Size: XL | Color: Atelier Choice</p>
                      </div>
                      <span className="font-headline font-bold text-sm text-secondary">
                        ₹ {(state.netTotal / state.items.length).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 border-t border-outline-variant/30 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-outline font-label uppercase tracking-widest">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {state.pointsDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-bold">
                    <span className="font-label uppercase tracking-widest">Loyalty Discount</span>
                    <span className="font-medium">- ₹{state.pointsDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {state.walletDeduction > 0 && (
                  <div className="flex justify-between text-sm text-green-700 font-bold">
                    <span className="font-label uppercase tracking-widest">Wallet Paid</span>
                    <span className="font-medium">- ₹{state.walletDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-outline font-label uppercase tracking-widest">GST (12%)</span>
                  <span className="font-medium">₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-outline font-label uppercase tracking-widest">Shipping</span>
                  <span className="text-tertiary font-bold">FREE</span>
                </div>
                <div className="flex justify-between text-xl font-headline font-black pt-4 border-t border-on-surface/5">
                  <span className="tracking-tighter">TOTAL</span>
                  <span className="text-secondary font-headline">₹{state.finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <button
                onClick={simulatePayment}
                className="w-full mt-10 bg-[#3395FF] hover:bg-[#2484e6] text-white py-6 rounded-none font-headline font-extrabold text-lg uppercase tracking-wider flex items-center justify-center gap-4 transition-all"
              >
                Proceed to Pay
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>

              <p className="text-center text-[10px] text-outline mt-6 uppercase tracking-widest font-bold">
                Encrypted &amp; Powered by <span className="text-on-surface">Razorpay</span>
              </p>
            </div>

            <div className="p-8 border border-outline-variant/10 space-y-4">
              <div className="flex gap-4 items-start">
                <span className="material-symbols-outlined text-secondary">support_agent</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Need Assistance?</p>
                  <p className="text-[11px] text-outline font-body mt-1">Our concierge is available 24/7 for bespoke support. Reach us at +91 6000 6000.</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Razorpay Simulation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[400px] border-t-4 border-t-[#3395FF] overflow-hidden shadow-2xl rounded-none">
            <div className="bg-[#3395FF] p-6 text-white text-center">
              <img src="https://cdn.razorpay.com/static/assets/logo/pay_out_white.png" className="h-6 mx-auto mb-4" alt="Razorpay" />
              <h3 className="text-lg font-bold">Secure Verification</h3>
              <p className="text-xs opacity-70">Processing via Razorpay Gateway</p>
            </div>
            <div className="p-10 flex flex-col items-center gap-6">
              {!successState ? (
                <div className="animate-spin size-12 border-4 border-[#3395FF] border-t-transparent rounded-full"></div>
              ) : (
                <span className="material-symbols-outlined text-green-600 text-5xl">check_circle</span>
              )}
              <p className={`text-sm font-bold uppercase tracking-widest ${successState ? "text-green-600 animate-pulse" : "text-on-surface"}`}>
                {rzpStatus}
              </p>
            </div>
            <div className="bg-surface-container-low p-4 flex items-center justify-center gap-4 grayscale opacity-40">
              <span className="text-[9px] font-bold">PCI-DSS</span>
              <span className="text-[9px] font-bold">SSL SECURE</span>
              <span className="text-[9px] font-bold">256-BIT</span>
            </div>
          </div>
        </div>
      )}

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
