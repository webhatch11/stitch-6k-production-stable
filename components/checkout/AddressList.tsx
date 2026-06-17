"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { UserAddress } from "@/lib/registry";
import { getUserAddressesAction, saveUserAddressAction, deleteUserAddressAction, setDefaultUserAddressAction } from "@/app/actions/addresses";
import { useCheckoutStore } from "@/stores/checkoutStore";
import { useToastStore } from "@/stores/toastStore";
import { AddressFormModal } from "./AddressFormModal";
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
          ? "bg-[#fed488]/10 border-[#fed488] shadow-[0_0_20px_rgba(254,212,136,0.2)] focus:ring-2 focus:ring-[#fed488]"
          : "bg-white/30 border-outline-variant/20 hover:border-outline-variant/50 focus:bg-white/50 focus:border-outline-variant/50"
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
              : "border-outline-variant/50"
          }`}
        >
          {isSelected && <span className="w-2 h-2 bg-white rounded-full"></span>}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-on-surface">
            {address.name}
          </h4>
          {address.is_default && (
            <span className="bg-[#775a19] text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm">
              DEFAULT
            </span>
          )}
        </div>

        <p className="text-[10px] font-semibold tracking-wide text-on-surface/80 uppercase">
          {address.address_line_1}
          {address.address_line_2 && <>, {address.address_line_2}</>}
        </p>
        <p className="text-[10px] font-semibold tracking-wide text-on-surface/80 uppercase">
          {address.city}, {address.state} - {address.postal_code}
        </p>
        <p className="text-[10px] font-bold tracking-wide text-on-surface/85 uppercase mt-2">
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Partial<UserAddress> | null>(null);

  const selectedAddressId = useCheckoutStore((state) => state.selectedAddressId);
  const setAddressId = useCheckoutStore((state) => state.setAddressId);
  const setSelectedAddress = useCheckoutStore((state) => state.setSelectedAddress);

  // Fallback Selection Priority Helper
  const determineSelection = useCallback((list: UserAddress[], targetId?: string | null): UserAddress | null => {
    if (list.length === 0) return null;

    // 1. Newly added address (passed targetId)
    if (targetId) {
      const found = list.find((a) => a.id === targetId);
      if (found) return found;
    }

    // 2. Previously selected address
    if (selectedAddressId) {
      const found = list.find((a) => a.id === selectedAddressId);
      if (found) return found;
    }

    // 3. Default address
    const defaultAddr = list.find((a) => a.is_default);
    if (defaultAddr) return defaultAddr;

    // 4. First available address
    return list[0];
  }, [selectedAddressId]);

  // Fetch addresses and apply priority rules
  const fetchAddresses = useCallback(async (selectId?: string | null) => {
    setLoading(true);
    try {
      const res = await getUserAddressesAction(userId);
      if (res.success && res.addresses) {
        setAddresses(res.addresses);
        if (onAddressCountChange) onAddressCountChange(res.addresses.length);

        const toSelect = determineSelection(res.addresses, selectId);
        if (toSelect) {
          setAddressId(toSelect.id);
          localStorage.setItem("selectedAddressId", toSelect.id);
          if (onAddressSelected) onAddressSelected(toSelect);
        } else {
          setAddressId(null);
          localStorage.removeItem("selectedAddressId");
          if (onAddressSelected) onAddressSelected(null);
        }
      }
    } catch (err) {
      console.error("[AddressList] Fetch addresses failed:", err);
      // Let parent Error Boundary handle it if fatal
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, determineSelection, setAddressId, onAddressSelected, onAddressCountChange]);

  useEffect(() => {
    fetchAddresses();
  }, [userId, fetchAddresses]);

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

  // Selection Callback Handler
  const handleSelect = useCallback((address: UserAddress) => {
    setAddressId(address.id);
    localStorage.setItem("selectedAddressId", address.id);
    if (onAddressSelected) onAddressSelected(address);
    console.log("[Analytics] address_selected", { id: address.id });
  }, [setAddressId, onAddressSelected]);

  // Keyboard accessibility handler
  const handleKeyPress = useCallback((e: React.KeyboardEvent, address: UserAddress) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(address);
    }
  }, [handleSelect]);

  // Save/Add Address Callback (with Optimistic UI updates)
  const handleSaveAddress = async (formData: Partial<UserAddress>) => {
    formData.user_id = userId;

    // Validate using client Zod schema
    const validation = addressSchema.safeParse(formData);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(". ");
      useToastStore.getState().addToast(`❌ Validation Error: ${errorMsg}`);
      throw new Error(`Validation Error: ${errorMsg}`);
    }

    // Capture backup state for potential rollback
    const previousAddresses = [...addresses];
    const previousSelectedId = selectedAddressId;

    // Generate optimistic address object
    const isNew = !formData.id;
    const tempId = formData.id || "optimistic-addr-" + Date.now();
    const optimisticAddress: UserAddress = {
      id: tempId,
      user_id: userId,
      name: formData.name || "",
      phone: formData.phone || "",
      address_line_1: formData.address_line_1 || "",
      address_line_2: formData.address_line_2 || "",
      city: formData.city || "",
      state: formData.state || "",
      postal_code: formData.postal_code || "",
      country: formData.country || "India",
      is_default: formData.is_default || false,
    };

    // Update default flags optimistically
    const optimisticList = previousAddresses.map((a) => {
      if (optimisticAddress.is_default && a.user_id === userId) {
        return { ...a, is_default: false };
      }
      return a;
    });

    // Insert or replace in optimistic list
    const index = optimisticList.findIndex((a) => a.id === tempId);
    if (index !== -1) {
      optimisticList[index] = optimisticAddress;
    } else {
      optimisticList.unshift(optimisticAddress);
    }

    // OPTIMISTIC UPDATE: Apply instantly in the UI
    setAddresses(optimisticList);
    setAddressId(tempId);
    if (onAddressSelected) onAddressSelected(optimisticAddress);
    if (onAddressCountChange) onAddressCountChange(optimisticList.length);
    setIsModalOpen(false); // Close modal instantly!
    useToastStore.getState().addToast("✓ Address saved and selected");

    // Perform API Sync
    try {
      const res = await saveUserAddressAction(formData);
      if (res.success && res.address) {
        // Fetch real database records and apply fallback select
        const listRes = await getUserAddressesAction(userId);
        if (listRes.success && listRes.addresses) {
          setAddresses(listRes.addresses);
          if (onAddressCountChange) onAddressCountChange(listRes.addresses.length);

          // Find matching DB address (by ID for edits or matching fields for additions)
          const matchedDbAddr = listRes.addresses.find(
            (a) => a.id === res.address?.id || (a.name === res.address?.name && a.address_line_1 === res.address?.address_line_1)
          );

          const finalSelect = matchedDbAddr || listRes.addresses[0];
          setAddressId(finalSelect.id);
          localStorage.setItem("selectedAddressId", finalSelect.id);
          if (onAddressSelected) onAddressSelected(finalSelect);

          console.log("[Analytics] address_added", { id: finalSelect.id, is_default: finalSelect.is_default });
        }
      } else {
        throw new Error(res.error || "Failed to save address");
      }
    } catch (err: any) {
      // Rollback Optimistic UI state on failure
      setAddresses(previousAddresses);
      setAddressId(previousSelectedId);
      if (onAddressCountChange) onAddressCountChange(previousAddresses.length);
      
      const revertedSelect = previousAddresses.find((a) => a.id === previousSelectedId) || null;
      if (onAddressSelected) onAddressSelected(revertedSelect);

      useToastStore.getState().addToast(`❌ Save Failed: ${err.message || "Please check details and try again."}`);
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
            if (onAddressCountChange) onAddressCountChange(newList.length);

            if (newList.length === 0) {
              // Delete last address edge case: completely reset
              setAddressId(null);
              localStorage.removeItem("selectedAddressId");
              if (onAddressSelected) onAddressSelected(null);
            } else {
              // Select next fallback by priority rules
              const toSelect = determineSelection(newList);
              if (toSelect) {
                setAddressId(toSelect.id);
                localStorage.setItem("selectedAddressId", toSelect.id);
                if (onAddressSelected) onAddressSelected(toSelect);
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

  const openAddModal = useCallback(() => {
    setEditingAddress(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((address: UserAddress) => {
    setEditingAddress(address);
    setIsModalOpen(true);
  }, []);

  // Loading Skeletons
  if (loading && addresses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4 border-b border-outline-variant/20 pb-2">
          <div className="h-5 w-36 bg-white/10 rounded animate-pulse"></div>
          <div className="h-4 w-20 bg-white/10 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-outline-variant/10 bg-white/10 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-white/15 rounded"></div>
                {i === 1 && <div className="h-3.5 w-12 bg-white/15 rounded"></div>}
              </div>
              <div className="h-3 w-48 bg-white/10 rounded"></div>
              <div className="h-3 w-40 bg-white/10 rounded"></div>
              <div className="h-3 w-32 bg-white/10 rounded"></div>
              <div className="h-4 w-full bg-white/5 pt-3 border-t border-white/5 flex gap-4">
                <div className="h-3.5 w-8 bg-white/10 rounded"></div>
                <div className="h-3.5 w-10 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b border-outline-variant/20 pb-2">
        <h3 className="text-sm font-headline font-black tracking-widest uppercase text-on-surface">
          Saved Addresses
        </h3>
        <button
          onClick={openAddModal}
          className="text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#fed488] transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">add</span> Add New
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-10 bg-white/20 border border-outline-variant/20 rounded-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
            No saved addresses found.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 border border-[#775a19] text-[#775a19] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#775a19] hover:text-white transition-all bg-transparent cursor-pointer"
          >
            Add Address
          </button>
        </div>
      ) : (
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
      )}

      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={editingAddress}
        onSave={handleSaveAddress}
      />
    </div>
  );
}
