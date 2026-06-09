"use client";

import React, { useState, useEffect } from "react";
import { UserAddress } from "@/lib/registry";

interface Props {
  address?: Partial<UserAddress> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: Partial<UserAddress>) => Promise<void>;
}

export function AddressFormModal({ address, isOpen, onClose, onSave }: Props) {
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address) {
      setFormData({ ...address });
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
  }, [address, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-outline-variant/20 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 material-symbols-outlined text-outline hover:text-primary transition-colors"
        >
          close
        </button>
        <h3 className="text-xl font-headline font-black tracking-tight uppercase text-on-surface mb-6">
          {address ? "Edit Address" : "Add New Address"}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Full Name</label>
            <input
              required
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
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
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
              placeholder="ENTER PHONE NUMBER"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Address Line 1</label>
            <input
              required
              name="address_line_1"
              value={formData.address_line_1 || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
              placeholder="HOUSE/FLAT NO, BUILDING, STREET"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Address Line 2 (Optional)</label>
            <input
              name="address_line_2"
              value={formData.address_line_2 || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
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
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
                placeholder="CITY"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8px] font-black uppercase tracking-[0.2em] text-outline">Pin Code</label>
              <input
                required
                name="postal_code"
                value={formData.postal_code || ""}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
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
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 text-[10px] font-black uppercase tracking-wider outline-none rounded-lg text-on-surface"
              placeholder="STATE"
            />
          </div>
          
          <div className="flex items-center gap-3 pt-2">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                id="is_default"
                name="is_default"
                checked={formData.is_default || false}
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
              />
              <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] flex items-center justify-center">
                <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                  check
                </span>
              </div>
            </div>
            <label htmlFor="is_default" className="font-black cursor-pointer select-none text-[10px] tracking-wider text-on-surface/80 uppercase">
              Set as Default Address
            </label>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-outline-variant/20 text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-white/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[#775a19] hover:bg-[#fed488] hover:text-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
            >
              {loading ? "Saving..." : "Save Address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
