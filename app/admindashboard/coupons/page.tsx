"use client";

import React, { useState, useEffect } from "react";
import { Coupon } from "@/lib/registry";
import { getCouponsAction } from "@/app/actions/admin-reads";
import { saveCouponAction, deleteCouponAction } from "@/app/actions/admin-coupons";


export default function CouponsLedgerPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // New Coupon Form
  const [cpnCode, setCpnCode] = useState("");
  const [cpnValue, setCpnValue] = useState(0);
  const [cpnType, setCpnType] = useState<"percent" | "flat">("percent");

  // Delete Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetCode, setDeleteTargetCode] = useState<string | null>(null);

  // Toast notifications
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
    loadCoupons();

    // Listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "registry_coupons") {
        loadCoupons();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loadCoupons = async () => {
    const res = await getCouponsAction();
    if (!res.success) {
      triggerToast(res.error || "Failed to load coupons");
      return;
    }
    setCoupons(res.coupons || []);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = cpnCode.trim().toUpperCase();
    if (!code) {
      triggerToast("Please enter a coupon code");
      return;
    }
    if (cpnValue <= 0) {
      triggerToast("Please enter a valid discount value");
      return;
    }

    const existing = await getCouponsAction();
    if (existing.success) {
      const exists = (existing.coupons || []).some((c) => c.code.toUpperCase() === code);
      if (exists) {
        triggerToast("Coupon code already exists");
        return;
      }
    }

    const res = await saveCouponAction({ code, discount: cpnValue, type: cpnType, active: true });
    if (!res.success) {
      triggerToast(res.error || "Failed to create coupon");
      return;
    }
    setAddModalOpen(false);
    setCpnCode("");
    setCpnValue(0);
    setCpnType("percent");
    triggerToast("Coupon code created successfully");
    await loadCoupons();
  };

  const handleDeleteCoupon = (c: Coupon) => {
    setDeleteTargetId(c.id);
    setDeleteTargetCode(c.code);
  };

  const confirmDeleteCoupon = async () => {
    if (!deleteTargetId) return;
    const res = await deleteCouponAction(deleteTargetId);
    if (!res.success) {
      triggerToast(res.error || "Failed to delete coupon");
      return;
    }
    triggerToast("Coupon deleted successfully");
    setDeleteTargetId(null);
    setDeleteTargetCode(null);
    await loadCoupons();
  };

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      <header className="flex justify-between items-center mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Promotions</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Coupons</h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            Create and manage customer discount codes.
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
        >
          Create Coupon
        </button>
      </header>

      {/* Coupons log list */}
      <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
        <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
          <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
            Active Discount Codes
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="px-8 py-6">Code</th>
                <th className="px-8 py-6">Discount</th>
                <th className="px-8 py-6">Type</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-xs text-gray-400 italic">
                    No active coupon codes defined.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-[#f9fafb] transition-colors border-b border-gray-100">
                    <td className="px-8 py-6 font-headline font-black tracking-widest text-primary text-sm">
                      {c.code}
                    </td>
                    <td className="px-8 py-6 font-bold text-sm">
                      {c.type === "percent" ? `${c.discount}%` : `₹${c.discount.toLocaleString("en-IN")}.00`}
                    </td>
                    <td className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {c.type}
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest rounded-none border border-green-200/50">
                        Active
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => handleDeleteCoupon(c)}
                        className="material-symbols-outlined text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-1 transition-colors flex items-center justify-center inline-block ml-auto"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Coupon Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md p-10 border border-gray-200 rounded-none text-left">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-headline font-black tracking-tighter uppercase">New Coupon</h3>
              <button
                onClick={() => {
                  setAddModalOpen(false);
                  setCpnCode("");
                  setCpnValue(0);
                  setCpnType("percent");
                }}
                className="material-symbols-outlined text-gray-400 hover:text-primary bg-transparent border-none cursor-pointer flex items-center justify-center"
              >
                close
              </button>
            </div>
            <form onSubmit={handleCreateCoupon} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Coupon Code
                </label>
                <input
                  required
                  type="text"
                  value={cpnCode}
                  onChange={(e) => setCpnCode(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 uppercase font-bold tracking-widest text-sm py-3 px-4 rounded-none"
                  placeholder="e.g. HERITAGE20"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Discount Value
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={cpnValue || ""}
                    onChange={(e) => setCpnValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                    placeholder="20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Type</label>
                  <select
                    value={cpnType}
                    onChange={(e) => setCpnType(e.target.value as any)}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white py-4 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all rounded-none cursor-pointer border-none font-bold mt-4"
              >
                Create Coupon
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-center rounded-none animate-zoom-in">
            <div className="mx-auto w-12 h-12 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined text-xl">delete</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-primary">Delete Coupon</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
                Are you sure you want to delete coupon <span className="text-[#0a0a0a] font-black">"{deleteTargetCode}"</span>?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTargetId(null);
                  setDeleteTargetCode(null);
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCoupon}
                className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none border-none font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
