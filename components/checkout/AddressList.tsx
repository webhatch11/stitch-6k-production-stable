"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { UserAddress } from "@/lib/types";
import { getUserAddressesAction, saveUserAddressAction, deleteUserAddressAction, setDefaultUserAddressAction } from "@/app/actions/addresses";
import { useCheckoutStore } from "@/stores/checkoutStore";
import { useToastStore } from "@/stores/toastStore";
import { addressSchema } from "@/lib/schemas/address";

// Memoized Address Card component for optimized rendering
interface CardProps {
  address: UserAddress;
  isSelected: boolean;
  onSelect: (address: UserAddress) => void;
  onEdit: (address: UserAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onKeyPress: (e: React.KeyboardEvent, address: UserAddress) => void;
}

const AddressCard = React.memo(function AddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  onKeyPress,
}: CardProps) {
  return (
    <div
      id={`address-card-${address.id}`}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      className={`relative p-5 rounded-xl border transition-all duration-300 outline-none select-none cursor-pointer flex flex-col justify-between ${
        isSelected
          ? "bg-[#fed488]/15 border-[#fed488] shadow-[0_0_20px_rgba(254,212,136,0.25)] focus:ring-2 focus:ring-[#fed488]"
          : "bg-white border-outline-variant/40 hover:border-outline-variant/80 hover:shadow-sm focus:border-outline-variant/80 focus:bg-neutral-50/50"
      }`}
      onClick={() => onSelect(address)}
      onKeyDown={(e) => onKeyPress(e, address)}
    >
      {/* Radio Selection Circle Indicator */}
      <div className="absolute top-5 right-5">
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? "border-[#775a19] bg-[#775a19]"
              : "border-outline-variant/70 bg-white"
          }`}
        >
          {isSelected && <span className="w-2 h-2 bg-white rounded-full"></span>}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-950">
            {address.name}
          </h4>
          {address.is_default && (
            <span className="bg-[#775a19] text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm">
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
        <p className="text-[10px] font-bold tracking-wide text-neutral-850 uppercase mt-2">
          Phone: {address.phone}
        </p>
      </div>

      {/* Card Actions */}
      <div className="flex gap-4 mt-6 pt-4 border-t border-outline-variant/10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(address);
          }}
          className="text-[9px] font-black uppercase tracking-widest text-secondary hover:text-[#775a19] transition-colors bg-transparent border-none cursor-pointer"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(address.id);
          }}
          className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors bg-transparent border-none cursor-pointer"
        >
          Delete
        </button>
        {!address.is_default && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetDefault(address.id);
            }}
            className="ml-auto text-[9px] font-black uppercase tracking-widest text-outline hover:text-secondary transition-colors bg-transparent border-none cursor-pointer"
          >
            Set Default
          </button>
        )}
      </div>
    </div>
  );
});

interface Props {
  userId: string;
  onAddressSelected?: (address: UserAddress | null) => void;
  onAddressCountChange?: (count: number) => void;
}

export function AddressList({ userId, onAddressSelected, onAddressCountChange }: Props) {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  
  // High Conversion View States
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Partial<UserAddress> | null>(null);

  // Form Field State
  const [formData, setFormData] = useState<Partial<UserAddress>>({
    name: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    is_default: false,
  });
  const [formLoading, setFormLoading] = useState(false);

  const selectedAddressId = useCheckoutStore((state) => state.selectedAddressId);
  const setAddressId = useCheckoutStore((state) => state.setAddressId);
  const selectedAddress = useCheckoutStore((state) => state.selectedAddress);

  // Keep references to callback props stable so they do not trigger infinite loops
  const onAddressSelectedRef = useRef(onAddressSelected);
  const onAddressCountChangeRef = useRef(onAddressCountChange);

  useEffect(() => {
    onAddressSelectedRef.current = onAddressSelected;
    onAddressCountChangeRef.current = onAddressCountChange;
  }, [onAddressSelected, onAddressCountChange]);

  // Sync form data with selected editing card
  useEffect(() => {
    if (editingAddress) {
      setFormData({ ...editingAddress });
    } else {
      setFormData({
        name: "",
        phone: "",
        address_line_1: "",
        address_line_2: "",
        city: "",
        state: "",
        postal_code: "",
        is_default: false,
      });
    }
  }, [editingAddress, isAddingInline]);

  // Fallback Selection Helper - getState keeps callback 100% stable
  const determineSelection = useCallback((list: UserAddress[], targetId?: string | null): UserAddress | null => {
    if (list.length === 0) return null;
    const activeSelectedId = useCheckoutStore.getState().selectedAddressId;

    if (targetId) {
      const found = list.find((a) => a.id === targetId);
      if (found) return found;
    }

    if (activeSelectedId) {
      const found = list.find((a) => a.id === activeSelectedId);
      if (found) return found;
    }

    const defaultAddr = list.find((a) => a.is_default);
    if (defaultAddr) return defaultAddr;

    return list[0];
  }, []);

  // Fetch addresses and apply priority rules
  const fetchAddresses = useCallback(async (selectId?: string | null) => {
    setLoading(true);
    try {
      const res = await getUserAddressesAction(userId);
      if (res.success && res.addresses) {
        const validAddresses = res.addresses.filter(
          (a) => a && a.id && a.name && a.address_line_1 && a.city && a.state && a.postal_code
        );
        setAddresses(validAddresses);
        if (onAddressCountChangeRef.current) onAddressCountChangeRef.current(validAddresses.length);

        const toSelect = determineSelection(validAddresses, selectId);
        if (toSelect) {
          setAddressId(toSelect.id);
          localStorage.setItem("selectedAddressId", toSelect.id);
          if (onAddressSelectedRef.current) onAddressSelectedRef.current(toSelect);
        } else {
          setAddressId(null);
          localStorage.removeItem("selectedAddressId");
          if (onAddressSelectedRef.current) onAddressSelectedRef.current(null);
        }
      }
    } catch (err) {
      console.error("[AddressList] Fetch addresses failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, determineSelection, setAddressId]);

  useEffect(() => {
    fetchAddresses();
  }, [userId, fetchAddresses]);

  // Synchronization effect to ensure selectedAddress and selectedAddressId stay in sync
  useEffect(() => {
    if (addresses.length > 0) {
      if (selectedAddressId) {
        const matchingAddress = addresses.find((a) => a.id === selectedAddressId);
        if (matchingAddress) {
          if (!selectedAddress || selectedAddress.id !== matchingAddress.id || JSON.stringify(selectedAddress) !== JSON.stringify(matchingAddress)) {
            if (onAddressSelectedRef.current) onAddressSelectedRef.current(matchingAddress);
          }
        } else {
          const fallback = determineSelection(addresses);
          if (onAddressSelectedRef.current) onAddressSelectedRef.current(fallback);
        }
      } else {
        if (selectedAddress) {
          if (onAddressSelectedRef.current) onAddressSelectedRef.current(null);
        }
      }
    } else {
      if (selectedAddressId || selectedAddress) {
        setAddressId(null);
        if (onAddressSelectedRef.current) onAddressSelectedRef.current(null);
      }
    }
  }, [selectedAddressId, selectedAddress, addresses, setAddressId, determineSelection]);

  // Auto-scroll to selected card
  useEffect(() => {
    if (selectedAddressId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`address-card-${selectedAddressId}`);
        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedAddressId]);

  // Selection Handler
  const handleSelect = useCallback((address: UserAddress) => {
    setAddressId(address.id);
    localStorage.setItem("selectedAddressId", address.id);
    if (onAddressSelectedRef.current) onAddressSelectedRef.current(address);
    setFormData({
      id: address.id,
      name: address.name || "",
      phone: address.phone || "",
      address_line_1: address.address_line_1 || "",
      address_line_2: address.address_line_2 || "",
      city: address.city || "",
      state: address.state || "",
      postal_code: address.postal_code || "",
      is_default: address.is_default || false,
    });
    console.log("[Analytics] address_selected", { id: address.id });
  }, [setAddressId]);

  // Keyboard accessibility handler
  const handleKeyPress = useCallback((e: React.KeyboardEvent, address: UserAddress) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(address);
    }
  }, [handleSelect]);

  // Save/Add Address Callback (with Optimistic UI updates)
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    const dataToSave = {
      ...formData,
      user_id: userId,
    };

    // Validate using Zod schema
    const validation = addressSchema.safeParse(dataToSave);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((issue) => issue.message).join(". ");
      useToastStore.getState().addToast(`❌ Validation Error: ${errorMsg}`);
      setFormLoading(false);
      return;
    }

    const previousAddresses = [...addresses];
    const previousSelectedId = selectedAddressId;

    const isFirstTime = previousAddresses.length === 0;
    const tempId = dataToSave.id || "optimistic-addr-" + Date.now();
    const optimisticAddress: UserAddress = {
      id: tempId,
      user_id: userId,
      name: dataToSave.name || "",
      phone: dataToSave.phone || "",
      address_line_1: dataToSave.address_line_1 || "",
      address_line_2: dataToSave.address_line_2 || "",
      city: dataToSave.city || "",
      state: dataToSave.state || "",
      postal_code: dataToSave.postal_code || "",
      country: dataToSave.country || "India",
      is_default: dataToSave.is_default || false,
    };

    const optimisticList = previousAddresses.map((a) => {
      if (optimisticAddress.is_default && a.user_id === userId) {
        return { ...a, is_default: false };
      }
      return a;
    });

    const index = optimisticList.findIndex((a) => a.id === tempId);
    if (index !== -1) {
      optimisticList[index] = optimisticAddress;
    } else {
      optimisticList.unshift(optimisticAddress);
    }

    // Apply UI Updates Optimistically
    setAddresses(optimisticList);
    setAddressId(tempId);
    if (onAddressSelectedRef.current) onAddressSelectedRef.current(optimisticAddress);
    if (onAddressCountChangeRef.current) onAddressCountChangeRef.current(optimisticList.length);
    
    setIsAddingInline(false);
    setEditingAddress(null);
    useToastStore.getState().addToast("✓ Address saved successfully.");

    // First time auto-advance to step 2
    if (isFirstTime) {
      useCheckoutStore.getState().setStep(2);
    }

    try {
      const res = await saveUserAddressAction(dataToSave);
      if (res.success && res.address) {
        const listRes = await getUserAddressesAction(userId);
        if (listRes.success && listRes.addresses) {
          const validAddresses = listRes.addresses.filter(
            (a) => a && a.id && a.name && a.address_line_1 && a.city && a.state && a.postal_code
          );
          setAddresses(validAddresses);
          if (onAddressCountChangeRef.current) onAddressCountChangeRef.current(validAddresses.length);

          const matchedDbAddr = validAddresses.find(
            (a) => a.id === res.address?.id || (a.name === res.address?.name && a.address_line_1 === res.address?.address_line_1)
          );

          const finalSelect = matchedDbAddr || validAddresses[0];
          setAddressId(finalSelect.id);
          localStorage.setItem("selectedAddressId", finalSelect.id);
          if (onAddressSelectedRef.current) onAddressSelectedRef.current(finalSelect);
        }
      } else {
        throw new Error(res.error || "Failed to save address");
      }
    } catch (err: any) {
      setAddresses(previousAddresses);
      setAddressId(previousSelectedId);
      if (onAddressCountChangeRef.current) onAddressCountChangeRef.current(previousAddresses.length);

      const revertedSelect = previousAddresses.find((a) => a.id === previousSelectedId) || null;
      if (onAddressSelectedRef.current) onAddressSelectedRef.current(revertedSelect);

      useToastStore.getState().addToast(`❌ Save Failed: ${err.message || "Please check details and try again."}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Delete Address Callback
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this address?")) {
      try {
        const res = await deleteUserAddressAction(id, userId);
        if (res.success) {
          console.log("[Analytics] address_deleted", { id });
          useToastStore.getState().addToast("✓ Address deleted");

          const listRes = await getUserAddressesAction(userId);
          if (listRes.success && listRes.addresses) {
            const newList = listRes.addresses;
            setAddresses(newList);
            if (onAddressCountChangeRef.current) onAddressCountChangeRef.current(newList.length);

            if (newList.length === 0) {
              setAddressId(null);
              localStorage.removeItem("selectedAddressId");
              if (onAddressSelectedRef.current) onAddressSelectedRef.current(null);
            } else {
              const toSelect = determineSelection(newList);
              if (toSelect) {
                setAddressId(toSelect.id);
                localStorage.setItem("selectedAddressId", toSelect.id);
                if (onAddressSelectedRef.current) onAddressSelectedRef.current(toSelect);
              }
            }
          }
        }
      } catch (err: any) {
        useToastStore.getState().addToast(`❌ Delete failed: ${err.message}`);
      }
    }
  };

  // Set Default Address Callback
  const handleSetDefault = async (id: string) => {
    try {
      const res = await setDefaultUserAddressAction(id, userId);
      if (res.success) {
        console.log("[Analytics] address_set_default", { id });
        useToastStore.getState().addToast("✓ Default address updated");
        await fetchAddresses();
      }
    } catch (err: any) {
      useToastStore.getState().addToast(`❌ Failed to update default: ${err.message}`);
    }
  };

  const handleInputChange = (field: keyof UserAddress, value: any) => {
    if (selectedAddressId && !editingAddress) {
      setAddressId(null);
      localStorage.removeItem("selectedAddressId");
      if (onAddressSelectedRef.current) onAddressSelectedRef.current(null);
      setFormData(prev => ({
        ...prev,
        id: undefined,
        [field]: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const resetForm = () => {
    setEditingAddress(null);
    setFormData({
      name: "",
      phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      postal_code: "",
      is_default: false,
    });
  };

  const openAddInline = useCallback(() => {
    resetForm();
    const element = document.getElementById("address-form-element");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const openEditModal = useCallback((address: UserAddress) => {
    setEditingAddress(address);
    setFormData({ ...address });
    const element = document.getElementById("address-form-element");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Inline address input rendering
  const renderInlineForm = () => {
    const isFirstTime = addresses.length === 0;
    return (
      <form id="address-form-element" onSubmit={handleSaveAddress} className="space-y-4 bg-white/40 border border-outline-variant/20 rounded-2xl p-6 shadow-sm">
        <h4 className="text-xs font-headline font-black uppercase tracking-wider text-neutral-900">
          {editingAddress ? `Edit Address: ${editingAddress.name}` : selectedAddressId ? "Selected Address Details" : "New Delivery Address"}
        </h4>
        
        <div className="space-y-1.5">
          <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Full Name</label>
          <input
            required
            name="name"
            value={formData.name || ""}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
            placeholder="ENTER FULL NAME"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Phone Number</label>
          <input
            required
            name="phone"
            type="tel"
            value={formData.phone || ""}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
            placeholder="ENTER 10-DIGIT MOBILE NUMBER"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Address Line 1</label>
          <input
            required
            name="address_line_1"
            value={formData.address_line_1 || ""}
            onChange={(e) => handleInputChange("address_line_1", e.target.value)}
            className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
            placeholder="HOUSE/FLAT NO, STREET, AREA"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Address Line 2 (Optional)</label>
          <input
            name="address_line_2"
            value={formData.address_line_2 || ""}
            onChange={(e) => handleInputChange("address_line_2", e.target.value)}
            className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
            placeholder="LOCALITY / LANDMARK"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">City</label>
            <input
              required
              name="city"
              value={formData.city || ""}
              onChange={(e) => handleInputChange("city", e.target.value)}
              className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
              placeholder="CITY"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Pin Code</label>
            <input
              required
              name="postal_code"
              value={formData.postal_code || ""}
              onChange={(e) => handleInputChange("postal_code", e.target.value)}
              className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
              placeholder="PIN CODE"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">State</label>
          <input
            required
            name="state"
            value={formData.state || ""}
            onChange={(e) => handleInputChange("state", e.target.value)}
            className="w-full px-4 py-3 bg-white/50 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface transition-all duration-300"
            placeholder="STATE"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              id="is_default_inline"
              checked={formData.is_default || false}
              onChange={(e) => handleInputChange("is_default", e.target.checked)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
            />
            <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] flex items-center justify-center">
              <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                check
              </span>
            </div>
          </div>
          <label htmlFor="is_default_inline" className="font-black cursor-pointer select-none text-[10px] tracking-wider text-on-surface/80 uppercase">
            Set as Default Address
          </label>
        </div>

        <div className="pt-4 flex gap-4">
          {(editingAddress || selectedAddressId) && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-3 border border-outline-variant/20 text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-white/50 rounded-lg transition-colors cursor-pointer bg-transparent"
            >
              Clear Form
            </button>
          )}
          <button
            type="submit"
            disabled={formLoading}
            className="flex-1 py-3 bg-neutral-950 hover:bg-[#fed488] hover:text-neutral-950 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-md"
          >
            {formLoading 
              ? "Saving..." 
              : isFirstTime 
                ? "Save & Continue" 
                : "Save Address"}
          </button>
        </div>
      </form>
    );
  };

  // Collapsed summary preview for returning users
  const renderSummaryView = () => {
    if (!selectedAddress) return null;
    return (
      <div className="bg-white border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sm text-[#775a19]">check_circle</span>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-950">
              Deliver to: {selectedAddress.name}
            </h4>
            {selectedAddress.is_default && (
              <span className="bg-[#775a19]/10 text-[#775a19] text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm">
                DEFAULT
              </span>
            )}
          </div>
          <p className="text-[10px] font-semibold text-neutral-700 uppercase leading-relaxed ml-6">
            {selectedAddress.address_line_1}
            {selectedAddress.address_line_2 && <>, {selectedAddress.address_line_2}</>}
            {", "}{selectedAddress.city}, {selectedAddress.state} - {selectedAddress.postal_code}
          </p>
          <p className="text-[10px] font-bold text-neutral-800 uppercase mt-1 ml-6">
            Phone: {selectedAddress.phone}
          </p>
        </div>
        
        <button
          onClick={() => setIsExpanded(true)}
          className="sm:ml-auto px-4 py-2 border border-outline-variant/60 hover:border-neutral-900 text-[9px] font-black uppercase tracking-widest text-neutral-900 transition-all rounded-lg bg-transparent cursor-pointer shrink-0 text-center"
        >
          Change Address
        </button>
      </div>
    );
  };

  // Loading Skeletons
  if (loading && addresses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4 border-b border-outline-variant/20 pb-2">
          <div className="h-5 w-36 bg-neutral-200 rounded animate-pulse"></div>
          <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-neutral-200/50 bg-neutral-100/70 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-neutral-200 rounded"></div>
                {i === 1 && <div className="h-3.5 w-12 bg-neutral-200 rounded"></div>}
              </div>
              <div className="h-3 w-48 bg-neutral-200/80 rounded"></div>
              <div className="h-3 w-40 bg-neutral-200/80 rounded"></div>
              <div className="h-3 w-32 bg-neutral-200/80 rounded"></div>
              <div className="h-4 w-full bg-neutral-100 pt-3 border-t border-neutral-200/30 flex gap-4">
                <div className="h-3.5 w-8 bg-neutral-200 rounded"></div>
                <div className="h-3.5 w-10 bg-neutral-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // First-time users see the form inline automatically
  if (addresses.length === 0) {
    return renderInlineForm();
  }

  // Collapsed default state
  if (!isExpanded) {
    return renderSummaryView();
  }

  // Expanded View
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b border-outline-variant/20 pb-2">
        <h3 className="text-sm font-headline font-black tracking-widest uppercase text-neutral-900">
          Select Delivery Address
        </h3>
      </div>

      <div role="radiogroup" aria-label="Select shipping address" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            isSelected={selectedAddressId === address.id}
            onSelect={handleSelect}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
            onKeyPress={handleKeyPress}
          />
        ))}
      </div>

      <div className="border-t border-outline-variant/20 pt-6">
        {renderInlineForm()}
      </div>

      {selectedAddress && (
        <div className="flex justify-end pt-4 border-t border-outline-variant/10">
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="px-6 py-3 bg-neutral-950 hover:bg-[#fed488] hover:text-neutral-950 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-md"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
