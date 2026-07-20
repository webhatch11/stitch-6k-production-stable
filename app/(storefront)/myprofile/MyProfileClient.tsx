"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, WalletTransaction, LoyaltyTransaction, UserAddress, Product } from "@/lib/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getProfileDataAction, updateProfileAction } from "@/app/actions/profile";
import { useToastStore } from "@/stores/toastStore";
import { 
  getUserAddressesAction, 
  saveUserAddressAction, 
  deleteUserAddressAction, 
  setDefaultUserAddressAction 
} from "@/app/actions/addresses";
import { getPendingPointsAction } from "@/app/actions/orders";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useRecentStore } from "@/stores/recentStore";
import { useCartStore } from "@/stores/cartStore";
import ProductImage from "@/components/ProductImage";

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
  initialAllOrders: Order[];
  activeProducts?: Product[];
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
  initialAllOrders,
  activeProducts = [],
}: MyProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "loyalty" | "wishlist" | "returns">("profile");
  const [tabLoading, setTabLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wishlistStore = useWishlistStore();
  const wishlistItems = wishlistStore.wishlistItems;

  const displayWishlistItems = useMemo(() => {
    if (!activeProducts || activeProducts.length === 0) return wishlistItems;
    const activeIds = new Set(activeProducts.map((p) => p.id));
    const activeSlugs = new Set(activeProducts.map((p) => p.slug));
    return wishlistItems.filter(
      (item) => activeIds.has(item.id) || (item.slug && activeSlugs.has(item.slug))
    );
  }, [wishlistItems, activeProducts]);

  useEffect(() => {
    if (activeProducts && activeProducts.length > 0) {
      wishlistStore.reconcileWishlist(activeProducts);
      useRecentStore.getState().reconcileRecent(activeProducts);
    }
  }, [activeProducts]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "wishlist" || tab === "loyalty" || tab === "returns" || tab === "profile") {
        setActiveTab(tab);
      }
    }
  }, []);

  // States
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>(initialWalletTxs);
  const [loyaltyPoints, setLoyaltyPoints] = useState(initialLoyaltyPoints);
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTransaction[]>(initialLoyaltyTxs);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [pendingDetails, setPendingDetails] = useState<Array<{ id: string; points: number; availableOn: string | null }>>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>(initialRecentOrders);
  const [allOrders, setAllOrders] = useState<Order[]>(initialAllOrders);

  // Profile Edit States
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState(userPhone || "");
  const [editName, setEditName] = useState(userName);
  const [editPhone, setEditPhone] = useState(userPhone || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const userReturns = allOrders.filter(o => 
    [
      'Return Requested',
      'Return Accepted',
      'Return in Transit', 
      'Return QC Pending',
      'Returned',
      'Return Rejected',
      'Refund Initiated',
      'Refunded'
    ].includes(o.status || '')
  );


  // Address CRUD States
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [addrName, setAddrName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPin, setAddrPin] = useState("");
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  const loadAddresses = async () => {
    setLoadingAddresses(true);
    const res = await getUserAddressesAction();
    if (res.success && res.addresses) {
      setAddresses(res.addresses);
    }
    setLoadingAddresses(false);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const res = await updateProfileAction(editName, editPhone);
      if (res.success) {
        setName(editName);
        setPhone(editPhone);
        setIsEditing(false);
        setProfileSuccess("Profile updated successfully!");
        useToastStore.getState().addToast("✓ Profile updated successfully!");
        setTimeout(() => setProfileSuccess(null), 4000);
      } else {
        setProfileError(res.error || "Failed to update profile");
      }
    } catch (err: any) {
      setProfileError(err.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditAddressClick = (address: UserAddress) => {
    setEditingAddress(address);
    setIsAddingAddress(false);
    setAddrName(address.name || "");
    setAddrPhone(address.phone || "");
    setAddrLine1(address.address_line_1 || "");
    setAddrLine2(address.address_line_2 || "");
    setAddrCity(address.city || "");
    setAddrState(address.state || "");
    setAddrPin(address.postal_code || "");
    setAddrIsDefault(address.is_default || false);
    setAddrError(null);
  };

  const handleAddAddressClick = () => {
    setIsAddingAddress(true);
    setEditingAddress(null);
    setAddrName("");
    setAddrPhone("");
    setAddrLine1("");
    setAddrLine2("");
    setAddrCity("");
    setAddrState("");
    setAddrPin("");
    setAddrIsDefault(false);
    setAddrError(null);
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrSaving(true);
    setAddrError(null);

    const payload: Partial<UserAddress> = {
      id: editingAddress?.id,
      name: addrName.trim(),
      phone: addrPhone.trim(),
      address_line_1: addrLine1.trim(),
      address_line_2: addrLine2.trim(),
      city: addrCity.trim(),
      state: addrState.trim(),
      postal_code: addrPin.trim(),
      is_default: addrIsDefault,
      country: "India",
    };

    try {
      const res = await saveUserAddressAction(payload);
      if (res.success) {
        useToastStore.getState().addToast(
          editingAddress ? "✓ Address updated successfully" : "✓ Address added successfully"
        );
        setIsAddingAddress(false);
        setEditingAddress(null);
        await loadAddresses();
      } else {
        setAddrError(res.error || "Failed to save address");
      }
    } catch (err: any) {
      setAddrError(err.message || "An error occurred while saving the address");
    } finally {
      setAddrSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (window.confirm("Delete this address? This cannot be undone.")) {
      try {
        const res = await deleteUserAddressAction(addressId);
        if (res.success) {
          useToastStore.getState().addToast("✓ Address deleted successfully");
          await loadAddresses();
        } else {
          useToastStore.getState().addToast(`❌ Delete failed: ${res.error}`);
        }
      } catch (err: any) {
        useToastStore.getState().addToast(`❌ Delete failed: ${err.message}`);
      }
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      const res = await setDefaultUserAddressAction(id);
      if (res.success) {
        useToastStore.getState().addToast("✓ Default address updated");
        await loadAddresses();
      } else {
        useToastStore.getState().addToast(`❌ Failed to set default: ${res.error}`);
      }
    } catch (err: any) {
      useToastStore.getState().addToast(`❌ Failed to set default: ${err.message}`);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#loyalty") {
      setActiveTab("loyalty");
    }
    const fetchPending = async () => {
      const res = await getPendingPointsAction();
      if (res.success && res.pendingPoints !== undefined) {
        setPendingPoints(res.pendingPoints);
        if ((res as any).pendingDetails) {
          setPendingDetails((res as any).pendingDetails);
        }
      }
    };
    fetchPending();
  }, []);

  const refreshProfileData = async () => {
    const res = await getProfileDataAction();
    if (res.success && res.data) {
      setWalletBalance(res.data.walletBalance);
      setWalletTxs(res.data.walletTxs);
      setLoyaltyPoints(res.data.loyaltyPoints);
      setLoyaltyTxs(res.data.loyaltyTxs);
      setRecentOrders(res.data.recentOrders);
      if (res.data.allOrders) {
        setAllOrders(res.data.allOrders);
      }
    }
    const pendingRes = await getPendingPointsAction();
    if (pendingRes.success && pendingRes.pendingPoints !== undefined) {
      setPendingPoints(pendingRes.pendingPoints);
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    router.refresh();
    router.push("/login");
  };

  const handleTabSwitch = (tabName: "profile" | "loyalty" | "wishlist" | "returns") => {
    setTabLoading(true);
    setActiveTab(tabName);
    setSidebarOpen(false);
    setTimeout(() => setTabLoading(false), 300);
  };

  if (isLoading) {
    return (
      <div className="layout-container flex h-full grow flex-col max-w-7xl mx-auto w-full flex-grow py-10 px-6">
        <div className="animate-pulse space-y-8 w-full">
          <div className="h-10 bg-neutral-200 w-1/4 rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 h-64 bg-neutral-200 rounded-[1.5rem]"></div>
            <div className="lg:col-span-2 space-y-6">
              <div className="h-40 bg-neutral-200 rounded-[1.5rem]"></div>
              <div className="h-40 bg-neutral-200 rounded-[1.5rem]"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <button onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" className="p-2 bg-transparent border-none">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Profile Avatar */}
          <div className="flex gap-4 items-center mb-6">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-none bg-cover bg-center border border-secondary flex items-center justify-center bg-black text-[#fed488] font-bold text-xl"
            >
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold uppercase text-sm sm:text-base">{name}</h3>
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

            <button
              onClick={() => handleTabSwitch("wishlist")}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-left rounded-none border-none ${
                activeTab === "wishlist" ? "bg-black text-white" : "hover:bg-gray-100 bg-transparent text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">favorite</span>
              My Wishlist
            </button>

            <button
              onClick={() => handleTabSwitch("returns")}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-left rounded-none border-none ${
                activeTab === "returns" ? "bg-black text-white" : "hover:bg-gray-100 bg-transparent text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">keyboard_return</span>
              Returns
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

          {tabLoading ? (
            <div className="animate-pulse space-y-4 p-4">
              <div className="h-12 bg-gray-100 rounded-xl"/>
              <div className="h-12 bg-gray-100 rounded-xl"/>
              <div className="h-12 bg-gray-100 rounded-xl"/>
            </div>
          ) : (
            <>
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
                  {!isEditing && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setEditName(name);
                        setEditPhone(phone);
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      className="p-1 text-secondary bg-transparent border-none cursor-pointer hover:text-black flex items-center justify-center transition-colors"
                      title="Edit Profile"
                      aria-label="Edit Profile"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                  )}
                </div>

                {profileError && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
                    {profileError}
                  </div>
                )}
                {profileSuccess && (
                  <div className="p-4 bg-[#775a19]/10 border border-[#775a19]/20 text-[#775a19] text-xs font-bold uppercase tracking-wider animate-fade-in">
                    {profileSuccess}
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={handleProfileSave} className="flex flex-col gap-4 max-w-xl">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Full Name</label>
                      <input
                        required
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface transition-all duration-300"
                        placeholder="Full Name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Phone Number</label>
                      <input
                        required
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface transition-all duration-300"
                        placeholder="Phone Number"
                      />
                    </div>
                    <div className="space-y-1.5 opacity-60">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Email Address (Read-only)</label>
                      <input
                        disabled
                        type="email"
                        value={userEmail}
                        className="w-full px-4 py-3 bg-gray-50 border border-outline-variant/20 text-xs font-bold uppercase tracking-wider outline-none rounded-none text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div className="flex gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setProfileError(null);
                        }}
                        className="flex-1 py-3 border border-outline-variant/40 text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-gray-50 rounded-none transition-colors cursor-pointer bg-transparent"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 py-3 bg-black hover:bg-[#fed488] hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-none transition-all cursor-pointer flex items-center justify-center gap-2 border-none shadow-sm"
                      >
                        {isSaving ? "Saving..." : "Save Details"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Full Name</p>
                      <p className="text-on-surface font-headline font-bold text-lg uppercase">{name}</p>
                    </div>
                    <div>
                      <p className="text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Contact Details</p>
                      <p className="text-on-surface font-body text-sm">{phone || "Not Provided"}</p>
                      <p className="text-on-surface font-body text-sm">{userEmail}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Address Book Section */}
              <section className="bg-white border border-outline-variant/20 p-8 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-4">
                  <h4 className="text-on-surface font-bold text-xs tracking-widest uppercase">Saved Addresses</h4>
                  {!isAddingAddress && !editingAddress && (
                    <button
                      onClick={handleAddAddressClick}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#775a19]/80 bg-transparent border-none cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add</span> Add Address
                    </button>
                  )}
                </div>

                {(isAddingAddress || editingAddress) ? (
                  <form onSubmit={handleAddressSubmit} className="flex flex-col gap-4 max-w-xl">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-neutral-900">
                      {editingAddress ? "Edit Address" : "New Address"}
                    </h5>
                    
                    {addrError && (
                      <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
                        {addrError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Full Name</label>
                      <input
                        required
                        type="text"
                        value={addrName}
                        onChange={(e) => setAddrName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                        placeholder="ENTER FULL NAME"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Phone Number</label>
                      <input
                        required
                        type="text"
                        value={addrPhone}
                        onChange={(e) => setAddrPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                        placeholder="ENTER PHONE NUMBER"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Address Line 1</label>
                      <input
                        required
                        type="text"
                        value={addrLine1}
                        onChange={(e) => setAddrLine1(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                        placeholder="HOUSE/FLAT NO, STREET, AREA"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        value={addrLine2}
                        onChange={(e) => setAddrLine2(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                        placeholder="LOCALITY / LANDMARK"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">City</label>
                        <input
                          required
                          type="text"
                          value={addrCity}
                          onChange={(e) => setAddrCity(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                          placeholder="CITY"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">Pin Code</label>
                        <input
                          required
                          type="text"
                          value={addrPin}
                          onChange={(e) => setAddrPin(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                          placeholder="PIN CODE"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-outline">State</label>
                      <input
                        required
                        type="text"
                        value={addrState}
                        onChange={(e) => setAddrState(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 focus:border-[#fed488] text-xs font-bold uppercase tracking-wider outline-none rounded-none text-on-surface"
                        placeholder="STATE"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="is_default_profile"
                        checked={addrIsDefault}
                        onChange={(e) => setAddrIsDefault(e.target.checked)}
                        className="w-4 h-4 accent-[#775a19]"
                      />
                      <label htmlFor="is_default_profile" className="font-bold cursor-pointer select-none text-[10px] tracking-wider text-on-surface/85 uppercase">
                        Set as Default Address
                      </label>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingAddress(false);
                          setEditingAddress(null);
                        }}
                        className="flex-1 py-3 border border-outline-variant/40 text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-gray-50 rounded-none transition-colors cursor-pointer bg-transparent"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addrSaving}
                        className="flex-1 py-3 bg-black hover:bg-[#fed488] hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-none transition-all cursor-pointer border-none shadow-sm flex items-center justify-center"
                      >
                        {addrSaving ? "Saving..." : "Save Address"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4">
                    {loadingAddresses ? (
                      <p className="text-xs text-outline italic animate-pulse">Loading addresses...</p>
                    ) : addresses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-surface-container-lowest/30 border border-dashed border-outline-variant/30 text-center gap-3 animate-fade-in">
                        <p className="text-xs text-outline font-semibold uppercase tracking-wider">
                          No saved addresses yet. Add an address to speed up checkout.
                        </p>
                        <button
                          onClick={handleAddAddressClick}
                          className="px-6 py-2.5 bg-black hover:bg-[#fed488] hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-none border-none transition-all cursor-pointer"
                        >
                          + Add Address
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {addresses.map((address) => (
                          <div
                            key={address.id}
                            className={`p-6 border flex flex-col justify-between transition-all rounded-none ${
                              address.is_default
                                ? "bg-white border-[#775a19] shadow-[0_0_15px_rgba(119,90,25,0.08)]"
                                : "bg-white border-outline-variant/30 hover:border-outline-variant/80"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-neutral-950">
                                  {address.name}
                                </h5>
                                {address.is_default && (
                                  <span className="bg-[#775a19] text-white text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-none">
                                    DEFAULT
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-semibold tracking-wide text-neutral-700 uppercase leading-relaxed">
                                {address.address_line_1}
                                {address.address_line_2 && <>, {address.address_line_2}</>}
                              </p>
                              <p className="text-[10px] font-semibold tracking-wide text-neutral-700 uppercase leading-relaxed">
                                {address.city}, {address.state} - {address.postal_code}
                              </p>
                              <p className="text-[10px] font-bold tracking-wide text-neutral-850 uppercase mt-3">
                                Phone: {address.phone}
                              </p>
                            </div>

                            <div className="flex gap-4 mt-6 pt-4 border-t border-outline-variant/10 text-xs font-bold uppercase tracking-widest">
                              <button
                                onClick={() => handleEditAddressClick(address)}
                                className="text-[9px] font-black uppercase tracking-widest text-[#775a19] hover:text-black transition-colors bg-transparent border-none cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAddress(address.id)}
                                className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors bg-transparent border-none cursor-pointer"
                              >
                                Delete
                              </button>
                              {!address.is_default && (
                                <button
                                  onClick={() => handleSetDefaultAddress(address.id)}
                                  className="ml-auto text-[9px] font-black uppercase tracking-widest text-outline hover:text-black transition-colors bg-transparent border-none cursor-pointer"
                                >
                                  Set Default
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Recent Orders Overview */}
              <section className="flex flex-col gap-6">
                <div className="flex justify-between items-end border-b border-on-surface pb-4">
                  <h2 className="text-on-surface text-2xl font-headline font-bold uppercase tracking-tight">Recent Orders</h2>
                  <Link className="text-secondary text-xs font-bold uppercase tracking-widest border-b border-secondary" href="/orderhistory">
                    View All Orders
                  </Link>
                </div>
                {/* Mobile card layout (md:hidden) */}
                <div className="md:hidden space-y-3 mb-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} 
                      className="bg-white border border-gray-100 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-xs font-bold">#{order.id}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                          {order.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">
                          {order.date}
                        </span>
                        <span className="text-sm font-bold">
                          ₹{order.total?.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto bg-white border border-outline-variant/15">
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
                              <span className="inline-block px-2 py-0.5 border border-outline-variant/20 bg-surface-container-low text-[11px] font-bold uppercase tracking-widest">
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

                <div className="mt-4 text-center">
                  <a href="/orderhistory"
                    className="text-sm text-gray-600 
                      hover:text-black underline 
                      underline-offset-2 transition-colors">
                    View all orders →
                  </a>
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
                        {loyaltyPoints.toLocaleString()} pts
                      </h3>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-3xl">workspace_premium</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-outline leading-relaxed uppercase tracking-wider font-semibold opacity-70">
                      Earn: ₹100 spent = 5 pts &nbsp;|&nbsp; Redeem: 100 pts = ₹50 &nbsp;|&nbsp; Valid: 12 months
                    </p>
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                      Redemption value: ₹{(loyaltyPoints * 0.5).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <div className="pt-4 border-t border-outline-variant/10 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">Available Points</p>
                        <p className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
                          Points you can redeem immediately: <span className="font-bold text-secondary">{loyaltyPoints.toLocaleString()} PTS</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">Pending Points Hold</p>
                        {pendingPoints > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide animate-pulse">
                              Total Pending: +{pendingPoints} PTS (Waiting for return window to expire)
                            </p>
                            <div className="bg-orange-500/5 border border-orange-500/10 p-3 space-y-2 mt-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 border-b border-neutral-200/50 pb-1">Pending Breakdown</p>
                              {pendingDetails.map((item, idx) => {
                                const availDate = item.availableOn ? new Date(item.availableOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "N/A";
                                return (
                                  <div key={idx} className="flex justify-between items-center text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">
                                    <span>Order #{item.id}</span>
                                    <span>+{item.points} pts (Available on {availDate})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-neutral-500 italic uppercase tracking-wider">
                            No pending loyalty rewards.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 30-day expiry warning */}
                    {(() => {
                      const soonExpiring = loyaltyTxs
                        .filter(t => t.type === "credit" && t.expiresAt && new Date(t.expiresAt) > new Date())
                        .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];
                      if (!soonExpiring) return null;
                      const daysLeft = Math.ceil((new Date(soonExpiring.expiresAt!).getTime() - Date.now()) / 86400000);
                      if (daysLeft > 30) return null;
                      return (
                        <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 mt-2 uppercase tracking-wider font-bold">
                          ⚠️ {soonExpiring.points} pts expire in {daysLeft} day{daysLeft !== 1 ? "s" : ""}!
                        </div>
                      );
                    })()}
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
                  <div className="overflow-x-auto w-full relative -mx-4 px-4 bg-white border border-outline-variant/25 rounded-none">
                    {/* Add scroll fade indicator */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden" />
                    <table className="w-full text-left border-collapse table-fixed min-w-[500px]">
                      <colgroup>
                        <col className="w-[25%]" />
                        <col className="w-[55%]" />
                        <col className="w-[20%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant/10">
                          <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-outline">Date</th>
                          <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-outline">Details</th>
                          <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-outline text-right">Amount</th>
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
                              <td className="p-4 text-outline font-semibold truncate">{tx.date}</td>
                              <td className="p-4 font-bold uppercase tracking-tight truncate">{tx.description}</td>
                              <td className={`p-4 text-right font-bold ${tx.type === "credit" ? "text-green-700" : "text-red-700"} truncate`}>
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
                  <div className="overflow-x-auto w-full relative -mx-4 px-4 bg-white border border-outline-variant/25 rounded-none">
                    {/* Add scroll fade indicator */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden" />
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant/10">
                          <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-outline">Date</th>
                          <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-outline">Details</th>
                          <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-outline text-right">Points</th>
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
                              <td className="p-4">
                                <p className="font-bold uppercase tracking-tight">{tx.description}</p>
                                {/* Show expiry date on credit rows */}
                                {tx.type === "credit" && tx.expiresAt && (
                                  <p className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${
                                    new Date(tx.expiresAt) < new Date()
                                      ? "text-red-500"
                                      : Math.ceil((new Date(tx.expiresAt).getTime() - Date.now()) / 86400000) <= 30
                                      ? "text-amber-600"
                                      : "text-outline opacity-60"
                                  }`}>
                                    {new Date(tx.expiresAt) < new Date()
                                      ? "Expired"
                                      : `Expires: ${new Date(tx.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                    }
                                  </p>
                                )}
                              </td>
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

          {/* TAB 3: WISHLIST */}
          {activeTab === "wishlist" && (
            <div className="flex flex-col gap-12 animate-fade-in">
              <div className="flex flex-col gap-2 border-l-4 border-secondary pl-6">
                <p className="text-secondary text-xs font-bold tracking-[0.3em] uppercase">Your Favorites</p>
                <h1 className="text-on-surface text-5xl font-headline font-extrabold tracking-tighter">MY WISHLIST</h1>
              </div>

              {displayWishlistItems.length === 0 && (
                <div className="text-center py-16 px-6 border border-dashed border-outline-variant/30 bg-surface-container-lowest/30">
                  <div className="text-4xl mb-4">🖤</div>
                  <h3 className="font-headline font-black uppercase text-sm text-gray-900 mb-2 tracking-wider">
                    Your Wishlist is Empty
                  </h3>
                  <p className="text-gray-500 text-xs uppercase tracking-widest mb-6">
                    Save items you love to access them anytime
                  </p>
                  <Link
                    href="/shopallshirts"
                    className="inline-block bg-[#1a1c1c] hover:bg-[#775a19] text-white px-8 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
                  >
                    Explore Shop
                  </Link>
                </div>
              )}

              {displayWishlistItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {displayWishlistItems.map((item) => {
                    const totalStock = item.sizeStock
                      ? Object.values(item.sizeStock).reduce((sum, val) => sum + (val || 0), 0)
                      : 0;
                    const isItemOutOfStock = totalStock <= 0;

                    return (
                      <div
                        key={item.id}
                        className="group relative border border-outline-variant/20 p-3 bg-white hover:shadow-xl hover:border-secondary/40 transition-all duration-300 rounded-none flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10 rounded-none">
                            {isItemOutOfStock && (
                              <span className="absolute top-2 left-2 z-20 bg-black text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border border-white/20">
                                SOLD OUT
                              </span>
                            )}
                            <Link href={`/product/${item.slug}`} className="block w-full h-full relative">
                              <ProductImage
                                src={item.image}
                                alt={item.title}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                sizes="(max-width: 768px) 100vw, 33vw"
                              />
                            </Link>
                            {/* Remove button */}
                            <button
                              onClick={() => {
                                wishlistStore.removeFromWishlist(item.id);
                                useToastStore.getState().addToast("✓ Removed from wishlist");
                              }}
                              aria-label="Remove from wishlist"
                              className="absolute top-2 right-2 bg-black/80 p-2 rounded-none border border-white/20 text-white z-20 hover:bg-red-600 transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs font-black">close</span>
                            </button>
                          </div>
                          <div className="pt-4 px-1 pb-2">
                            <div className="flex justify-between items-start gap-3">
                              <div className="space-y-1">
                                <Link
                                  href={`/product/${item.slug}`}
                                  className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer block"
                                >
                                  {item.title}
                                </Link>
                                <p className="text-[9px] text-outline uppercase tracking-[0.2em] font-semibold">
                                  {item.category || "Signature Series"}
                                </p>
                              </div>
                              <p className="font-headline font-black text-secondary text-xs shrink-0">
                                ₹{item.price.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-outline-variant/10">
                          {isItemOutOfStock ? (
                            <button
                              disabled
                              className="w-full py-3 bg-outline-variant/20 text-outline text-[9px] font-black uppercase tracking-[0.2em] cursor-not-allowed border-none"
                            >
                              Sold Out
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const sizes: ("S" | "M" | "L" | "XL" | "XXL")[] = ["S", "M", "L", "XL", "XXL"];
                                const availableSize = sizes.find(
                                  (sz) => item.sizeStock && (item.sizeStock[sz] || 0) > 0
                                ) || "M";

                                useCartStore.getState().addToCart({
                                  productId: item.id,
                                  productName: item.title,
                                  price: item.price,
                                  size: availableSize,
                                  image: item.image,
                                  color: item.colors?.[0] || "Default",
                                }, 1);
                                useToastStore.getState().addToast(`✓ Added ${item.title} (${availableSize}) to Bag`);
                              }}
                              className="w-full py-3 bg-[#1a1c1c] text-white hover:bg-[#775a19] text-[9px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer border-none"
                            >
                              + Add to Bag
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RETURNS HISTORY */}
          {activeTab === "returns" && (
            <div className="flex flex-col gap-12 animate-fade-in">
              <div className="flex flex-col gap-2 border-l-4 border-secondary pl-6">
                <p className="text-secondary text-xs font-bold tracking-[0.3em] uppercase">Order Returns</p>
                <h1 className="text-on-surface text-5xl font-headline font-extrabold tracking-tighter">RETURN HISTORY</h1>
              </div>

              {userReturns.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📦</div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    No returns yet
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Your return requests will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userReturns.map(order => (
                    <div key={order.id}
                      className="border border-gray-200 
                        rounded-xl p-4 bg-white shadow-sm">
                      <div className="flex justify-between 
                        items-start mb-2">
                        <span className="font-mono text-sm 
                          font-bold">
                          #{order.id}
                        </span>
                        <span className="text-xs px-2 py-1 
                          rounded-full bg-amber-100 
                          text-amber-700 font-bold uppercase tracking-wider">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Reason: {order.returnReason || 'N/A'}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        Refund: ₹{order.total
                          ?.toLocaleString('en-IN')}
                        {' '}via{' '}
                        {order.refundOption === 'wallet'
                          ? 'Store Wallet'
                          : 'Bank'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
