/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { mapDbAddressToUserAddress } from "./utils";
import { productsDb } from "./products";
import { WalletTransaction, UserAddress } from "../types";
import { CartItem } from "@/stores/cartStore";

export async function getWalletBalance(userId?: string): Promise<number> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const uid = userId;
  if (!uid) return 0;

  const { data, error } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.error("Error fetching wallet balance from Supabase:", error);
    return 0;
  }
  return data ? Number(data.wallet_balance) : 0;
}

export async function getWalletTransactions(userId?: string): Promise<WalletTransaction[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const uid = userId;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, user_id, amount, type, description, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching wallet transactions from Supabase:", error);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    date: row.created_at || "",
    amount: Number(row.amount),
    type: row.type as "credit" | "debit",
    description: row.description || "",
  }));
}

export async function getWalletData(userId?: string) {
  const balance = await getWalletBalance(userId);
  const transactions = await getWalletTransactions(userId);
  return { balance, transactions };
}

export async function applyWalletDebit(
  amount: number,
  orderId: string,
  userId?: string
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

  const { data, error } = await supabase.rpc("wallet_atomic_debit", {
    p_user_id: uid,
    p_amount: amount,
    p_idempotency_key: orderId,
    p_desc: `Payment for Order #${orderId}`,
  });

  if (error) {
    console.error("Atomic wallet debit error:", error);
    return { success: false, error: "Database error debiting wallet." };
  }
  if (data && !data.success) {
    return { success: false, error: data.error };
  }
  return { success: true };
}

export async function applyWalletCredit(
  amount: number,
  description: string,
  orderId: string,
  userId?: string
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

  const { data: creditData, error: creditError } = await supabase.rpc("wallet_atomic_credit", {
    p_user_id: uid,
    p_amount: amount,
    p_idempotency_key: "WALLET-CREDIT-" + orderId,
    p_desc: description || `Refund for Order #${orderId}`,
  });

  if (creditError) {
    if (
      creditError.code === "23505" ||
      creditError.message?.toLowerCase().includes("duplicate") ||
      creditError.message?.toLowerCase().includes("unique")
    ) {
      return { success: true };
    }
    console.error("[applyWalletCredit] RPC error:", creditError.message);
    return { success: false, error: creditError.message };
  }

  if (creditData && creditData.success === false) {
    if (
      creditData.error?.toLowerCase().includes("duplicate") ||
      creditData.error?.toLowerCase().includes("unique")
    ) {
      return { success: true };
    }
    console.error("[applyWalletCredit] RPC returned failure:", creditData.error);
    return { success: false, error: creditData.error };
  }

  return { success: true };
}

export async function getUserAddresses(userId: string = "guest"): Promise<UserAddress[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("user_addresses")
    .select("id, user_id, name, address_line_1, address_line_2, city, state, postal_code, country, phone, is_default, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) {
    console.error("Error fetching addresses from Supabase:", error);
    return [];
  }
  return (data || []).map(mapDbAddressToUserAddress);
}

export async function getAddressById(addressId: string, userId: string): Promise<UserAddress | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("user_addresses")
    .select("id, user_id, name, address_line_1, address_line_2, city, state, postal_code, country, phone, is_default, created_at")
    .eq("id", addressId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Error fetching address by id:", error);
    return null;
  }
  return data ? mapDbAddressToUserAddress(data) : null;
}

export async function saveUserAddress(address: Partial<UserAddress>): Promise<UserAddress> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const newAddress: UserAddress = {
    id: address.id || "ADDR-" + Date.now(),
    user_id: address.user_id || "guest",
    name: address.name || "",
    phone: address.phone || "",
    address_line_1: address.address_line_1 || "",
    address_line_2: address.address_line_2 || "",
    city: address.city || "",
    state: address.state || "",
    postal_code: address.postal_code || "",
    country: address.country || "India",
    is_default: address.is_default || false,
  };

  if (newAddress.is_default) {
    // Unset other defaults for this user
    await supabase
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", newAddress.user_id)
      .eq("is_default", true);
  } else {
    // Check if any exists, if not make it default
    const { data } = await supabase
      .from("user_addresses")
      .select("id")
      .eq("user_id", newAddress.user_id)
      .limit(1);
    if (!data || data.length === 0) {
      newAddress.is_default = true;
    }
  }

  const { error } = await supabase.from("user_addresses").upsert(newAddress);
  if (error) {
    console.error("Error saving address to Supabase:", error);
    throw error;
  }
  return newAddress;
}

export async function deleteUserAddress(id: string, userId: string = "guest"): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  
  // fetch before delete to check if default (scoped to owner)
  const { data: toDelete } = await supabase
    .from("user_addresses")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("user_addresses").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    console.error("Error deleting address from Supabase:", error);
    throw error;
  }

  if (toDelete?.is_default) {
    const { data: nextAddress } = await supabase
      .from("user_addresses")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (nextAddress) {
      await supabase.from("user_addresses").update({ is_default: true }).eq("id", nextAddress.id);
    }
  }
}

export async function setDefaultUserAddress(id: string, userId: string = "guest"): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  await supabase
    .from("user_addresses")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
  
  await supabase
    .from("user_addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function getUserCart(userId: string): Promise<CartItem[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data, error } = await supabase
    .from("user_cart")
    .select("product_id, product_name, price, size, image, color, quantity")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user cart from Supabase:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  const productIds = Array.from(new Set(data.map((row) => row.product_id)));
  const activeProducts = await productsDb.getActiveProductIds(productIds);
  const activeSet = new Set(activeProducts);

  const items: CartItem[] = [];
  for (const row of data) {
    if (!activeSet.has(row.product_id)) {
      continue;
    }
    const item: CartItem = {
      productId: row.product_id,
      productName: row.product_name,
      price: Number(row.price),
      size: row.size,
      color: row.color,
      image: row.image || "",
    };
    const qty = row.quantity || 1;
    for (let i = 0; i < qty; i++) {
      items.push({ ...item });
    }
  }
  return items;
}

export async function syncCartToDB(userId: string, items: CartItem[]): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  try {
    if (items.length === 0) {
      await supabase.from("user_cart").delete().eq("user_id", userId);
      return;
    }

    const grouped: Record<
      string,
      {
        user_id: string;
        product_id: string;
        product_name: string;
        price: number;
        size: string;
        color: string;
        image: string | null;
        quantity: number;
      }
    > = {};

    for (const item of items) {
      const pId = item.productId || "unknown";
      const size = item.size || "Default";
      const color = item.color || "Default";
      const key = `${pId}_${size}_${color}`;

      if (!grouped[key]) {
        grouped[key] = {
          user_id: userId,
          product_id: pId,
          product_name: item.productName,
          price: Number(item.price),
          size: size,
          color: color,
          image: item.image || null,
          quantity: 0,
        };
      }
      grouped[key].quantity += 1;
    }

    const payload = Object.values(grouped);

    const { error } = await supabase
      .from("user_cart")
      .upsert(payload, { onConflict: "user_id,product_id,size,color" });

    if (error) {
      console.error("Error in syncCartToDB upsert:", error);
    }

    const keysToKeep = new Set(payload.map((p) => `${p.product_id}_${p.size}_${p.color}`));
    const { data: existing } = await supabase
      .from("user_cart")
      .select("product_id, size, color")
      .eq("user_id", userId);

    if (existing) {
      const toDelete = existing.filter((e) => !keysToKeep.has(`${e.product_id}_${e.size}_${e.color}`));
      for (const item of toDelete) {
        await supabase
          .from("user_cart")
          .delete()
          .eq("user_id", userId)
          .eq("product_id", item.product_id)
          .eq("size", item.size)
          .eq("color", item.color);
      }
    }
  } catch (err) {
    console.error("syncCartToDB error:", err);
  }
}

export async function addToUserCart(userId: string, item: CartItem): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const pId = item.productId || "unknown";
  const size = item.size || "Default";
  const color = item.color || "Default";

  try {
    const { data: existing } = await supabase
      .from("user_cart")
      .select("quantity")
      .eq("user_id", userId)
      .eq("product_id", pId)
      .eq("size", size)
      .eq("color", color)
      .maybeSingle();

    const newQty = existing ? existing.quantity + 1 : 1;

    const payload = {
      user_id: userId,
      product_id: pId,
      product_name: item.productName,
      price: Number(item.price),
      size: size,
      color: color,
      image: item.image || null,
      quantity: newQty,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_cart")
      .upsert(payload, { onConflict: "user_id,product_id,size,color" });

    if (error) {
      console.error("Error in addToUserCart:", error);
    }
  } catch (err) {
    console.error("addToUserCart error:", err);
  }
}

export async function removeFromUserCart(
  userId: string,
  productId: string,
  size: string,
  color: string
): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  try {
    const { error } = await supabase
      .from("user_cart")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId)
      .eq("size", size || "Default")
      .eq("color", color || "Default");

    if (error) {
      console.error("Error in removeFromUserCart:", error);
    }
  } catch (err) {
    console.error("removeFromUserCart error:", err);
  }
}

export async function clearUserCart(userId: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  try {
    const { error } = await supabase.from("user_cart").delete().eq("user_id", userId);

    if (error) {
      console.error("Error in clearUserCart:", error);
    }
  } catch (err) {
    console.error("clearUserCart error:", err);
  }
}

export async function getCustomers(): Promise<any[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const [profilesRes, ordersRes] = await Promise.all([
    supabase.from("profiles").select("id, name, email, phone, role, wallet_balance, loyalty_points, is_blocked, blocked_at, blocked_reason, created_at"),
    supabase.from("orders").select("user_id, total, status"),
  ]);

  if (profilesRes.error) {
    console.error("Error fetching profiles:", profilesRes.error);
    return [];
  }

  const profiles = profilesRes.data || [];
  const orders = ordersRes.data || [];

  if (ordersRes.error) {
    console.error("Error fetching orders for customers:", ordersRes.error);
    return profiles.map((p) => ({
      ...p,
      ltv: 0,
      order_count: 0,
    }));
  }

  return profiles.map((p) => {
    const userOrders = orders.filter((o) => o.user_id === p.id);
    const validOrders = userOrders.filter((o) => o.status !== "Cancelled" && o.status !== "Expired");
    const ltv = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
    return {
      name: p.name,
      email: p.email,
      phone: p.phone ?? "",
      wallet_balance: Number(p.wallet_balance || 0),
      loyalty_points: Number(p.loyalty_points || 0),
      ltv,
      order_count: userOrders.length,
      id: p.id,
      joined: p.created_at ?? "",
      is_blocked: p.is_blocked ?? false,
      blocked_at: p.blocked_at ?? null,
      blocked_reason: p.blocked_reason ?? null,
    };
  });
}

export async function getCustomerProfile(userId: string): Promise<any | null> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("profiles").select("name, email, phone").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Error fetching customer profile:", error);
    return null;
  }
  return data;
}

export async function adjustCustomerBalance(
  email: string,
  type: "wallet" | "loyalty",
  amount: number,
  description: string
): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: profile, error: pError } = await supabase
    .from("profiles")
    .select("id, wallet_balance, loyalty_points")
    .eq("email", email)
    .maybeSingle();

  if (pError || !profile) return false;

  if (type === "wallet") {
    const newBalance = Number(profile.wallet_balance || 0) + amount;
    const { error } = await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", profile.id);

    if (error) return false;

    await supabase.from("wallet_transactions").insert({
      id: "WLT-ADJ-" + Date.now(),
      user_id: profile.id,
      date: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
      amount: Math.abs(amount),
      type: amount > 0 ? "credit" : "debit",
      description,
    });
  } else {
    const newPoints = Number(profile.loyalty_points || 0) + amount;
    const { error } = await supabase.from("profiles").update({ loyalty_points: newPoints }).eq("id", profile.id);

    if (error) return false;

    await supabase.from("loyalty_transactions").insert({
      id: "LYL-ADJ-" + Date.now(),
      user_id: profile.id,
      date: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
      points: Math.abs(amount),
      type: amount > 0 ? "credit" : "debit",
      description,
    });
  }

  return true;
}

export const usersDb = {
  getWalletBalance,
  getWalletTransactions,
  getWalletData,
  applyWalletDebit,
  applyWalletCredit,
  getUserAddresses,
  getAddressById,
  saveUserAddress,
  deleteUserAddress,
  setDefaultUserAddress,
  getUserCart,
  syncCartToDB,
  addToUserCart,
  removeFromUserCart,
  clearUserCart,
  getCustomers,
  getCustomerProfile,
  adjustCustomerBalance,
};
