"use client";

import React, { useState, useEffect } from "react";
import { Coupon } from "@/lib/registry";
import { getCouponsAction, getProductsAction } from "@/app/actions/admin-reads";
import { saveCouponAction, deleteCouponAction, getCouponDiscountTotalAction } from "@/app/actions/admin-coupons";

const getCouponStatus = (coupon: Coupon) => {
  const now = new Date()
  
  if (!coupon.active) return 'Inactive'
  
  if (coupon.expiryDate) {
    const expiry = new Date(coupon.expiryDate)
    expiry.setHours(23, 59, 59, 999)
    if (now > expiry) return 'Expired'
  }
  
  const usage = coupon.usageCount ?? coupon.usage_count ?? 0;
  const max = coupon.maxUsage ?? coupon.max_usage;
  if (max !== undefined && max !== null && usage >= max) {
    return 'Limit Reached'
  }
  
  return 'Active'
}

const statusColors = {
  'Active': { bg: '#dcfce7', color: '#166534' },
  'Expired': { bg: '#fee2e2', color: '#991b1b' },
  'Inactive': { bg: '#f3f4f6', color: '#6b7280' },
  'Limit Reached': { bg: '#fef3c7', color: '#92400e' }
}

export default function CouponsLedgerPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Coupon discount totals
  const [couponDiscountTotal, setCouponDiscountTotal] = useState(0);
  const [couponDiscountPerCode, setCouponDiscountPerCode] = useState<Record<string, number>>({});

  const fetchDiscountTotal = async () => {
    const res = await getCouponDiscountTotalAction();
    if (res.success) {
      setCouponDiscountTotal(res.total || 0);
      setCouponDiscountPerCode(res.perCoupon || {});
    }
  };

  // New Coupon Form
  const [cpnCode, setCpnCode] = useState("");
  const [cpnValue, setCpnValue] = useState(0);
  const [cpnType, setCpnType] = useState<"percent" | "flat" | "bogo_quantity" | "bogo_product" | "spend_discount">("percent");
  const [cpnMinCartValue, setCpnMinCartValue] = useState(0);
  const [cpnMaxUsage, setCpnMaxUsage] = useState<string>("");
  const [cpnExpiryDate, setCpnExpiryDate] = useState<string>("");

  // BOGO fields for New Coupon Form
  const [cpnBuyQuantity, setCpnBuyQuantity] = useState<string>("");
  const [cpnGetQuantity, setCpnGetQuantity] = useState<string>("");
  const [cpnGetDiscountPercent, setCpnGetDiscountPercent] = useState<string>("");
  const [cpnBuyProductId, setCpnBuyProductId] = useState("");
  const [cpnGetProductId, setCpnGetProductId] = useState("");

  // Edit Coupon Form
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editValue, setEditValue] = useState(0);
  const [editType, setEditType] = useState<"percent" | "flat" | "bogo_quantity" | "bogo_product" | "spend_discount">("percent");
  const [editActive, setEditActive] = useState(true);
  const [editMinCartValue, setEditMinCartValue] = useState(0);
  const [editMaxUsage, setEditMaxUsage] = useState<string>("");
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");

  // BOGO fields for Edit Coupon Form
  const [editBuyQuantity, setEditBuyQuantity] = useState<string>("");
  const [editGetQuantity, setEditGetQuantity] = useState<string>("");
  const [editGetDiscountPercent, setEditGetDiscountPercent] = useState<string>("");
  const [editBuyProductId, setEditBuyProductId] = useState("");
  const [editGetProductId, setEditGetProductId] = useState("");

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
    loadProducts();

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
    fetchDiscountTotal();
  };

  const loadProducts = async () => {
    const res = await getProductsAction();
    if (res.success) {
      setProductsList(res.products || []);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = cpnCode.trim().toUpperCase();
    if (!code) {
      triggerToast("Please enter a coupon code");
      return;
    }
    if ((cpnType === "percent" || cpnType === "flat") && cpnValue <= 0) {
      triggerToast("Please enter a valid discount value");
      return;
    }
    if (cpnMinCartValue < 0) {
      triggerToast("Minimum cart value must be at least 0");
      return;
    }
    const maxUsageNum = cpnMaxUsage !== "" ? Number(cpnMaxUsage) : null;
    if (maxUsageNum !== null && (isNaN(maxUsageNum) || maxUsageNum < 0)) {
      triggerToast("Max uses must be at least 0");
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

    const res = await saveCouponAction({
      code,
      discount: cpnType === "percent" || cpnType === "flat" ? cpnValue : 0,
      type: cpnType,
      active: true,
      min_cart_value: cpnMinCartValue,
      max_usage: maxUsageNum,
      expiry_date: cpnExpiryDate || null,
      buy_quantity: cpnType === "bogo_quantity" && cpnBuyQuantity !== "" ? Number(cpnBuyQuantity) : null,
      get_quantity: cpnType === "bogo_quantity" && cpnGetQuantity !== "" ? Number(cpnGetQuantity) : null,
      get_discount_percent: (cpnType === "bogo_product" || cpnType === "spend_discount") && cpnGetDiscountPercent !== "" ? Number(cpnGetDiscountPercent) : null,
      buy_product_id: cpnType === "bogo_product" ? cpnBuyProductId || null : null,
      get_product_id: cpnType === "bogo_product" ? cpnGetProductId || null : null,
    });
    if (!res.success) {
      triggerToast(res.error || "Failed to create coupon");
      return;
    }
    setAddModalOpen(false);
    setCpnCode("");
    setCpnValue(0);
    setCpnType("percent");
    setCpnMinCartValue(0);
    setCpnMaxUsage("");
    setCpnExpiryDate("");
    setCpnBuyQuantity("");
    setCpnGetQuantity("");
    setCpnGetDiscountPercent("");
    setCpnBuyProductId("");
    setCpnGetProductId("");
    triggerToast("Coupon code created successfully");
    await loadCoupons();
  };

  const handleOpenEditModal = (c: Coupon) => {
    setEditingCoupon(c);
    setEditCode(c.code);
    setEditValue(c.discount);
    setEditType(c.type as any);
    setEditActive(c.active);
    setEditMinCartValue(c.minCartValue ?? 0);
    setEditMaxUsage(c.maxUsage != null ? String(c.maxUsage) : "");
    setEditExpiryDate(c.expiryDate ? c.expiryDate.split("T")[0] : "");
    setEditBuyQuantity(c.buyQuantity != null ? String(c.buyQuantity) : "");
    setEditGetQuantity(c.getQuantity != null ? String(c.getQuantity) : "");
    setEditGetDiscountPercent(c.getDiscountPercent != null ? String(c.getDiscountPercent) : "");
    setEditBuyProductId(c.buyProductId || "");
    setEditGetProductId(c.getProductId || "");
    setEditModalOpen(true);
  };

  const handleSaveEditCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    const code = editCode.trim().toUpperCase();
    if (!code) {
      triggerToast("Please enter a coupon code");
      return;
    }
    if ((editType === "percent" || editType === "flat") && editValue <= 0) {
      triggerToast("Please enter a valid discount value");
      return;
    }
    if (editMinCartValue < 0) {
      triggerToast("Minimum cart value must be at least 0");
      return;
    }
    const maxUsageNum = editMaxUsage !== "" ? Number(editMaxUsage) : null;
    if (maxUsageNum !== null && (isNaN(maxUsageNum) || maxUsageNum < 0)) {
      triggerToast("Max uses must be at least 0");
      return;
    }

    const existing = await getCouponsAction();
    if (existing.success) {
      const exists = (existing.coupons || []).some((c) => c.id !== editingCoupon.id && c.code.toUpperCase() === code);
      if (exists) {
        triggerToast("Coupon code already exists");
        return;
      }
    }

    const res = await saveCouponAction({
      id: editingCoupon.id,
      code,
      discount: editType === "percent" || editType === "flat" ? editValue : 0,
      type: editType,
      active: editActive,
      min_cart_value: editMinCartValue,
      max_usage: maxUsageNum,
      expiry_date: editExpiryDate || null,
      buy_quantity: editType === "bogo_quantity" && editBuyQuantity !== "" ? Number(editBuyQuantity) : null,
      get_quantity: editType === "bogo_quantity" && editGetQuantity !== "" ? Number(editGetQuantity) : null,
      get_discount_percent: (editType === "bogo_product" || editType === "spend_discount") && editGetDiscountPercent !== "" ? Number(editGetDiscountPercent) : null,
      buy_product_id: editType === "bogo_product" ? editBuyProductId || null : null,
      get_product_id: editType === "bogo_product" ? editGetProductId || null : null,
    });
    if (!res.success) {
      triggerToast(res.error || "Failed to update coupon");
      return;
    }
    setEditModalOpen(false);
    setEditingCoupon(null);
    setEditMinCartValue(0);
    setEditMaxUsage("");
    setEditExpiryDate("");
    setEditBuyQuantity("");
    setEditGetQuantity("");
    setEditGetDiscountPercent("");
    setEditBuyProductId("");
    setEditGetProductId("");
    triggerToast("Coupon updated successfully");
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
            <span>Admin Portal</span>
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

      {/* Coupon Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-6">Total Coupons</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter text-[#0a0a0a]">
              {coupons.length}
            </h3>
          </div>
        </div>

        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-6">Active Coupons</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter text-[#0a0a0a]">
              {coupons.filter(c => c.active).length}
            </h3>
          </div>
        </div>

        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-6">Total Uses</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter text-[#0a0a0a]">
              {coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-gray-500 mb-6">Discount Given (₹)</p>
          <div>
            <h3 className="text-3xl font-headline font-black tracking-tighter text-[#0a0a0a]">
              ₹{couponDiscountTotal.toLocaleString("en-IN")}.00
            </h3>
          </div>
        </div>
      </section>

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
                <th className="px-8 py-6">Uses</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-xs text-gray-400 italic">
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
                      {c.type === "percent" ? `${c.discount}%` : (c.type === "flat" ? `₹${c.discount.toLocaleString("en-IN")}.00` : "BOGO/Offer")}
                    </td>
                    <td className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {c.type}
                    </td>
                    <td className="px-8 py-6 font-bold text-sm">
                      {c.usageCount || 0}{c.maxUsage ? ` / ${c.maxUsage}` : ""}
                    </td>
                    <td className="px-8 py-6">
                      {(() => {
                        const status = getCouponStatus(c);
                        const colors = statusColors[status] || statusColors['Inactive'];
                        return (
                          <span 
                            className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-none border"
                            style={{ backgroundColor: colors.bg, color: colors.color, borderColor: colors.color + '20' }}
                          >
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="material-symbols-outlined text-gray-400 hover:text-primary bg-transparent border-none cursor-pointer p-1 transition-colors flex items-center justify-center"
                          title="Edit Coupon"
                        >
                          edit
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(c)}
                          className="material-symbols-outlined text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-1 transition-colors flex items-center justify-center"
                          title="Delete Coupon"
                        >
                          delete
                        </button>
                      </div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md p-10 border border-gray-200 rounded-none text-left my-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-headline font-black tracking-tighter uppercase">New Coupon</h3>
              <button
                onClick={() => {
                  setAddModalOpen(false);
                  setCpnCode("");
                  setCpnValue(0);
                  setCpnType("percent");
                  setCpnMinCartValue(0);
                  setCpnMaxUsage("");
                  setCpnExpiryDate("");
                  setCpnBuyQuantity("");
                  setCpnGetQuantity("");
                  setCpnGetDiscountPercent("");
                  setCpnBuyProductId("");
                  setCpnGetProductId("");
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

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Coupon Type</label>
                <select
                  value={cpnType}
                  onChange={(e) => setCpnType(e.target.value as any)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="bogo_quantity">Buy X Get Y (Quantity)</option>
                  <option value="bogo_product">Buy Product Get Product</option>
                  <option value="spend_discount">Spend & Save</option>
                </select>
              </div>

              {/* Dynamic fields based on cpnType */}
              {(cpnType === "percent" || cpnType === "flat") && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Discount Value {cpnType === "percent" ? "(%)" : "(₹)"}
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
              )}

              {cpnType === "bogo_quantity" && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Buy Quantity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={cpnBuyQuantity}
                      onChange={(e) => setCpnBuyQuantity(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Get Quantity (Free)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={cpnGetQuantity}
                      onChange={(e) => setCpnGetQuantity(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="1"
                    />
                  </div>
                </div>
              )}

              {cpnType === "bogo_product" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Buy Product</label>
                    <select
                      required
                      value={cpnBuyProductId}
                      onChange={(e) => setCpnBuyProductId(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                    >
                      <option value="">Select Buy Product</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Get Product</label>
                    <select
                      required
                      value={cpnGetProductId}
                      onChange={(e) => setCpnGetProductId(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                    >
                      <option value="">Select Get Product</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Discount % on Get Product</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      value={cpnGetDiscountPercent}
                      onChange={(e) => setCpnGetDiscountPercent(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="50"
                    />
                  </div>
                </div>
              )}

              {cpnType === "spend_discount" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Discount %</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      value={cpnGetDiscountPercent}
                      onChange={(e) => setCpnGetDiscountPercent(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="20"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  {cpnType === "spend_discount" ? "Minimum spend amount (₹)" : "Min cart value (₹)"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={cpnMinCartValue}
                  onChange={(e) => setCpnMinCartValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Max uses (blank = unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cpnMaxUsage}
                    onChange={(e) => setCpnMaxUsage(e.target.value)}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                    placeholder="e.g. 100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Expiry date
                  </label>
                  <input
                    type="date"
                    value={cpnExpiryDate}
                    onChange={(e) => setCpnExpiryDate(e.target.value)}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-xs py-3 px-4 rounded-none"
                  />
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

      {/* Edit Coupon Modal */}
      {editModalOpen && editingCoupon && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md p-10 border border-gray-200 rounded-none text-left my-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-headline font-black tracking-tighter uppercase">Edit Coupon</h3>
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingCoupon(null);
                  setEditMinCartValue(0);
                  setEditMaxUsage("");
                  setEditExpiryDate("");
                  setEditBuyQuantity("");
                  setEditGetQuantity("");
                  setEditGetDiscountPercent("");
                  setEditBuyProductId("");
                  setEditGetProductId("");
                }}
                className="material-symbols-outlined text-gray-400 hover:text-primary bg-transparent border-none cursor-pointer flex items-center justify-center"
              >
                close
              </button>
            </div>
            <form onSubmit={handleSaveEditCoupon} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Coupon Code
                </label>
                <input
                  required
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 uppercase font-bold tracking-widest text-sm py-3 px-4 rounded-none"
                  placeholder="e.g. HERITAGE20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Coupon Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="bogo_quantity">Buy X Get Y (Quantity)</option>
                  <option value="bogo_product">Buy Product Get Product</option>
                  <option value="spend_discount">Spend & Save</option>
                </select>
              </div>

              {/* Dynamic fields based on editType */}
              {(editType === "percent" || editType === "flat") && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Discount Value {editType === "percent" ? "(%)" : "(₹)"}
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={editValue || ""}
                    onChange={(e) => setEditValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                    placeholder="20"
                  />
                </div>
              )}

              {editType === "bogo_quantity" && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Buy Quantity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={editBuyQuantity}
                      onChange={(e) => setEditBuyQuantity(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Get Quantity (Free)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={editGetQuantity}
                      onChange={(e) => setEditGetQuantity(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="1"
                    />
                  </div>
                </div>
              )}

              {editType === "bogo_product" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Buy Product</label>
                    <select
                      required
                      value={editBuyProductId}
                      onChange={(e) => setEditBuyProductId(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                    >
                      <option value="">Select Buy Product</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Get Product</label>
                    <select
                      required
                      value={editGetProductId}
                      onChange={(e) => setEditGetProductId(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-none cursor-pointer bg-white"
                    >
                      <option value="">Select Get Product</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Discount % on Get Product</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      value={editGetDiscountPercent}
                      onChange={(e) => setEditGetDiscountPercent(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="50"
                    />
                  </div>
                </div>
              )}

              {editType === "spend_discount" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Discount %</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      value={editGetDiscountPercent}
                      onChange={(e) => setEditGetDiscountPercent(e.target.value)}
                      className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                      placeholder="20"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  {editType === "spend_discount" ? "Minimum spend amount (₹)" : "Min cart value (₹)"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={editMinCartValue}
                  onChange={(e) => setEditMinCartValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Max uses (blank = unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editMaxUsage}
                    onChange={(e) => setEditMaxUsage(e.target.value)}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                    placeholder="e.g. 100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Expiry date
                  </label>
                  <input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-xs py-3 px-4 rounded-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="edit-active-flag"
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-primary focus:ring-primary rounded-none cursor-pointer"
                />
                <label htmlFor="edit-active-flag" className="text-xs font-bold uppercase tracking-widest text-[#0a0a0a] cursor-pointer select-none">
                  Coupon Active
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white py-4 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all rounded-none cursor-pointer border-none font-bold mt-4"
              >
                Save Changes
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
