"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { Coupon } from "@/lib/registry";
import { z } from "zod";

const couponSchema = z
  .object({
    code: z
      .string()
      .min(1, "Code is required")
      .max(50)
      .transform((v) => v.trim().toUpperCase()),
    discount: z.number().positive("Discount must be positive"),
    type: z.enum(["percent", "flat"]),
    active: z.boolean().default(true),
  })
  .refine((data) => data.type !== "percent" || data.discount <= 100, {
    message: "Percentage discount must be between 0 and 100",
    path: ["discount"],
  });

export async function saveCouponAction(
  input: unknown
): Promise<{ success: boolean; error?: string; details?: unknown }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.flatten() };
  }

  const data = parsed.data;

  try {
    const newCoupon: Coupon = {
      id: "CPN-" + Math.floor(Math.random() * 9000 + 1000),
      code: data.code,
      discount: data.discount,
      type: data.type,
      active: data.active,
    };
    await db.saveCoupon(newCoupon);
    return { success: true };
  } catch (e: any) {
    console.error("[saveCouponAction]", e);
    return { success: false, error: e.message || "Save failed" };
  }
}

export async function deleteCouponAction(
  couponId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!couponId?.trim()) {
    return { success: false, error: "Invalid coupon ID" };
  }

  try {
    await db.deleteCoupon(couponId);
    return { success: true };
  } catch (e: any) {
    console.error("[deleteCouponAction]", e);
    return { success: false, error: e.message || "Delete failed" };
  }
}
