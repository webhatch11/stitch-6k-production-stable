/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { mapDbCouponToCoupon } from "./utils";
import { Coupon } from "../types";
import { MAX_COUPON_DISCOUNT_INR } from "../inventory-config";
import { productsDb } from "./products";

export async function getCoupons(): Promise<Coupon[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  const cacheKey = "settings:coupons";
  const cached = await CacheService.get<Coupon[]>(cacheKey);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("coupons")
    .select("id, code, discount, type, active, min_cart_value, buy_product_id, get_product_id, get_discount_percent, buy_quantity, get_quantity, usage_count, max_usage, expiry_date")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching coupons from Supabase:", error);
    return [];
  }
  const res = (data || []).map(mapDbCouponToCoupon);
  await CacheService.set(cacheKey, res, 60); // Cache for 60 seconds
  return res;
}

export async function saveCoupon(coupon: Partial<Coupon>): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const dbPayload: any = {
    id: coupon.id || "CPN-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    code: (coupon.code || "CODE").trim().toUpperCase(),
    discount: coupon.discount !== undefined ? coupon.discount : 0,
    type: coupon.type || "percent",
    active: coupon.active !== undefined ? coupon.active : true,
    expiry_date: coupon.expiryDate
      ? (() => {
          const d = new Date(coupon.expiryDate!);
          d.setUTCHours(23, 59, 59, 999);
          return d.toISOString();
        })()
      : null,
    min_cart_value: coupon.minCartValue,
    max_usage: coupon.maxUsage,
    buy_quantity: coupon.buyQuantity,
    get_quantity: coupon.getQuantity,
    get_discount_percent: coupon.getDiscountPercent,
    buy_product_id: coupon.buyProductId,
    get_product_id: coupon.getProductId,
  };

  if (!coupon.id) {
    dbPayload.usage_count = coupon.usageCount ?? 0;
  } else if (coupon.usageCount !== undefined) {
    dbPayload.usage_count = coupon.usageCount;
  }

  const { error } = await supabase.from("coupons").upsert(dbPayload);
  if (error) {
    console.error("Error saving coupon to Supabase:", error);
    throw error;
  }

  await CacheService.del("settings:coupons");
  await CacheService.delPattern("analytics:coupons:*");
}

export async function deleteCoupon(id: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) {
    console.error("Error deleting coupon from Supabase:", error);
    throw error;
  }

  await CacheService.del("settings:coupons");
  await CacheService.delPattern("analytics:coupons:*");
}

export async function validateCoupon(
  code: string,
  cartTotal: number,
  userId?: string,
  cartItems?: any[]
): Promise<{
  valid: boolean;
  coupon?: Coupon;
  error?: string;
  discountAmount?: number;
  message?: string;
  freeItems?: any[];
}> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("coupons")
    .select("id, code, discount, type, active, min_cart_value, buy_product_id, get_product_id, get_discount_percent, buy_quantity, get_quantity, usage_count, max_usage, expiry_date")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    console.error("Error validating coupon on Supabase:", error);
    return { valid: false, error: "Database error validating coupon." };
  }
  if (!data) {
    return { valid: false, error: "Coupon not found." };
  }

  const coupon = mapDbCouponToCoupon(data);

  if (!coupon.active) {
    return { valid: false, error: "Coupon is inactive." };
  }
  if (coupon.expiryDate) {
    const expiryDate = new Date(coupon.expiryDate);
    expiryDate.setHours(23, 59, 59, 999);
    if (new Date() > expiryDate) {
      return {
        valid: false,
        error: `This coupon expired on ${expiryDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
      };
    }
  }
  if (coupon.minCartValue !== undefined && coupon.minCartValue !== null && cartTotal < coupon.minCartValue) {
    return { valid: false, error: `Minimum cart value of ₹${coupon.minCartValue} required.` };
  }
  if (
    coupon.maxUsage !== undefined &&
    coupon.maxUsage !== null &&
    coupon.usageCount !== undefined &&
    coupon.usageCount !== null &&
    coupon.usageCount >= coupon.maxUsage
  ) {
    return { valid: false, error: "Coupon usage limit has been reached." };
  }

  if (userId) {
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("coupon_code", code.trim().toUpperCase())
      // Blocklist: exclude unpaid, failed, cancelled, and returned/refunded states
      .filter("status", "not.in", '("Pending","pending","Payment Pending","payment pending","FAILED","Failed","failed","Cancelled","cancelled","Payment Review Required","payment review required","Returned","returned","Refunded","refunded","Refunded (Out of Stock)")');

    if (countError) {
      console.error("Error checking user coupon usage:", countError);
    } else if (count && count > 0) {
      return {
        valid: false,
        error: "You have already used this coupon",
      };
    }
  }



  let discountAmount = 0;
  if (coupon.type === "percent") {
    discountAmount = Math.floor((cartTotal * coupon.discount) / 100);
    discountAmount = Math.min(discountAmount, MAX_COUPON_DISCOUNT_INR);
    return { valid: true, coupon, discountAmount };
  }
  if (coupon.type === "flat") {
    discountAmount = coupon.discount;
    return { valid: true, coupon, discountAmount };
  }

  if (coupon.type === ("bogo_quantity" as any) || coupon.type === ("bogo_product" as any)) {
    return { valid: false, error: "Coupon type not supported." };
  }

  if (coupon.type === "spend_discount") {
    const minSpend = coupon.minCartValue || 0;
    if (cartTotal < minSpend) {
      const remaining = minSpend - cartTotal;
      return {
        valid: false,
        error: `Spend ₹${minSpend} to unlock this offer. You need ₹${remaining} more.`,
      };
    }
    const discountAmount = Math.floor((cartTotal * (coupon.getDiscountPercent || 0)) / 100);
    return {
      valid: true,
      coupon,
      discountAmount,
    };
  }

  return { valid: true, coupon, discountAmount };
}

export async function incrementCouponUsage(code: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase.rpc("coupon_atomic_increment", {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error("Error executing atomic coupon increment:", error);
    return false;
  }
  const success = data && typeof data === "object" && "success" in data ? (data as any).success === true : false;

  if (success) {
    await CacheService.del("settings:coupons");
    await CacheService.delPattern("analytics:coupons:*");
  }
  return success;
}

export async function decrementCouponUsage(code: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase.rpc("coupon_atomic_decrement", {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error("Error executing atomic coupon decrement:", error);
    const { data: cData } = await supabase
      .from("coupons")
      .select("id, usage_count")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (cData) {
      const cur = cData.usage_count || 0;
      await supabase
        .from("coupons")
        .update({ usage_count: Math.max(0, cur - 1) })
        .eq("id", cData.id);

      await CacheService.del("settings:coupons");
      await CacheService.delPattern("analytics:coupons:*");
      return true;
    }
    return false;
  }

  const success = data && typeof data === "object" && "success" in data ? (data as any).success === true : false;

  if (success) {
    await CacheService.del("settings:coupons");
    await CacheService.delPattern("analytics:coupons:*");
  }
  return success;
}

export const couponsDb = {
  getCoupons,
  saveCoupon,
  deleteCoupon,
  validateCoupon,
  incrementCouponUsage,
  decrementCouponUsage,
};
