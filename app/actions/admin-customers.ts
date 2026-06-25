"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

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
