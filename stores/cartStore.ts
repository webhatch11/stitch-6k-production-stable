import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import { syncCartAction } from "@/app/actions/cart";

export function mergeCarts(localItems: CartItem[], dbItems: CartItem[]): CartItem[] {
  // Build a lookup map of productName -> productId to normalize missing IDs
  const nameToIdMap: Record<string, string> = {};
  for (const item of [...localItems, ...dbItems]) {
    if (item.productId && item.productId !== "unknown" && item.productName) {
      nameToIdMap[item.productName.toLowerCase()] = item.productId;
    }
  }

  const getUniqueKey = (item: CartItem) => {
    let pId = item.productId;
    if ((!pId || pId === "unknown") && item.productName) {
      pId = nameToIdMap[item.productName.toLowerCase()];
    }
    pId = pId || "unknown";
    const size = item.size || "Default";
    const color = item.color || "Default";
    return `${pId}_${size}_${color}`;
  };

  const localGrouped: Record<string, { item: CartItem; qty: number }> = {};
  for (const item of localItems) {
    const key = getUniqueKey(item);
    if (!localGrouped[key]) {
      localGrouped[key] = { item, qty: 0 };
    }
    localGrouped[key].qty += 1;
  }

  const dbGrouped: Record<string, { item: CartItem; qty: number }> = {};
  for (const item of dbItems) {
    const key = getUniqueKey(item);
    if (!dbGrouped[key]) {
      dbGrouped[key] = { item, qty: 0 };
    }
    dbGrouped[key].qty += 1;
  }

  const mergedItems: CartItem[] = [];
  const allKeys = new Set([...Object.keys(localGrouped), ...Object.keys(dbGrouped)]);

  for (const key of allKeys) {
    const localVal = localGrouped[key];
    const dbVal = dbGrouped[key];
    const item = { ...(localVal?.item || dbVal?.item) };
    
    // Normalize item's productId if it was missing
    if ((!item.productId || item.productId === "unknown") && item.productName) {
      const mappedId = nameToIdMap[item.productName.toLowerCase()];
      if (mappedId) {
        item.productId = mappedId;
      }
    }

    const qty = Math.max(localVal?.qty || 0, dbVal?.qty || 0);

    for (let i = 0; i < qty; i++) {
      mergedItems.push({ ...item });
    }
  }

  return mergedItems;
}

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

const pingCartActivity = (items: CartItem[]) => {
  if (typeof window === "undefined") return;
  const sessionId = sessionStorage.getItem("storefront_session_id");
  if (!sessionId) return;
  const cartValue = items.reduce((sum, i) => sum + (i.price || 0), 0);
  fetch("/api/analytics/cart-activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      cartCount: items.length,
      cartValue,
    }),
  }).catch(() => {});
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],
      
      addToCart: (item, quantity) => {
        const newItems = [...get().cartItems];
        for (let i = 0; i < quantity; i++) {
          newItems.push({ ...item });
        }
        set({ cartItems: newItems });
        pingCartActivity(newItems);

        const productId = item.productId || "unknown";
        const productName = item.productName || "Product";
        const price = item.price || 0;

        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "AddToCart", {
            content_ids: [productId],
            content_name: productName,
            value: price,
            currency: "INR"
          });
        }

        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "add_to_cart", {
            currency: "INR",
            value: price,
            items: [{
              item_id: productId,
              item_name: productName,
              price: price,
              quantity: 1
            }]
          });
        }

        if (supabase) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              syncCartAction(newItems).catch((err) => {
                console.error("Failed to sync DB cart on add:", err);
              });
            }
          });
        }
      },

      removeFromCart: (productName, size, color) => {
        const newItems = get().cartItems.filter(
          (item) =>
            !(
              item.productName === productName &&
              item.size === size &&
              (item.color || "Default") === (color || "Default")
            )
        );

        set({ cartItems: newItems });
        pingCartActivity(newItems);

        if (supabase) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              syncCartAction(newItems).catch((err) => {
                console.error("Failed to sync DB cart on remove:", err);
              });
            }
          });
        }
      },

      decrementQuantity: (productName, size, color) => {
        set((state) => {
          const idx = state.cartItems.findIndex(
            (item) =>
              item.productName === productName &&
              item.size === size &&
              (item.color || "Default") === (color || "Default")
          );
          if (idx === -1) return {};
          const newItems = [...state.cartItems];
          newItems.splice(idx, 1);

          if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.user) {
                syncCartAction(newItems).catch((err) => {
                  console.error("Failed to sync decremented cart to DB:", err);
                });
              }
            });
          }

          // Trigger ping activity with updated items list
          setTimeout(() => {
            pingCartActivity(newItems);
          }, 50);

          return { cartItems: newItems };
        });
      },

      incrementQuantity: (productName, size, color, maxStock = 999) => {
        const state = get();
        const currentQty = state.cartItems.filter(
          (item) =>
            item.productName === productName &&
            item.size === size &&
            (item.color || "Default") === (color || "Default")
        ).length;

        if (currentQty >= maxStock) {
          return false;
        }

        const templateItem = state.cartItems.find(
          (item) =>
            item.productName === productName &&
            item.size === size &&
            (item.color || "Default") === (color || "Default")
        );

        if (!templateItem) return false;

        const newItems = [...state.cartItems, { ...templateItem }];
        set({ cartItems: newItems });
        pingCartActivity(newItems);

        if (supabase) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              syncCartAction(newItems).catch((err) => {
                console.error("Failed to sync DB cart on increment:", err);
              });
            }
          });
        }
        return true;
      },

      clearCart: () => {
        set({ cartItems: [] });
        pingCartActivity([]);
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

