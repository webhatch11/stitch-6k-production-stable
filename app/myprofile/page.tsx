"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order, WalletTransaction, LoyaltyTransaction } from "@/lib/registry";
import { db } from "@/lib/db";

export default function MyProfilePage() {
  const [activeTab, setActiveTab] = useState<"profile" | "loyalty">("profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Financial States
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTransaction[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    // Load URL hashes if deep-linked to #loyalty
    if (typeof window !== "undefined" && window.location.hash === "#loyalty") {
      setActiveTab("loyalty");
    }

    loadProfileData();

    // Cross-tab sync listener
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "registry_wallet_balance" ||
        e.key === "registry_loyalty_points" ||
        e.key === "registry_orders"
      ) {
        loadProfileData();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loadProfileData = async () => {
    const balance = await db.getWalletBalance();
    const wTxs = await db.getWalletTransactions();
    const points = await db.getLoyaltyPoints();
    const lTxs = await db.getLoyaltyTransactions();
    const orders = await db.getOrders();

    setWalletBalance(balance);
    setWalletTxs(wTxs);
    setLoyaltyPoints(points);
    setLoyaltyTxs(lTxs);
    setRecentOrders(orders.slice(0, 3));
  };

  const handleTabSwitch = (tabName: "profile" | "loyalty") => {
    setActiveTab(tabName);
    setSidebarOpen(false);
  };

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
        </div>
      </div>

      {/* Top Header */}
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
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/shopallshirts">Shop All</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/orderhistory">Order History</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/ordertracking">Track Order</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors">shopping_bag</Link>
            <Link href="/myprofile" className="material-symbols-outlined text-primary font-bold">person</Link>
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

      {/* Main Profile Layout */}
      <div className="layout-container flex h-full grow flex-col max-w-7xl mx-auto w-full flex-grow">
        <div className="flex grow flex-col lg:flex-row min-h-[60vh] w-full">
          {/* Side navigation bar */}
          <aside
            className={`fixed top-0 left-0 h-full w-72 bg-white z-50 transform -translate-x-full transition-transform duration-300 lg:translate-x-0 lg:static lg:flex flex-col border-r border-[#eee] p-6 shrink-0 ${
              sidebarOpen ? "translate-x-0" : ""
            }`}
          >
            {/* Mobile close button */}
            <div className="flex justify-end mb-4 lg:hidden">
              <button onClick={() => setSidebarOpen(false)} className="p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Profile Avatar */}
            <div className="flex gap-4 items-center mb-6">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-none bg-cover bg-center border border-secondary"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200')",
                }}
              ></div>
              <div>
                <h3 className="font-bold uppercase text-sm sm:text-base">Aditya R.</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Platinum Tier</p>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col gap-1 sm:gap-2 text-xs uppercase tracking-widest font-black">
              <button
                onClick={() => handleTabSwitch("profile")}
                className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-left rounded-none ${
                  activeTab === "profile" ? "bg-black text-white" : "hover:bg-gray-100 bg-transparent text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">person</span>
                Profile Overview
              </button>

              <button
                onClick={() => handleTabSwitch("loyalty")}
                className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-left rounded-none ${
                  activeTab === "loyalty" ? "bg-black text-white" : "hover:bg-gray-100 bg-transparent text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">wallet</span>
                Loyalty & Wallet
              </button>

              <Link
                className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-100 text-on-surface"
                href="/orderhistory"
              >
                <span className="material-symbols-outlined text-[20px]">history</span>
                Order History
              </Link>
            </nav>
          </aside>

          {/* Background Overlay (mobile navigation) */}
          {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden"></div>}

          {/* Dynamic Content Panels */}
          <div className="flex-1 bg-surface overflow-y-auto p-6 sm:p-10">
            {/* Mobile Sidebar Toggle Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden mb-6 flex items-center gap-2 border border-outline-variant/30 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white"
            >
              <span className="material-symbols-outlined text-sm">menu_open</span> Profile Menu
            </button>

            {/* TAB 1: PROFILE OVERVIEW */}
            {activeTab === "profile" && (
              <div className="flex flex-col gap-12 animate-fade-in">
                <div className="flex flex-col gap-2 border-l-4 border-secondary pl-6">
                  <p className="text-secondary text-xs font-bold tracking-[0.3em] uppercase">Welcome Back</p>
                  <h1 className="text-on-surface text-5xl font-headline font-extrabold tracking-tighter">THE HERITAGE SUITE</h1>
                </div>

                {/* Personal Information */}
                <section className="bg-white border border-outline-variant/20 p-8 flex flex-col gap-6">
                  <div className="flex justify-between items-start">
                    <h4 className="text-on-surface font-bold text-xs tracking-widest uppercase">Personal Details</h4>
                    <span className="material-symbols-outlined text-secondary text-lg cursor-pointer">edit</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Full Name</p>
                      <p className="text-on-surface font-headline font-bold text-lg uppercase">Aditya R. Singhania</p>
                    </div>
                    <div>
                      <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Contact Details</p>
                      <p className="text-on-surface font-body text-sm">+91 98765 43210</p>
                      <p className="text-on-surface font-body text-sm">aditya.singhania@heritage.com</p>
                    </div>
                  </div>
                </section>

                {/* Recent Orders Overview */}
                <section className="flex flex-col gap-6">
                  <div className="flex justify-between items-end border-b border-on-surface pb-4">
                    <h2 className="text-on-surface text-2xl font-headline font-bold uppercase tracking-tight">Recent Orders</h2>
                    <Link className="text-secondary text-xs font-bold uppercase tracking-widest border-b border-secondary" href="/orderhistory">
                      View All Orders
                    </Link>
                  </div>
                  <div className="overflow-x-auto bg-white border border-outline-variant/15">
                    <table className="w-full text-left">
                      <thead className="bg-surface-container-low border-b border-outline-variant/10">
                        <tr>
                          <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Order ID</th>
                          <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Date</th>
                          <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Items</th>
                          <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Amount</th>
                          <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Status</th>
                          <th className="p-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 text-xs font-label">
                        {recentOrders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-outline italic">No recent orders found</td>
                          </tr>
                        ) : (
                          recentOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                              <td className="p-4 font-bold font-headline">#{order.id}</td>
                              <td className="p-4 text-outline">{order.date}</td>
                              <td className="p-4 truncate max-w-[200px]">{order.items[0]}</td>
                              <td className="p-4 font-bold">₹{order.total.toLocaleString("en-IN")}</td>
                              <td className="p-4">
                                <span className="inline-block px-2 py-0.5 border border-outline-variant/20 bg-surface-container-low text-[8px] font-bold uppercase tracking-widest">
                                  {order.status}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <Link
                                  className="text-[9px] font-bold uppercase border-b border-transparent hover:border-on-surface"
                                  href={`/orderhistory`}
                                >
                                  Details
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 2: LOYALTY & WALLET */}
            {activeTab === "loyalty" && (
              <div className="flex flex-col gap-12 animate-fade-in">
                <div className="flex flex-col gap-2 border-l-4 border-secondary pl-6">
                  <p className="text-secondary text-xs font-bold tracking-[0.3em] uppercase">Member Finances</p>
                  <h1 className="text-on-surface text-5xl font-headline font-extrabold tracking-tighter">LOYALTY & WALLET</h1>
                </div>

                {/* Balance Matrices cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Wallet */}
                  <div className="bg-white border border-outline-variant/30 p-8 flex flex-col justify-between rounded-none shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Internal Store Wallet</p>
                        <h3 className="text-on-surface font-headline font-extrabold text-4xl" id="walletBalanceDisplay">
                          ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </h3>
                      </div>
                      <span className="material-symbols-outlined text-secondary text-3xl">account_balance_wallet</span>
                    </div>
                    <p className="text-xs text-outline leading-relaxed uppercase tracking-wider font-semibold opacity-70">
                      Use your store wallet credit for instant 1-click purchases at checkout. Returned items are automatically refunded here.
                    </p>
                  </div>

                  {/* Loyalty Points */}
                  <div className="bg-white border border-outline-variant/30 p-8 flex flex-col justify-between rounded-none shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Loyalty Points Balance</p>
                        <h3 className="text-on-surface font-headline font-extrabold text-4xl" id="loyaltyPointsDisplay">
                          {loyaltyPoints} pts
                        </h3>
                      </div>
                      <span className="material-symbols-outlined text-secondary text-3xl">workspace_premium</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-outline leading-relaxed uppercase tracking-wider font-semibold opacity-70">
                        Earn rate: 1 point per ₹10 spent. Redeem at 10 points = ₹1.
                      </p>
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                        Current redemption value: ₹{(loyaltyPoints / 10).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ledgers transaction row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Wallet log */}
                  <div className="flex flex-col gap-6">
                    <h2 className="text-on-surface text-xl font-headline font-bold uppercase tracking-tight border-b border-on-surface/10 pb-4">
                      Wallet Transactions
                    </h2>
                    <div className="overflow-x-auto bg-white border border-outline-variant/25 rounded-none">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline-variant/10">
                            <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Date</th>
                            <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Details</th>
                            <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10 text-xs font-label">
                          {walletTxs.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-outline italic">No transactions yet</td>
                            </tr>
                          ) : (
                            walletTxs.map((tx) => (
                              <tr key={tx.id} className="hover:bg-surface-container-lowest transition-colors">
                                <td className="p-4 text-outline font-semibold">{tx.date}</td>
                                <td className="p-4 font-bold uppercase tracking-tight">{tx.description}</td>
                                <td className={`p-4 text-right font-bold ${tx.type === "credit" ? "text-green-700" : "text-red-700"}`}>
                                  {tx.type === "credit" ? "+" : "-"} ₹{tx.amount.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Loyalty log */}
                  <div className="flex flex-col gap-6">
                    <h2 className="text-on-surface text-xl font-headline font-bold uppercase tracking-tight border-b border-on-surface/10 pb-4">
                      Loyalty Log
                    </h2>
                    <div className="overflow-x-auto bg-white border border-outline-variant/25 rounded-none">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline-variant/10">
                            <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Date</th>
                            <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline">Details</th>
                            <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-outline text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10 text-xs font-label">
                          {loyaltyTxs.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-outline italic">No log entries yet</td>
                            </tr>
                          ) : (
                            loyaltyTxs.map((tx) => (
                              <tr key={tx.id} className="hover:bg-surface-container-lowest transition-colors">
                                <td className="p-4 text-outline font-semibold">{tx.date}</td>
                                <td className="p-4 font-bold uppercase tracking-tight">{tx.description}</td>
                                <td className={`p-4 text-right font-bold ${tx.type === "credit" ? "text-green-700" : "text-red-700"}`}>
                                  {tx.type === "credit" ? "+" : "-"} {tx.points.toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="pt-6 border-t border-white/10 flex justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">© 2026 6K Shirts. Crafted in Tamil Nadu.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
