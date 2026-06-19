"use server";

import { db } from "@/lib/db";
import { getServerUser } from "@/lib/supabase-server";

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
