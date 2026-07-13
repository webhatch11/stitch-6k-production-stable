import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/lib/types";

interface RecentState {
  recentItems: Product[];
  addProductToRecent: (product: Product) => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      recentItems: [],

      addProductToRecent: (product) => {
        set((state) => {
          // Remove duplicates
          const filtered = state.recentItems.filter((item) => item.id !== product.id);
          // Keep only the last 6 items
          const updated = [product, ...filtered].slice(0, 6);
          return { recentItems: updated };
        });
      },
    }),
    {
      name: "recently-viewed-storage",
    }
  )
);
