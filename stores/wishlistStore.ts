import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/lib/types";

interface WishlistState {
  wishlistItems: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  reconcileWishlist: (validProducts: Product[]) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlistItems: [],

      addToWishlist: (product) => {
        set((state) => {
          if (state.wishlistItems.some((item) => item.id === product.id)) {
            return {}; // Already in wishlist
          }
          return { wishlistItems: [...state.wishlistItems, product] };
        });
      },

      removeFromWishlist: (productId) => {
        set((state) => ({
          wishlistItems: state.wishlistItems.filter((item) => item.id !== productId),
        }));
      },

      isInWishlist: (productId) => {
        return get().wishlistItems.some((item) => item.id === productId);
      },

      reconcileWishlist: (validProducts) => {
        if (!validProducts || validProducts.length === 0) return;
        set((state) => {
          const validMap = new Map(validProducts.map((p) => [p.id, p]));
          const updatedWishlist: Product[] = [];
          
          for (const item of state.wishlistItems) {
            const freshProduct = validMap.get(item.id);
            if (freshProduct) {
              // Product still exists, update to fresh product details
              updatedWishlist.push(freshProduct);
            }
            // If freshProduct is undefined, item is deleted from catalog -> purged automatically!
          }

          return { wishlistItems: updatedWishlist };
        });
      },
    }),
    {
      name: "wishlist-storage",
    }
  )
);
