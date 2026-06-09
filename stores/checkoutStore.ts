import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CheckoutState {
  currentStep: number;
  selectedAddressId: string | null;
  appliedCoupon: string;
  loyaltyChecked: boolean;
  walletChecked: boolean;

  setStep: (step: number) => void;
  setAddressId: (id: string | null) => void;
  setCoupon: (code: string) => void;
  setLoyaltyChecked: (checked: boolean) => void;
  setWalletChecked: (checked: boolean) => void;
  resetCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      currentStep: 1,
      selectedAddressId: null,
      appliedCoupon: "",
      loyaltyChecked: false,
      walletChecked: false,

      setStep: (step) => set({ currentStep: step }),
      setAddressId: (id) => set({ selectedAddressId: id }),
      setCoupon: (code) => set({ appliedCoupon: code }),
      setLoyaltyChecked: (checked) => set({ loyaltyChecked: checked }),
      setWalletChecked: (checked) => set({ walletChecked: checked }),
      
      resetCheckout: () => set({
        currentStep: 1,
        selectedAddressId: null,
        appliedCoupon: "",
        loyaltyChecked: false,
        walletChecked: false,
      }),
    }),
    {
      name: "checkout-storage",
    }
  )
);
