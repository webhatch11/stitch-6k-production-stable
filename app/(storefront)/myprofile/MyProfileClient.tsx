"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, WalletTransaction, LoyaltyTransaction } from "@/lib/registry";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getProfileDataAction } from "@/app/actions/profile";

interface MyProfileClientProps {
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  initialWalletBalance: number;
  initialWalletTxs: WalletTransaction[];
  initialLoyaltyPoints: number;
  initialLoyaltyTxs: LoyaltyTransaction[];
  initialRecentOrders: Order[];
}

export default function MyProfileClient({
  userName,
  userEmail,
  userPhone,
  userRole,
  initialWalletBalance,
  initialWalletTxs,
  initialLoyaltyPoints,
  initialLoyaltyTxs,
  initialRecentOrders,
}: MyProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "loyalty">("profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // States
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>(initialWalletTxs);
  const [loyaltyPoints, setLoyaltyPoints] = useState(initialLoyaltyPoints);
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTransaction[]>(initialLoyaltyTxs);
  const [recentOrders, setRecentOrders] = useState<Order[]>(initialRecentOrders);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#loyalty") {
      setActiveTab("loyalty");
    }

    // Cross-tab sync listener
    const handleStorage = async (e: StorageEvent) => {
      if (
        e.key === "registry_wallet_balance" ||
        e.key === "registry_loyalty_points" ||
        e.key === "registry_orders"
      ) {
        await refreshProfileData();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const refreshProfileData = async () => {
    const res = await getProfileDataAction();
    if (res.success && res.data) {
      setWalletBalance(res.data.walletBalance);
      setWalletTxs(res.data.walletTxs);
      setLoyaltyPoints(res.data.loyaltyPoints);
      setLoyaltyTxs(res.data.loyaltyTxs);
      setRecentOrders(res.data.recentOrders);
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem("mock_user_session");
      document.cookie = "mock_user_session=; path=/; max-age=0";
      document.cookie = "mock_user_role=; path=/; max-age=0";
      document.cookie = "mock_user_email=; path=/; max-age=0";
      document.cookie = "mock_user_name=; path=/; max-age=0";
    }
    router.refresh();
    router.push("/login");
  };

  const handleTabSwitch = (tabName: "profile" | "loyalty") => {
    setActiveTab(tabName);
    setSidebarOpen(false);
  };

  return (
    <div className="layout-container flex h-full grow flex-col max-w-7xl mx-auto w-full flex-grow py-10">
      <div className="flex grow flex-col lg:flex-row min-h-[60vh] w-full">
        {/* Side navigation bar */}
        <aside
          className={`fixed top-0 left-0 h-full w-72 bg-white z-50 transform -translate-x-full transition-transform duration-300 lg:translate-x-0 lg:static lg:flex flex-col border-r border-[#eee] p-6 shrink-0 ${
            sidebarOpen ? "translate-x-0" : ""
          }`}
        >
          {/* Mobile close button */}
          <div className="flex justify-end mb-4 lg:hidden">
            <button onClick={() => setSidebarOpen(false)} className="p-2 bg-transparent border-none">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Profile Avatar */}
          <div className="flex gap-4 items-center mb-6">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-none bg-cover bg-center border border-secondary flex items-center justify-center bg-black text-[#fed488] font-bold text-xl"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold uppercase text-sm sm:text-base">{userName}</h3>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase">{userRole === 'admin' ? 'Store Admin' : 'Platinum Member'}</p>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="flex flex-col gap-1 sm:gap-2 text-xs uppercase tracking-widest font-black">
            <button
              onClick={() => handleTabSwitch("profile")}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-left rounded-none border-none ${
                activeTab === "profile" ? "bg-black text-white" : "hover:bg-gray-100 bg-transparent text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
              Profile Overview
            </button>

            <button
              onClick={() => handleTabSwitch("loyalty")}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-left rounded-none border-none ${
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

            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-red-50 text-red-700 cursor-pointer text-left rounded-none bg-transparent border-none"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sign Out
            </button>
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
                    <p className="text-on-surface font-headline font-bold text-lg uppercase">{userName}</p>
                  </div>
                  <div>
                    <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Contact Details</p>
                    <p className="text-on-surface font-body text-sm">{userPhone}</p>
                    <p className="text-on-surface font-body text-sm">{userEmail}</p>
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
  );
}
