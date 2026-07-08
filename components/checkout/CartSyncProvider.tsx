"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useCartStore, mergeCarts } from "@/stores/cartStore";
import { getCartAction, syncCartAction } from "@/app/actions/cart";

export function CartSyncProvider() {
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const syncCart = async (userId: string | null) => {
      // Synchronously set the lastUserId at the start to prevent concurrent syncs
      if (userId === lastUserId.current) return;
      lastUserId.current = userId;

      if (!userId) {
        // User logged out, clear cart if it is not already empty
        if (useCartStore.getState().cartItems.length > 0) {
          useCartStore.getState().clearCart();
        }
        return;
      }

      try {
        const dbItems = await getCartAction() || [];
        const localItems = useCartStore.getState().cartItems;

        if (dbItems.length > 0 && localItems.length === 0) {
          useCartStore.setState({ cartItems: dbItems });
        } else if (localItems.length > 0) {
          const merged = mergeCarts(localItems, dbItems);
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
