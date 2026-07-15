"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { Coupon } from "@/lib/types";
import { z } from "zod";

const couponSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .min(1, "Code is required")
      .max(50)
      .transform((v) => v.trim().toUpperCase()),
    discount: z.number().min(0).optional().default(0),
    type: z.enum(["percent", "flat", "bogo_quantity", "bogo_product", "spend_discount"]),
    active: z.boolean().default(true),
    min_cart_value: z.number().min(0).optional().default(0),
    max_usage: z.number().int().min(0).optional().nullable(),
    expiry_date: z.string().optional().nullable(),  // ISO date string
    buy_quantity: z.number().int().min(1).optional().nullable(),
    get_quantity: z.number().int().min(1).optional().nullable(),
    get_discount_percent: z.number().int().min(0).max(100).optional().nullable(),
    buy_product_id: z.string().optional().nullable(),
    get_product_id: z.string().optional().nullable(),
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
    const { supabaseService } = await import("@/lib/supabase-service");
    if (supabaseService) {
      const { data: existingCoupon } = await supabaseService
        .from("coupons")
        .select("id")
        .eq("code", data.code)
        .maybeSingle();

      if (existingCoupon && existingCoupon.id !== data.id) {
        return { success: false, error: `Coupon code "${data.code}" is already in use by another coupon.` };
      }
    }
  } catch (err: any) {
    console.error("[saveCouponAction] uniqueness check failed:", err);
  }

  try {
    const newCoupon: Coupon = {
      id: data.id || "CPN-" + Date.now() + "-" + Math.floor(Math.random() * 9000 + 1000),
      code: data.code,
      discount: data.discount,
      type: data.type,
      active: data.active,
      minCartValue: data.min_cart_value,
      maxUsage: data.max_usage,
      expiryDate: data.expiry_date,
      buyQuantity: data.buy_quantity,
      getQuantity: data.get_quantity,
      getDiscountPercent: data.get_discount_percent,
      buyProductId: data.buy_product_id,
      getProductId: data.get_product_id,
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

export async function getCouponDiscountTotalAction(): Promise<{
  success: boolean;
  total?: number;
  perCoupon?: Record<string, number>;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  
  try {
    const { supabaseService, isServiceClientConfigured } = await import("@/lib/supabase-service");
    if (!isServiceClientConfigured || !supabaseService) {
      return { success: false, error: "Supabase not configured" };
    }
    
    const { data, error } = await supabaseService
      .from("orders")
      .select("coupon_code, coupon_discount")
      .not("coupon_code", "is", null)
      .neq("coupon_code", "");
    
    if (error) return { success: false, error: error.message };
    
    let total = 0;
    const perCoupon: Record<string, number> = {};
    
    for (const row of data || []) {
      const code = row.coupon_code;
      const discount = Number(row.coupon_discount || 0);
      if (!code) continue;
      total += discount;
      perCoupon[code] = (perCoupon[code] || 0) + discount;
    }
    
    return { success: true, total, perCoupon };
  } catch (e: any) {
    console.error('[admin-coupons.ts]:', e);
    return { success: false, error: e.message };
  }
}
