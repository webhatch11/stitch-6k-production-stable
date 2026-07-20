import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/lib/types";

interface RecentState {
  recentItems: Product[];
  addProductToRecent: (product: Product) => void;
  reconcileRecent: (validProducts: Product[]) => void;
  clearRecent: () => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      recentItems: [],

      addProductToRecent: (product) => {
        set((state) => {
          // Remove duplicates
          const filtered = state.recentItems.filter((item) => item.id !== product.id);
          // Keep only the last 10 items
          const updated = [product, ...filtered].slice(0, 10);
          return { recentItems: updated };
        });
      },

      reconcileRecent: (validProducts) => {
        if (!validProducts || validProducts.length === 0) return;
        set((state) => {
          const idMap = new Map(validProducts.map((p) => [p.id, p]));
          const slugMap = new Map(validProducts.map((p) => [p.slug, p]));
          const updatedRecent: Product[] = [];
          
          for (const item of state.recentItems) {
            const freshProduct = idMap.get(item.id) || (item.slug ? slugMap.get(item.slug) : undefined);
            if (freshProduct) {
              updatedRecent.push(freshProduct);
            }
          }

          return { recentItems: updatedRecent };
        });
      },

      clearRecent: () => {
        set({ recentItems: [] });
      },
    }),
    {
      name: "recently-viewed-storage",
    }
  )
);
