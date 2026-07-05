"use server";

import { db } from "@/lib/db";
import { getServerUser, getServerSupabase } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase-service";
import { cookies } from "next/headers";

export async function getProfileDataAction() {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const balance = await db.getWalletBalance(user.id);
    const wTxs = await db.getWalletTransactions(user.id);
    const points = await db.getLoyaltyPoints(user.id);
    const lTxs = await db.getLoyaltyTransactions(user.id);
    const orders = await db.getUserOrders(user.id);

    return {
      success: true,
      data: {
        walletBalance: balance,
        walletTxs: wTxs,
        loyaltyPoints: points,
        loyaltyTxs: lTxs,
        recentOrders: orders.slice(0, 3)
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load profile data" };
  }
}

export async function updateProfileAction(
  name: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (user.isMock) {
    const cookieStore = await cookies();
    cookieStore.set("mock_user_name", name.trim(), { path: "/", maxAge: 86400 });
    cookieStore.set("mock_user_phone", phone.trim(), { path: "/", maxAge: 86400 });
    return { success: true };
  }

  // Update profiles table
  if (supabaseService) {
    const { error } = await supabaseService
      .from('profiles')
      .update({ 
        name: name.trim(),
        phone: phone.trim()
      })
      .eq('id', user.id);
    
    if (error) {
      return { success: false, error: error.message };
    }
  }

  // Also update Supabase Auth metadata
  const supabase = await getServerSupabase();
  if (supabase) {
    await supabase.auth.updateUser({
      data: { full_name: name.trim() }
    });
  }

  return { success: true };
}
