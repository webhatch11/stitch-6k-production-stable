"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function adjustCustomerBalanceAction(
  email: string,
  type: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!email?.trim()) return { success: false, error: "Invalid email" };
  if (type !== "wallet" && type !== "loyalty") {
    return { success: false, error: "Type must be 'wallet' or 'loyalty'" };
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return { success: false, error: "Amount must be a non-zero finite number" };
  }
  if (!reason?.trim()) return { success: false, error: "Reason is required" };

  if (amount < 0) {
    try {
      const customers = await db.getCustomers();
      const customer = customers.find((c: any) => c.email === email);
      if (!customer) return { success: false, error: "Customer not found" };

      const currentBalance =
        type === "wallet"
          ? (customer.wallet_balance ?? 0)
          : (customer.loyalty_points ?? 0);

      if (Math.abs(amount) > currentBalance) {
        return {
          success: false,
          error:
            type === "wallet"
              ? `Insufficient wallet credits (balance: ${currentBalance})`
              : `Insufficient loyalty points (balance: ${currentBalance})`,
        };
      }
    } catch (e: any) {
      console.error("[adjustCustomerBalanceAction] balance check failed:", e);
      return { success: false, error: "Failed to verify balance" };
    }
  }

  try {
    const success = await db.adjustCustomerBalance(
      email,
      type as "wallet" | "loyalty",
      amount,
      reason
    );
    return { success: !!success };
  } catch (e: any) {
    console.error("[adjustCustomerBalanceAction]", e);
    return { success: false, error: e.message || "Adjustment failed" };
  }
}

// ── Block/Unblock Actions ────────────────────────────────────────────────────

const blockSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
});

export async function blockCustomerAction(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const parse = blockSchema.safeParse({ userId, reason });
  if (!parse.success) {
    const issues: any[] = (parse.error as any).issues ?? (parse.error as any).errors ?? [];
    return { success: false, error: issues[0]?.message || "Invalid input" };
  }

  try {
    const { supabaseService, isServiceClientConfigured } = await import("@/lib/supabase-service");
    if (!isServiceClientConfigured || !supabaseService) {
      // Mock mode: just return success (block state not persisted without DB)
      console.warn("[blockCustomerAction] No Supabase configured — mock mode.");
      return { success: true };
    }

    const { error } = await supabaseService
      .from("profiles")
      .update({
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        blocked_reason: parse.data.reason,
      })
      .eq("id", parse.data.userId);

    if (error) {
      console.error("[blockCustomerAction] DB error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.error("[blockCustomerAction]", e);
    return { success: false, error: e.message || "Failed to block customer" };
  }
}

const unblockSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export async function unblockCustomerAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const parse = unblockSchema.safeParse({ userId });
  if (!parse.success) {
    const issues: any[] = (parse.error as any).issues ?? (parse.error as any).errors ?? [];
    return { success: false, error: issues[0]?.message || "Invalid input" };
  }

  try {
    const { supabaseService, isServiceClientConfigured } = await import("@/lib/supabase-service");
    if (!isServiceClientConfigured || !supabaseService) {
      console.warn("[unblockCustomerAction] No Supabase configured — mock mode.");
      return { success: true };
    }

    const { error } = await supabaseService
      .from("profiles")
      .update({
        is_blocked: false,
        blocked_at: null,
        blocked_reason: null,
      })
      .eq("id", parse.data.userId);

    if (error) {
      console.error("[unblockCustomerAction] DB error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.error("[unblockCustomerAction]", e);
    return { success: false, error: e.message || "Failed to unblock customer" };
  }
}

