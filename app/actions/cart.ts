"use server";

import { db } from "@/lib/db";
import { getServerSupabase } from "@/lib/supabase-server";
import { CartItem } from "@/stores/cartStore";

async function requireSessionUser() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.error("Error getting user in cart actions:", err);
    return null;
  }
}

export async function syncCartAction(items: CartItem[]) {
  const user = await requireSessionUser();
  if (!user) return;
  await db.syncCartToDB(user.id, items);
}

export async function addToCartAction(item: CartItem) {
  const user = await requireSessionUser();
  if (!user) return;
  await db.addToUserCart(user.id, item);
}

export async function removeFromCartAction(productId: string, size: string, color: string) {
  const user = await requireSessionUser();
  if (!user) return;
  await db.removeFromUserCart(user.id, productId, size, color);
}

export async function clearCartAction() {
  const user = await requireSessionUser();
  if (!user) return;
  await db.clearUserCart(user.id);
}

export async function getCartAction(): Promise<CartItem[]> {
  const user = await requireSessionUser();
  if (!user) return [];
  return await db.getUserCart(user.id);
}
