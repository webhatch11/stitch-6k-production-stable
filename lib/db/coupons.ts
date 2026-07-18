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
      // Allowlist: only count confirmed paid orders, NOT Payment Pending / FAILED / Cancelled
      .in("status", ["Paid", "Accepted", "Shipped", "Out for Delivery", "Delivered"]);

    if (countError) {
      console.error("Error checking user coupon usage:", countError);
    } else if (count && count > 0) {
      return {
        valid: false,
        error: "You have already used this coupon",
      };
    }
  }

  if (
    cartItems &&
    cartItems.length > 0 &&
    (coupon.type === "bogo_quantity" || coupon.type === "bogo_product")
  ) {
    const dbProducts = await productsDb.getProducts();
    const priceById = new Map<string, number>();
    const priceByTitle = new Map<string, number>();
    for (const p of dbProducts) {
      if (p.id !== undefined && p.id !== null) priceById.set(String(p.id), p.price);
      if (p.title) priceByTitle.set(p.title.toLowerCase(), p.price);
    }
    cartItems = cartItems.map((item) => {
      let authoritativePrice: number | undefined;
      if (item.productId !== undefined && item.productId !== null) {
        authoritativePrice = priceById.get(String(item.productId));
      }
      if (authoritativePrice === undefined && item.productName) {
        authoritativePrice = priceByTitle.get(String(item.productName).toLowerCase());
      }
      return { ...item, price: authoritativePrice ?? 0 };
    });
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

  if (coupon.type === "bogo_quantity") {
    const buyQty = coupon.buyQuantity || 1;
    const getQty = coupon.getQuantity || 1;
    const requiredTotal = buyQty + getQty;

    const totalUnits = (cartItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

    if (totalUnits < requiredTotal) {
      return {
        valid: false,
        error: `Add at least ${requiredTotal} items to your cart to use this offer.`,
      };
    }

    const sortedItems: any[] = [];
    for (const item of cartItems || []) {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        sortedItems.push({ ...item, quantity: 1 });
      }
    }
    sortedItems.sort((a, b) => a.price - b.price);

    const freeCount = Math.floor(totalUnits / requiredTotal) * getQty;
    const freeItems = sortedItems.slice(0, freeCount);
    const discountAmount = freeItems.reduce((sum, item) => sum + item.price, 0);

    return {
      valid: true,
      coupon,
      discountAmount,
      freeItems,
    };
  }

  if (coupon.type === "bogo_product") {
    const buyProductId = coupon.buyProductId;
    const getProductId = coupon.getProductId;
    if (!cartItems) {
      return { valid: false, error: "Cart items required for validation." };
    }

    const buyItem = cartItems.find((item) => item.productId === buyProductId);
    const getItem = cartItems.find((item) => item.productId === getProductId);

    const buyQtyInCart = buyItem ? (buyItem.quantity || 1) : 0;
    const getQtyInCart = getItem ? (getItem.quantity || 1) : 0;

    // Same product BOGO (e.g. Buy 1 A, Get 1 A Free)
    if (buyProductId === getProductId) {
      const requiredTotal = (coupon.buyQuantity || 1) + (coupon.getQuantity || 1);
      if (buyQtyInCart < requiredTotal) {
        let buyProductName = buyProductId || "";
        const { data: buyProdData } = await supabase
          .from("products")
          .select("title")
          .eq("id", buyProductId)
          .maybeSingle();
        if (buyProdData?.title) {
          buyProductName = buyProdData.title;
        }
        return {
          valid: false,
          error: `Add at least ${requiredTotal} units of "${buyProductName}" to your cart to unlock the offer.`,
        };
      }

      // Calculate sets and discount amount for same product BOGO
      const buyRequirement = coupon.buyQuantity || 1;
      const getAward = coupon.getQuantity || 1;
      const setTotal = buyRequirement + getAward;
      const sets = Math.floor(buyQtyInCart / setTotal);
      const claimableQty = sets * getAward;
      const discountAmount = Math.floor((buyItem!.price * claimableQty * (coupon.getDiscountPercent || 0)) / 100);

      return {
        valid: true,
        coupon,
        discountAmount,
      };
    }

    // Different products BOGO (e.g. Buy A, Get B Free)
    if (buyQtyInCart < (coupon.buyQuantity || 1)) {
      let buyProductName = buyProductId || "";
      const { data: buyProdData } = await supabase
        .from("products")
        .select("title")
        .eq("id", buyProductId)
        .maybeSingle();
      if (buyProdData?.title) {
        buyProductName = buyProdData.title;
      }
      return {
        valid: false,
        error: `Buy "${buyProductName}" to unlock this coupon.`,
      };
    }

    if (getQtyInCart === 0) {
      let getProductName = getProductId || "";
      const { data: getProdData } = await supabase
        .from("products")
        .select("title")
        .eq("id", getProductId)
        .maybeSingle();
      if (getProdData?.title) {
        getProductName = getProdData.title;
      }
      return {
        valid: true,
        coupon,
        discountAmount: 0,
        message: `Add "${getProductName}" to cart to get ${coupon.getDiscountPercent}% off.`,
      };
    }

    // Calculate sets and discount amount for different products BOGO
    const sets = Math.floor(buyQtyInCart / (coupon.buyQuantity || 1));
    const claimableQty = Math.min(getQtyInCart, sets * (coupon.getQuantity || 1));
    const discountAmount = Math.floor((getItem!.price * claimableQty * (coupon.getDiscountPercent || 0)) / 100);

    return {
      valid: true,
      coupon,
      discountAmount,
    };
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
