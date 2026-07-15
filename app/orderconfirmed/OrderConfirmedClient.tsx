import { createBrowserClient } from "@supabase/ssr";
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Order } from "@/lib/types";
import { trackPurchase } from "@/lib/analytics";
import AnnouncementMarquee from "@/components/layout/AnnouncementMarquee";

interface OrderConfirmedClientProps {
  lastOrder: Order | null;
  marquee?: any;
}

export default function OrderConfirmedClient({ lastOrder, marquee }: OrderConfirmedClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);

  const supabase = React.useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ), []);

  React.useEffect(() => {
    const checkAuth = async () => {
      if (!lastOrder) {
        setAuthChecked(true);
        return;
      }
      const orderUserId = lastOrder.userId || lastOrder.user_id;
      if (!orderUserId) {
        setAuthChecked(true);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== orderUserId) {
        setIsAuthorized(false);
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, [lastOrder, supabase]);

  if (!lastOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface font-body">
        <div className="text-center p-6">
          <h2 className="text-xl font-black uppercase mb-4 tracking-wider">Order not found</h2>
          <p className="text-xs text-outline uppercase tracking-wider mb-6 leading-relaxed max-w-sm mx-auto">
            Your payment was successful. Check your email for confirmation or view your order history.
          </p>
          <Link href="/orderhistory" className="inline-flex items-center justify-center bg-on-surface text-surface hover:bg-secondary hover:text-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-on-surface/10">
            View Order History
          </Link>
        </div>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface font-body">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">Verifying Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface font-body">
        <div className="text-center p-6">
          <h2 className="text-xl font-black uppercase mb-4 tracking-wider">Order not found</h2>
          <p className="text-xs text-outline uppercase tracking-wider mb-6 leading-relaxed max-w-sm mx-auto">
            Please check your order history or contact support.
          </p>
          <Link href="/orderhistory" className="inline-flex items-center justify-center bg-on-surface text-surface hover:bg-secondary hover:text-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-on-surface/10">
            View Order History
          </Link>
        </div>
      </div>
    );
  }

  // Ensure type checker knows lastOrder is defined past this point

  React.useEffect(() => {
    if (lastOrder) {
      const itemsMapped = lastOrder.cartItems || (lastOrder.items || []).map((name) => ({
        productId: lastOrder.id,
        productName: name,
        price: lastOrder.total,
        quantity: 1
      }));
      trackPurchase({
        orderId: lastOrder.id,
        total: lastOrder.total,
        items: itemsMapped,
        couponCode: lastOrder.couponCode
      });
    }
  }, [lastOrder]);

  const orderId = lastOrder ? lastOrder.id : "STK-2026-000001";
  const customer = lastOrder ? lastOrder.customer : "Valued Client";
  const total = lastOrder ? lastOrder.total : 14500;
  const items = lastOrder ? lastOrder.items : ["Your Order"];
  const subtotal = lastOrder ? (lastOrder.originalTotal !== undefined ? lastOrder.originalTotal : lastOrder.total) : 14500;
  const discount = lastOrder ? ((lastOrder.couponDiscount || 0) + (lastOrder.pointsDiscount || 0)) : 0;
  const shipping = lastOrder ? (lastOrder.shippingAmount || (lastOrder as any).shipping_amount || 0) : 0;

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col">
      {/* Top Announcement Scrolling Marquee */}
      <AnnouncementMarquee marquee={marquee} />

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
              <div className="w-11 h-11 rounded-full bg-white p-1.5 flex items-center justify-center shadow-md border border-[#775a19]/15">
                <Image 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  width={44}
                  height={44}
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
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">admin_panel_settings</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="material-symbols-outlined md:hidden bg-transparent border-none">menu</button>
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
                    <p className="text-xs text-outline leading-relaxed font-medium mt-1">Materials selection and design layouts matching details for #{orderId}.</p>
                  </div>
                </div>
                <div className="flex gap-8">
                  <span className="text-[10px] font-black text-outline/50 uppercase tracking-widest pt-1 flex-shrink-0 w-24">12-24 Hours</span>
                  <div>
                    <h4 className="font-headline font-black text-lg uppercase tracking-tight">Handloom Tailoring</h4>
                    <p className="text-xs text-outline leading-relaxed font-medium mt-1">Atelier master tailors begin weaving work. Finishes handloom seams and sets custom embroidery accents.</p>
                  </div>
                </div>
                <div className="flex gap-8">
                  <span className="text-[10px] font-black text-outline/50 uppercase tracking-widest pt-1 flex-shrink-0 w-24">2-3 Business Days</span>
                  <div>
                    <h4 className="font-headline font-black text-lg uppercase tracking-tight">Logistics Despatch</h4>
                    <p className="text-xs text-outline leading-relaxed font-medium mt-1">Order packaged securely in luxury design box. Assigned to Shiprocket express delivery partner.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Invoice Details */}
          <div className="lg:col-span-5 bg-white border border-outline-variant/10 p-8 shadow-sm">
            <h3 className="font-headline text-xs font-black uppercase tracking-[0.3em] mb-8">Summary Receipt</h3>
            <div className="space-y-6 text-xs font-bold uppercase tracking-wider text-outline">
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                <span>Client Name</span>
                <span className="text-on-surface font-extrabold">{customer}</span>
              </div>
              <div className="flex justify-between items-start border-b border-outline-variant/10 pb-4">
                <span>Products Ordered</span>
                <div className="text-right">
                  {items.map((item, idx) => (
                    <span key={idx} className="block text-on-surface font-extrabold">{item}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                <span>Shipment Status</span>
                <span className="text-secondary font-black">PREPARING ATELIER DISPATCH</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span>Subtotal</span>
                <span className="text-on-surface font-extrabold">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-green-700">
                  <span>Discount</span>
                  <span>-₹{discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>Shipping</span>
                <span className={shipping === 0 ? "text-green-700 font-extrabold" : "text-on-surface font-extrabold"}>
                  {shipping === 0 ? "FREE" : `₹${shipping.toLocaleString("en-IN")}`}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-outline-variant/10 pt-4">
                <span className="text-on-surface font-black">Valuation / Total</span>
                <span className="font-headline font-black text-2xl text-on-surface">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="mt-12 space-y-4">
              <Link
                href="/shopallshirts"
                className="w-full inline-flex items-center justify-center bg-transparent text-on-surface hover:bg-on-surface hover:text-white py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border border-on-surface"
              >
                Continue Shopping
              </Link>
              <Link
                href="/orderhistory"
                className="w-full inline-flex items-center justify-center bg-on-surface text-surface hover:bg-secondary hover:text-white py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border border-on-surface/10"
              >
                View My Orders
              </Link>
              <Link
                href={`/invoice?orderId=${orderId}`}
                className="w-full inline-flex items-center justify-center bg-transparent text-outline hover:text-on-surface py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border border-outline-variant/30 hover:border-on-surface/50"
              >
                Download Invoice (PDF)
              </Link>
              <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest text-center mt-4">
                ✓ Order confirmation sent to your email address.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/10 py-8 px-6 lg:px-20 bg-surface-container-lowest text-center">
        <p className="text-[9px] font-bold text-outline uppercase tracking-widest">
          © {new Date().getFullYear()} Stitch 6K Atelier. Handcrafted in South India. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
