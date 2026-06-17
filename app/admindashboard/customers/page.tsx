"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/db";

interface CustomerData {
  name: string;
  email: string;
  wallet_balance: number;
  loyalty_points: number;
  ltv: number;
  order_count: number;
}

export default function CustomersManagementPage() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await db.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLTV = customers.reduce((sum, c) => sum + c.ltv, 0);
  const totalWalletLiability = customers.reduce((sum, c) => sum + c.wallet_balance, 0);
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyalty_points, 0);

  return (
    <div className="p-8 lg:p-16">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Customers Management</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
            Customers
          </h2>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto overflow-x-auto pb-4 lg:pb-0 font-bold">
          <button
            onClick={loadCustomers}
            className="border border-gray-200 px-6 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-gray-50 transition-all shadow-sm bg-white cursor-pointer"
          >
            Refresh List
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Customers</p>
          <h3 className="font-headline font-black text-4xl text-[#0a0a0a]">{customers.length}</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Registered Dossiers</p>
        </div>

        <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Lifetime Bookings (LTV)</p>
          <h3 className="font-headline font-black text-4xl text-primary">
            ₹{totalLTV.toLocaleString("en-IN")}
          </h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Total Paid Sales</p>
        </div>

        <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Wallet Liability</p>
          <h3 className="font-headline font-black text-4xl text-[#775a19]">
            ₹{totalWalletLiability.toLocaleString("en-IN")}
          </h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Unspent Store Credits</p>
        </div>

        <div className="bg-white border border-gray-200 p-8 shadow-sm rounded-none">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Loyalty Liability</p>
          <h3 className="font-headline font-black text-4xl text-[#0a0a0a]">{totalLoyaltyPoints} pts</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Client Loyalty Pool</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-gray-200 p-6 mb-8 flex items-center shadow-sm">
        <span className="material-symbols-outlined text-gray-400 mr-4">search</span>
        <input
          type="text"
          placeholder="SEARCH CLIENTS BY NAME OR EMAIL..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none outline-none focus:ring-0 w-full text-xs font-black uppercase tracking-widest text-[#0a0a0a] placeholder-gray-300"
        />
      </div>

      {/* Customers Data Table */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Retrieving client archives...
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-24 text-center text-gray-500">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-30">group</span>
            <p className="text-[10px] font-black uppercase tracking-widest">
              No matching client dossiers found
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Client Profile</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Orders</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Lifetime LTV</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Wallet Credits</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Loyalty Balance</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const initial = customer.name ? customer.name.charAt(0).toUpperCase() : "?";
                return (
                  <tr
                    key={customer.email}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="size-10 bg-[#0a0a0a] text-white flex items-center justify-center font-headline font-black text-sm border border-white/10">
                          {initial}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-[#0a0a0a]">
                            {customer.name || "Guest Customer"}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 lowercase tracking-wider mt-0.5">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-headline font-bold text-[#0a0a0a]">
                        {customer.order_count} {customer.order_count === 1 ? "Order" : "Orders"}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-headline font-black text-primary">
                        ₹{customer.ltv.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-headline font-bold text-[#775a19]">
                        ₹{customer.wallet_balance.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-headline font-bold text-gray-700">
                        {customer.loyalty_points} pts
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <Link
                        href={`/admindashboard/customers/${encodeURIComponent(customer.email)}`}
                        className="inline-flex items-center gap-2 border border-gray-200 hover:border-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] transition-all bg-white"
                      >
                        <span className="material-symbols-outlined text-sm">assignment_ind</span> CRM Dossier
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
