"use client";

import React, { useEffect, useState } from "react";
import { UserAddress } from "@/lib/registry";
import { getUserAddressesAction, saveUserAddressAction, deleteUserAddressAction, setDefaultUserAddressAction } from "@/app/actions/addresses";
import { useCheckoutStore } from "@/stores/checkoutStore";
import { AddressFormModal } from "./AddressFormModal";

interface Props {
  userId: string;
  onAddressSelected?: (address: UserAddress) => void;
}

export function AddressList({ userId, onAddressSelected }: Props) {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Partial<UserAddress> | null>(null);

  const selectedAddressId = useCheckoutStore((state) => state.selectedAddressId);
  const setAddressId = useCheckoutStore((state) => state.setAddressId);

  useEffect(() => {
    fetchAddresses();
  }, [userId]);

  const fetchAddresses = async () => {
    setLoading(true);
    const res = await getUserAddressesAction(userId);
    if (res.success && res.addresses) {
      setAddresses(res.addresses);
      // Auto-select default address if none is selected
      if (!selectedAddressId && res.addresses.length > 0) {
        const defaultAddr = res.addresses.find(a => a.is_default) || res.addresses[0];
        setAddressId(defaultAddr.id);
        if (onAddressSelected) onAddressSelected(defaultAddr);
      } else if (selectedAddressId) {
        const addr = res.addresses.find(a => a.id === selectedAddressId);
        if (addr && onAddressSelected) onAddressSelected(addr);
      }
    }
    setLoading(false);
  };

  const handleSaveAddress = async (formData: Partial<UserAddress>) => {
    formData.user_id = userId;
    const res = await saveUserAddressAction(formData);
    if (res.success && res.address) {
      await fetchAddresses();
      setAddressId(res.address.id);
      if (onAddressSelected) onAddressSelected(res.address);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this address?")) {
      const res = await deleteUserAddressAction(id, userId);
      if (res.success) {
        if (selectedAddressId === id) {
          setAddressId(null);
        }
        await fetchAddresses();
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await setDefaultUserAddressAction(id, userId);
    if (res.success) {
      await fetchAddresses();
    }
  };

  const handleSelect = (address: UserAddress) => {
    setAddressId(address.id);
    if (onAddressSelected) onAddressSelected(address);
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (address: UserAddress) => {
    setEditingAddress(address);
    setIsModalOpen(true);
  };

  if (loading) {
    return <div className="text-[10px] font-bold uppercase tracking-widest text-outline animate-pulse">Loading Addresses...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b border-outline-variant/20 pb-2">
        <h3 className="text-sm font-headline font-black tracking-widest uppercase text-on-surface">Saved Addresses</h3>
        <button
          onClick={openAddModal}
          className="text-[10px] font-black uppercase tracking-widest text-[#775a19] hover:text-[#fed488] transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">add</span> Add New
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-8 bg-white/20 border border-outline-variant/20 rounded-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">No saved addresses found.</p>
          <button
            onClick={openAddModal}
            className="mt-4 border border-[#775a19] text-[#775a19] px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#775a19] hover:text-white transition-all"
          >
            Add Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => {
            const isSelected = selectedAddressId === address.id;
            return (
              <div
                key={address.id}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#fed488]/10 border-[#fed488] shadow-[0_0_15px_rgba(254,212,136,0.15)]"
                    : "bg-white/30 border-outline-variant/20 hover:border-outline-variant/50"
                }`}
                onClick={() => handleSelect(address)}
              >
                {/* Selection Indicator */}
                <div className="absolute top-4 right-4">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-[#775a19] bg-[#775a19]" : "border-outline-variant/50"}`}>
                    {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                  </div>
                </div>

                {address.is_default && (
                  <span className="inline-block bg-[#775a19] text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-2">
                    Default
                  </span>
                )}
                <h4 className="text-[11px] font-black uppercase tracking-wider text-on-surface mb-1">
                  {address.name}
                </h4>
                <p className="text-[10px] font-medium tracking-wide text-on-surface/80 uppercase">
                  {address.address_line_1}
                  {address.address_line_2 && <>, {address.address_line_2}</>}
                </p>
                <p className="text-[10px] font-medium tracking-wide text-on-surface/80 uppercase">
                  {address.city}, {address.state} - {address.postal_code}
                </p>
                <p className="text-[10px] font-medium tracking-wide text-on-surface/80 uppercase mt-1">
                  Phone: {address.phone}
                </p>

                <div className="flex gap-4 mt-4 pt-3 border-t border-outline-variant/10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(address);
                    }}
                    className="text-[9px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(address.id);
                    }}
                    className="text-[9px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                  >
                    Delete
                  </button>
                  {!address.is_default && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(address.id);
                      }}
                      className="ml-auto text-[9px] font-bold uppercase tracking-widest text-outline hover:text-secondary transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
