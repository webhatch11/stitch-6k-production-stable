/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { ShippingRules } from "../shipping";

export async function getSetting(key: string): Promise<any> {
  const { supabase, isSupabaseConfigured } = loadService();
  const cacheKey = `settings:${key}`;
  const cached = await CacheService.get<any>(cacheKey);
  if (cached) {
    return cached;
  }
  
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  
  if (error || !data) return null;
  await CacheService.set(cacheKey, data.value, 600);
  return data.value;
}

export async function getLoyaltyConfig(): Promise<{
  pointsPer100: number;
  rupeesPerPoint: number;
  minRedeemPoints: number;
}> {
  try {
    const val = await getSetting("loyalty_config");
    if (val) {
      return {
        pointsPer100: typeof val.points_per_100 === "number" ? val.points_per_100 : 5,
        rupeesPerPoint: typeof val.rupees_per_point === "number" ? val.rupees_per_point : 0.5,
        minRedeemPoints: typeof val.min_redeem_points === "number" ? val.min_redeem_points : 100,
      };
    }
  } catch (e) {
    console.error("Error reading loyalty config:", e);
  }
  return { pointsPer100: 5, rupeesPerPoint: 0.5, minRedeemPoints: 100 };
}

export async function getShippingRules(): Promise<ShippingRules> {
  const setting = await getSetting("shipping_rules");
  return {
    mode: setting?.mode || "free_above",
    flatRate: setting?.flat_rate || 99,
    freeAboveAmount: setting?.free_above_amount || 999,
    displayMessage: setting?.display_message || "Free shipping on orders above ₹999",
  };
}

export async function saveSetting(key: string, value: any): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return false;
  await CacheService.del(`settings:${key}`);
  return true;
}

export const settingsDb = {
  getSetting,
  getLoyaltyConfig,
  getShippingRules,
  saveSetting,
};
