"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useCartStore, mergeCarts } from "@/stores/cartStore";
import { getCartAction, syncCartAction, validateCartAction } from "@/app/actions/cart";

export function CartSyncProvider() {
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const syncCart = async (userId: string | null) => {
      // Synchronously set the lastUserId at the start to prevent concurrent syncs
      if (userId === lastUserId.current) return;
      
      const isLogout = lastUserId.current !== undefined && lastUserId.current !== null && userId === null;
      lastUserId.current = userId;

      if (isLogout) {
        if (useCartStore.getState().cartItems.length > 0) {
          useCartStore.getState().clearCart();
        }
        return;
      }

      if (!userId) {
        // Guest user: validate local storage cart items to remove deleted/ghost products
        try {
          const localItems = useCartStore.getState().cartItems;
          if (localItems.length > 0) {
            const validated = await validateCartAction(localItems);
            if (validated.length !== localItems.length) {
              useCartStore.setState({ cartItems: validated });
            }
          }
        } catch (err) {
          console.error("Error validating guest cart:", err);
        }
        return;
      }

      try {
        const dbItems = await getCartAction() || [];
        const localItems = useCartStore.getState().cartItems;

        // Validate local cart items before sync
        const activeLocal = await validateCartAction(localItems);

        if (dbItems.length > 0 && activeLocal.length === 0) {
          useCartStore.setState({ cartItems: dbItems });
        } else {
          const merged = mergeCarts(activeLocal, dbItems);
          await syncCartAction(merged);
          useCartStore.setState({ cartItems: merged });
        }
      } catch (err) {
        console.error("Error syncing cart for user:", userId, err);
      }
    };

    // Run initial sync check
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        syncCart(session?.user?.id || null);
      });
    }

    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === "SIGNED_IN") {
          await syncCart(session?.user?.id || null);
        } else if (event === "SIGNED_OUT") {
          await syncCart(null);
        }
      } catch (err) {
        console.error("Error in onAuthStateChange handler:", err);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
