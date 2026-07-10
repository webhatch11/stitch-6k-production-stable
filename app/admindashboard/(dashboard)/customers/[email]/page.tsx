"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order } from "@/lib/types";
import { getCustomersAction, getOrdersAction } from "@/app/actions/admin-reads";
import { adjustCustomerBalanceAction, blockCustomerAction, unblockCustomerAction } from "@/app/actions/admin-customers";
import { redirect } from "next/navigation";

interface CustomerData {
  name: string;
  email: string;
  phone?: string;
  wallet_balance: number;
  loyalty_points: number;
  ltv: number;
  order_count: number;
  id?: string;
  joined?: string;
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
}

interface PageProps {
  params: Promise<{ email: string }>;
}

export default function CustomerDossierDetailPage({ params }: PageProps) {
  // Customers module — Phase 2
  // Uncomment when client activates
  if (process.env.NEXT_PUBLIC_ENABLE_CUSTOMERS !== 'true') {
    redirect('/admindashboard');
  }

  const resolvedParams = React.use(params);
  const email = decodeURIComponent(resolvedParams.email);

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States for Balance Adjustments
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDesc, setWalletDesc] = useState("Admin Manual Adjustment");
  const [walletType, setWalletType] = useState<"credit" | "debit">("credit");

  const [loyaltyAmount, setLoyaltyAmount] = useState("");
  const [loyaltyDesc, setLoyaltyDesc] = useState("Admin Manual Adjustment");
  const [loyaltyType, setLoyaltyType] = useState<"credit" | "debit">("credit");

  // Block modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  // Toast
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadDossier();
  }, [email]);

  const loadDossier = async () => {
    try {
      setLoading(true);
      const customersRes = await getCustomersAction();
      if (customersRes.success) {
        const matched = (customersRes.customers || []).find(
          (c: any) => c.email.toLowerCase() === email.toLowerCase()
        );
        if (matched) {
          setCustomer(matched);
        } else {
          setCustomer({
            name: email.split("@")[0].toUpperCase().replace(".", " "),
            email,
            wallet_balance: 0,
            loyalty_points: 0,
            ltv: 0,
            order_count: 0,
          });
        }
      }

      const ordersRes = await getOrdersAction();
      if (ordersRes.success) {
        const customerOrders = (ordersRes.orders || []).filter(
          (o) =>
            o.address_snapshot?.email?.toLowerCase() === email.toLowerCase() ||
            (email.toLowerCase().includes("guest") &&
              (o.customer.toLowerCase() === "guest customer" || o.customer.toLowerCase() === "guest"))
        );
        setOrders(customerOrders);
      }
    } catch (err) {
      console.error("Failed to load customer dossier:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(walletAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      triggerToast("Please enter a valid positive amount");
      return;
    }

    const finalAmount = walletType === "credit" ? amountVal : -amountVal;
    
    if (walletType === "debit" && customer && customer.wallet_balance < amountVal) {
      triggerToast("Insufficient wallet credits for this debit");
      return;
    }

    const res = await adjustCustomerBalanceAction(email, "wallet", finalAmount, walletDesc);
    if (res.success) {
      triggerToast(`Successfully adjusted wallet by ₹${amountVal} (${walletType})`);
      setWalletAmount("");
      setWalletDesc("Admin Manual Adjustment");
      window.dispatchEvent(new Event("storage"));
      await loadDossier();
    } else {
      triggerToast(res.error || "Failed to adjust wallet balance.");
    }
  };

  const handleLoyaltyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const pointsVal = parseInt(loyaltyAmount, 10);
    if (isNaN(pointsVal) || pointsVal <= 0) {
      triggerToast("Please enter a valid positive number of points");
      return;
    }

    const finalPoints = loyaltyType === "credit" ? pointsVal : -pointsVal;

    if (loyaltyType === "debit" && customer && customer.loyalty_points < pointsVal) {
      triggerToast("Insufficient loyalty points for this debit");
      return;
    }

    const res = await adjustCustomerBalanceAction(email, "loyalty", finalPoints, loyaltyDesc);
    if (res.success) {
      triggerToast(`Successfully adjusted loyalty points by ${pointsVal} pts (${loyaltyType})`);
      setLoyaltyAmount("");
      setLoyaltyDesc("Admin Manual Adjustment");
      window.dispatchEvent(new Event("storage"));
      await loadDossier();
    } else {
      triggerToast(res.error || "Failed to adjust loyalty points.");
    }
  };

  const handleBlock = async () => {
    if (!customer?.id) {
      triggerToast("Cannot block: no user ID available (Supabase required)");
      return;
    }
    if (!blockReason.trim()) {
      triggerToast("Please enter a reason for blocking");
      return;
    }
    setBlockLoading(true);
    const res = await blockCustomerAction(customer.id, blockReason.trim());
    setBlockLoading(false);
    if (res.success) {
      setShowBlockModal(false);
      setBlockReason("");
      triggerToast("Customer blocked successfully");
      await loadDossier();
    } else {
      triggerToast(res.error || "Failed to block customer");
    }
  };

  const handleUnblock = async () => {
    if (!customer?.id) {
      triggerToast("Cannot unblock: no user ID available (Supabase required)");
      return;
    }
    setBlockLoading(true);
    const res = await unblockCustomerAction(customer.id);
    setBlockLoading(false);
    if (res.success) {
      triggerToast("Customer unblocked successfully");
      await loadDossier();
    } else {
      triggerToast(res.error || "Failed to unblock customer");
    }
  };

  if (loading) {
    return (
      <div className="p-8 lg:p-16 text-center py-48">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Decrypting client dossier...
        </p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 lg:p-16 text-center py-48">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-4">warning</span>
        <p className="text-sm font-black uppercase tracking-widest text-red-500">Dossier not found</p>
        <Link href="/admindashboard/customers" className="mt-8 inline-block text-xs font-bold underline">
          Return to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[900] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-8 shadow-2xl border border-gray-200">
            <h3 className="font-headline text-lg font-black uppercase tracking-tight text-[#0a0a0a] mb-2">
              Block Customer
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              This will prevent <strong>{customer.email}</strong> from placing new orders. You can unblock at any time.
            </p>
            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Reason for blocking *
            </label>
            <textarea
              id="block-reason-input"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              rows={3}
              placeholder="e.g. Repeated fraudulent orders, chargeback abuse..."
              className="w-full border border-gray-200 p-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a] resize-none mb-6"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowBlockModal(false); setBlockReason(""); }}
                className="flex-1 border border-gray-200 py-3 text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-block-btn"
                onClick={handleBlock}
                disabled={blockLoading || !blockReason.trim()}
                className="flex-1 bg-red-600 text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {blockLoading ? "Blocking..." : "Block Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <Link href="/admindashboard/customers" className="hover:text-[#0a0a0a] transition-all">
              Customers
            </Link>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">{customer.name}</span>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/admindashboard/customers"
              className="size-10 border border-gray-200 flex items-center justify-center text-[#0a0a0a] hover:bg-gray-50 transition-all bg-white"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </Link>
            <h2 className="text-4xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
              Client Dossier
            </h2>
          </div>
        </div>

        {/* Block/Unblock action buttons */}
        <div className="flex items-center gap-3">
          {customer.is_blocked ? (
            <button
              id="unblock-customer-btn"
              onClick={handleUnblock}
              disabled={blockLoading}
              className="flex items-center gap-2 border border-green-600 text-green-700 px-6 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-green-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">lock_open</span>
              Unblock Customer
            </button>
          ) : (
            <button
              id="block-customer-btn"
              onClick={() => setShowBlockModal(true)}
              className="flex items-center gap-2 border border-red-300 text-red-600 px-6 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">block</span>
              Block Customer
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Customer Profile & Balance adjustments */}
        <div className="lg:col-span-5 space-y-8">
          {/* Client summary card */}
          <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
            <div className="flex items-center gap-6 mb-6">
              <div className="size-16 bg-[#0a0a0a] text-white flex items-center justify-center font-headline font-black text-2xl border border-white/10">
                {customer.name ? customer.name.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="flex-1">
                <h3 className="font-headline font-black text-2xl uppercase tracking-tight text-[#0a0a0a]">
                  {customer.name}
                </h3>
                <p className="text-xs text-gray-400 font-bold tracking-wider mt-1">{customer.email}</p>
                {/* Status badge */}
                <span className={`inline-block mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-1 border ${
                  customer.is_blocked
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-green-50 border-green-200 text-green-700"
                }`}>
                  {customer.is_blocked ? "Blocked" : "Active"}
                </span>
              </div>
            </div>

            {/* Block info panel */}
            {customer.is_blocked && (
              <div className="bg-red-50 border border-red-200 p-4 mb-6 rounded-none">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-1">Account Blocked</p>
                {customer.blocked_reason && (
                  <p className="text-xs text-red-700 font-semibold mt-1">{customer.blocked_reason}</p>
                )}
                {customer.blocked_at && (
                  <p className="text-[10px] text-red-500 mt-1">
                    Blocked on: {new Date(customer.blocked_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-100 py-6 my-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Lifetime LTV</p>
                <p className="text-xl font-headline font-black text-primary mt-1">
                  ₹{customer.ltv.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Bookings</p>
                <p className="text-xl font-headline font-bold text-[#0a0a0a] mt-1">{customer.order_count}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#fcf9f2] border border-[#775a19]/10">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#775a19]/70">Wallet Balance</p>
                <p className="text-2xl font-headline font-black text-[#775a19] mt-1">
                  ₹{customer.wallet_balance.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Loyalty Balance</p>
                <p className="text-2xl font-headline font-black text-[#0a0a0a] mt-1">
                  {customer.loyalty_points} pts
                </p>
              </div>
            </div>
          </div>

          {/* Wallet credit/debit adjuster */}
          <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
            <h4 className="font-headline text-[10px] font-black uppercase tracking-[0.3em] text-[#0a0a0a] mb-6">
              Adjust Wallet Balance
            </h4>
            <form onSubmit={handleWalletAdjustment} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setWalletType("credit")}
                    className={`py-2 px-4 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      walletType === "credit"
                        ? "bg-[#0a0a0a] text-white"
                        : "bg-white border border-gray-200 text-[#0a0a0a] hover:bg-gray-50"
                    }`}
                  >
                    Credit (Add)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletType("debit")}
                    className={`py-2 px-4 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      walletType === "debit"
                        ? "bg-[#0a0a0a] text-white"
                        : "bg-white border border-gray-200 text-[#0a0a0a] hover:bg-gray-50"
                    }`}
                  >
                    Debit (Remove)
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="walletAmountInput"
                  className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
                >
                  Amount (INR)
                </label>
                <input
                  type="number"
                  id="walletAmountInput"
                  min="1"
                  step="any"
                  placeholder="e.g. 500"
                  required
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="w-full bg-transparent border border-gray-200 py-3 px-4 text-xs font-black tracking-widest text-[#0a0a0a] placeholder-gray-300 outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <div>
                <label
                  htmlFor="walletDescInput"
                  className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
                >
                  Adjustment Description / Reason
                </label>
                <input
                  type="text"
                  id="walletDescInput"
                  placeholder="Reason for adjustment"
                  required
                  value={walletDesc}
                  onChange={(e) => setWalletDesc(e.target.value)}
                  className="w-full bg-transparent border border-gray-200 py-3 px-4 text-xs font-semibold text-[#0a0a0a] placeholder-gray-300 outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0a0a0a] text-white py-3.5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all cursor-pointer border-none"
              >
                Apply Wallet Adjustment
              </button>
            </form>
          </div>

          {/* Loyalty adjuster */}
          <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
            <h4 className="font-headline text-[10px] font-black uppercase tracking-[0.3em] text-[#0a0a0a] mb-6">
              Adjust Loyalty Points
            </h4>
            <form onSubmit={handleLoyaltyAdjustment} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setLoyaltyType("credit")}
                    className={`py-2 px-4 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      loyaltyType === "credit"
                        ? "bg-[#0a0a0a] text-white"
                        : "bg-white border border-gray-200 text-[#0a0a0a] hover:bg-gray-50"
                    }`}
                  >
                    Credit (Add)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoyaltyType("debit")}
                    className={`py-2 px-4 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      loyaltyType === "debit"
                        ? "bg-[#0a0a0a] text-white"
                        : "bg-white border border-gray-200 text-[#0a0a0a] hover:bg-gray-50"
                    }`}
                  >
                    Debit (Remove)
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="loyaltyAmountInput"
                  className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
                >
                  Points Count
                </label>
                <input
                  type="number"
                  id="loyaltyAmountInput"
                  min="1"
                  step="1"
                  placeholder="e.g. 100"
                  required
                  value={loyaltyAmount}
                  onChange={(e) => setLoyaltyAmount(e.target.value)}
                  className="w-full bg-transparent border border-gray-200 py-3 px-4 text-xs font-black tracking-widest text-[#0a0a0a] placeholder-gray-300 outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <div>
                <label
                  htmlFor="loyaltyDescInput"
                  className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
                >
                  Adjustment Description / Reason
                </label>
                <input
                  type="text"
                  id="loyaltyDescInput"
                  placeholder="Reason for adjustment"
                  required
                  value={loyaltyDesc}
                  onChange={(e) => setLoyaltyDesc(e.target.value)}
                  className="w-full bg-transparent border border-gray-200 py-3 px-4 text-xs font-semibold text-[#0a0a0a] placeholder-gray-300 outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0a0a0a] text-white py-3.5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all cursor-pointer border-none"
              >
                Apply Loyalty Adjustment
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Customer Order History */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-gray-200 shadow-sm p-8 rounded-none">
            <h3 className="font-headline text-xs font-black uppercase tracking-[0.3em] text-[#0a0a0a] border-l-4 border-primary pl-6 mb-8">
              Booking History
            </h3>

            {orders.length === 0 ? (
              <div className="py-24 text-center text-gray-400">
                <span className="material-symbols-outlined text-4xl mb-4 opacity-30">shopping_bag</span>
                <p className="text-[10px] font-black uppercase tracking-widest">
                  No transaction records on file
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => {
                  const s = order.status.toLowerCase();
                  return (
                    <div
                      key={order.id}
                      className="border border-gray-200 hover:border-gray-300 transition-all p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-[#0a0a0a]">
                            #{order.id}
                          </span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {order.date}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">
                          {order.items.join(" • ")}
                        </p>
                        {order.shiprocketId && (
                          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#775a19] font-bold">
                            <span className="material-symbols-outlined text-sm">local_shipping</span>
                            <span>AWB: {order.shiprocketId}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-left md:text-right">
                          <p className="text-xs font-headline font-black text-[#0a0a0a]">
                            ₹{order.total.toLocaleString("en-IN")}
                          </p>
                          <span
                            className={`inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 mt-1 border ${
                              s === "paid" || s === "delivered"
                                ? "bg-green-50 border-green-200 text-green-700"
                                : s === "shipped"
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : s === "cancelled" || s === "expired"
                                ? "bg-red-50 border-red-200 text-red-700"
                                : "bg-yellow-50 border-yellow-200 text-yellow-700"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <Link
                          href={`/admindashboard/order-details?orderId=${order.id}`}
                          className="border border-gray-200 hover:border-[#0a0a0a] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[#0a0a0a] transition-all hover:bg-gray-50 bg-white"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
