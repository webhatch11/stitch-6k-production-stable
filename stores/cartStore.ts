import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId?: string;
  productName: string;
  price: number;
  size: string;
  image: string;
  color?: string;
}

interface CartState {
  cartItems: CartItem[];
  addToCart: (item: CartItem, quantity: number) => void;
  removeFromCart: (productName: string, size: string, color: string) => void;
  decrementQuantity: (productName: string, size: string, color: string) => void;
  incrementQuantity: (productName: string, size: string, color: string, maxStock?: number) => boolean;
  clearCart: () => void;
  getCartCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],
      
      addToCart: (item, quantity) => {
        set((state) => {
          const newItems = [...state.cartItems];
          for (let i = 0; i < quantity; i++) {
            newItems.push({ ...item });
          }
          return { cartItems: newItems };
        });
      },

      removeFromCart: (productName, size, color) => {
        set((state) => ({
          cartItems: state.cartItems.filter(
            (item) =>
              !(
                item.productName === productName &&
                item.size === size &&
                (item.color || "Atelier Choice") === (color || "Atelier Choice")
              )
          ),
        }));
      },

      decrementQuantity: (productName, size, color) => {
        set((state) => {
          const idx = state.cartItems.findIndex(
            (item) =>
              item.productName === productName &&
              item.size === size &&
              (item.color || "Atelier Choice") === (color || "Atelier Choice")
          );
          if (idx === -1) return {};
          const newItems = [...state.cartItems];
          newItems.splice(idx, 1);
          return { cartItems: newItems };
        });
      },

      incrementQuantity: (productName, size, color, maxStock = 999) => {
        const state = get();
        const currentQty = state.cartItems.filter(
          (item) =>
            item.productName === productName &&
            item.size === size &&
            (item.color || "Atelier Choice") === (color || "Atelier Choice")
        ).length;

        if (currentQty >= maxStock) {
          return false;
        }

        const templateItem = state.cartItems.find(
          (item) =>
            item.productName === productName &&
            item.size === size &&
            (item.color || "Atelier Choice") === (color || "Atelier Choice")
        );

        if (!templateItem) return false;

        set((state) => ({
          cartItems: [...state.cartItems, { ...templateItem }]
        }));
        return true;
      },

      clearCart: () => {
        set({ cartItems: [] });
      },

      getCartCount: () => {
        return get().cartItems.length;
      },
    }),
    {
      name: "cart-storage", // stored under localStorage key 'cart-storage' automatically by Zustand persist
    }
  )
);
