"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCartStore, mergeCarts } from "@/stores/cartStore";
import { getCartAction, syncCartAction } from "@/app/actions/cart";

export function CartSyncProvider() {
  useEffect(() => {
    const restoreCart = async () => {
      if (!supabase) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const dbItems = await getCartAction() || [];
          const localItems = useCartStore.getState().cartItems;

          if (dbItems.length > 0 && localItems.length === 0) {
            useCartStore.setState({ cartItems: dbItems });
          } else if (localItems.length > 0) {
            const merged = mergeCarts(localItems, dbItems);
            await syncCartAction(merged);
            useCartStore.setState({ cartItems: merged });
          }
        }
      } catch (err) {
        console.error("Error restoring cart on mount:", err);
      }
    };

    restoreCart();

    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === "SIGNED_IN") {
          const dbItems = await getCartAction() || [];
          const localItems = useCartStore.getState().cartItems;
          const merged = mergeCarts(localItems, dbItems);
          await syncCartAction(merged);
          useCartStore.setState({ cartItems: merged });
        } else if (event === "SIGNED_OUT") {
          const localItems = useCartStore.getState().cartItems;
          await syncCartAction(localItems);
          useCartStore.getState().clearCart();
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
