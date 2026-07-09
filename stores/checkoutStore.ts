import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserAddress } from "@/lib/types";
import { useState, useEffect } from "react";

export interface CheckoutState {
  currentStep: number;
  selectedAddress: UserAddress | null;
  selectedAddressId: string | null;
  couponCode: string;
  couponMessage: { text: string; isError: boolean };
  appliedDiscount: number;
  appliedCouponCode: string;
  loyaltyChecked: boolean;
  walletChecked: boolean;
  shippingSelection: string;
  idempotencyKey: string;

  setStep: (step: number) => void;
  setSelectedAddress: (address: UserAddress | null) => void;
  setAddressId: (id: string | null) => void;
  setCouponCode: (code: string) => void;
  setCouponMessage: (message: { text: string; isError: boolean }) => void;
  setAppliedDiscount: (discount: number) => void;
  setAppliedCouponCode: (code: string) => void;
  setLoyaltyChecked: (checked: boolean) => void;
  setWalletChecked: (checked: boolean) => void;
  setShippingSelection: (selection: string) => void;
  setIdempotencyKey: (key: string) => void;
  resetCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      currentStep: 1,
      selectedAddress: null,
      selectedAddressId: null,
      couponCode: "",
      couponMessage: { text: "", isError: false },
      appliedDiscount: 0,
      appliedCouponCode: "",
      loyaltyChecked: false,
      walletChecked: false,
      shippingSelection: "standard",
      idempotencyKey: "",

      setStep: (step) => set({ currentStep: step }),
      setSelectedAddress: (address) => set({ selectedAddress: address, selectedAddressId: address ? address.id : null }),
      setAddressId: (id) => set({ selectedAddressId: id }),
      setCouponCode: (code) => set({ couponCode: code }),
      setCouponMessage: (message) => set({ couponMessage: message }),
      setAppliedDiscount: (discount) => set({ appliedDiscount: discount }),
      setAppliedCouponCode: (code) => set({ appliedCouponCode: code }),
      setLoyaltyChecked: (checked) => set({ loyaltyChecked: checked }),
      setWalletChecked: (checked) => set({ walletChecked: checked }),
      setShippingSelection: (selection) => set({ shippingSelection: selection }),
      setIdempotencyKey: (key) => set({ idempotencyKey: key }),
      
      resetCheckout: () => set({
        currentStep: 1,
        selectedAddress: null,
        selectedAddressId: null,
        couponCode: "",
        couponMessage: { text: "", isError: false },
        appliedDiscount: 0,
        appliedCouponCode: "",
        loyaltyChecked: false,
        walletChecked: false,
        shippingSelection: "standard",
        idempotencyKey: "",
      }),
    }),
    {
      name: "checkout-storage",
    }
  )
);

// Hydration-safe hook wrapper to prevent SSR mismatches
export function useHydratedCheckoutStore<T>(selector: (state: CheckoutState) => T, fallback: T): T {
  const storeValue = useCheckoutStore(selector);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated ? storeValue : fallback;
}
