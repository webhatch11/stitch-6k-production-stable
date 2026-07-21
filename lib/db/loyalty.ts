/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { settingsDb } from "./settings";
import { LoyaltyTransaction } from "../types";

export async function getLoyaltyPoints(userId?: string): Promise<number> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  if (!userId) return 0;

  // Fetch stored balance and expired-but-not-yet-swept points in parallel
  const [profileRes, expiredRes] = await Promise.all([
    supabase.from("profiles").select("loyalty_points").eq("id", userId).maybeSingle(),
    supabase
      .from("loyalty_transactions")
      .select("points")
      .eq("user_id", userId)
      .eq("type", "credit")
      .lt("expires_at", new Date().toISOString())
      .is("expired_processed", null),
  ]);

  if (profileRes.error || !profileRes.data) {
    console.error("Error fetching loyalty points from Supabase:", profileRes.error);
    return 0;
  }

  const storedBalance = Number(profileRes.data.loyalty_points);
  const expiredUnprocessed = (expiredRes.data || []).reduce(
    (sum: number, row: any) => sum + Number(row.points),
    0
  );

  return Math.max(0, storedBalance - expiredUnprocessed);
}

export async function getLoyaltyTransactions(userId?: string): Promise<LoyaltyTransaction[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  if (!userId) return [];

  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("id, user_id, points, type, description, date, created_at, expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching loyalty transactions from Supabase:", error);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date || row.created_at || "",
    points: Number(row.points),
    type: row.type as "credit" | "debit",
    description: row.description || "",
    expiresAt: row.expires_at || null,
  }));
}

export async function getLoyaltyData(userId?: string) {
  const points = await getLoyaltyPoints(userId);
  const transactions = await getLoyaltyTransactions(userId);
  return { points, transactions };
}

export async function applyLoyaltyDebit(
  points: number,
  orderId: string,
  userId?: string,
  customIdempotencyKey?: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const uid = userId;
  if (!uid) return { success: false, error: "User authentication required." };

  const { data, error } = await supabase.rpc("loyalty_atomic_debit", {
    p_user_id: uid,
    p_points: points,
    p_idempotency_key: customIdempotencyKey || orderId,
    p_desc: `Redeemed on Order #${orderId}`,
  });

  if (error) {
    console.error("Atomic loyalty debit error:", error);
    return { success: false, error: "Database error debiting loyalty points." };
  }
  if (data && !data.success) {
    return { success: false, error: data.error };
  }
  return { success: true };
}

export async function awardLoyaltyPoints(total: number, orderId: string, userId?: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const loyaltyConfig = await settingsDb.getLoyaltyConfig();
  const points = Math.floor(total / 100) * loyaltyConfig.pointsPer100;
  if (points <= 0) return;

  const uid = userId;
  if (!uid) return;

  const { data, error } = await supabase.rpc("loyalty_atomic_credit", {
    p_user_id: uid,
    p_points: points,
    p_idempotency_key: "EARNED-" + orderId,
    p_desc: `Earned on Order #${orderId}`,
  });

  if (error) {
    console.error("[awardLoyaltyPoints] RPC error:", error, "orderId:", orderId);
  } else if (data && !data.success) {
    if (data.error !== "Duplicate transaction") {
      console.error("[awardLoyaltyPoints] Failed:", data.error, "orderId:", orderId);
    }
  }
}

export async function applyLoyaltyCredit(
  points: number,
  description: string,
  orderId: string,
  userId?: string,
  customIdempotencyKey?: string
): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const uid = userId;
  if (!uid) return;

  await supabase.rpc("loyalty_atomic_credit", {
    p_user_id: uid,
    p_points: points,
    p_idempotency_key: customIdempotencyKey || ("LOYALTY-CREDIT-" + orderId),
    p_desc: description || `Refund for Order #${orderId}`,
  });
}

export const loyaltyDb = {
  getLoyaltyPoints,
  getLoyaltyTransactions,
  getLoyaltyData,
  applyLoyaltyDebit,
  awardLoyaltyPoints,
  applyLoyaltyCredit,
};
