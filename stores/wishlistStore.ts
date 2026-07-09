import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/lib/types";

interface WishlistState {
  wishlistItems: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
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
    }),
    {
      name: "wishlist-storage",
    }
  )
);
