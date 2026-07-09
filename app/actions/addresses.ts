"use server";

import { db } from "@/lib/db";
import { getServerUser } from "@/lib/supabase-server";
import { UserAddress } from "@/lib/types";

import { addressSchema } from "@/lib/schemas/address";

/**
 * All address actions operate on the SESSION user's data only. Client-supplied
 * userId arguments are kept for backward compatibility but never trusted —
 * they are replaced with the authenticated user's id server-side.
 */
async function requireSessionUser() {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function getUserAddressesAction(_userId?: string) {
  try {
    const user = await requireSessionUser();
    const addresses = await db.getUserAddresses(user.id);
    return { success: true, addresses };
  } catch (error: any) {
    console.error('[addresses.ts]:', new Error("Silent catch caught error"));
    return { success: false, error: error.message || "Failed to fetch addresses" };
  }
}

export async function saveUserAddressAction(address: Partial<UserAddress>) {
  try {
    const user = await requireSessionUser();
    const validated = addressSchema.parse(address) as Partial<UserAddress>;
    // Force ownership to the session user regardless of what the client sent
    validated.user_id = user.id;
    // If updating an existing address, verify it belongs to the session user —
    // otherwise the upsert could hijack another user's address row.
    if (validated.id) {
      const existing = await db.getAddressById(validated.id, user.id);
      if (!existing) delete validated.id;
    }
    const saved = await db.saveUserAddress(validated);
    return { success: true, address: saved };
  } catch (error: any) {
    console.error('[addresses.ts]:', new Error("Silent catch caught error"));
    if (error.name === "ZodError" || error.issues || error.errors) {
      const list = error.issues || error.errors;
      const messages = list.map((e: any) => e.message).join(". ");
      return { success: false, error: `Validation Error: ${messages}` };
    }
    return { success: false, error: error.message || "Failed to save address" };
  }
}

export async function deleteUserAddressAction(id: string, _userId?: string) {
  try {
    const user = await requireSessionUser();
    await db.deleteUserAddress(id, user.id);
    return { success: true };
  } catch (error: any) {
    console.error('[addresses.ts]:', new Error("Silent catch caught error"));
    return { success: false, error: error.message || "Failed to delete address" };
  }
}

export async function setDefaultUserAddressAction(id: string, _userId?: string) {
  try {
    const user = await requireSessionUser();
    await db.setDefaultUserAddress(id, user.id);
    return { success: true };
  } catch (error: any) {
    console.error('[addresses.ts]:', new Error("Silent catch caught error"));
    return { success: false, error: error.message || "Failed to set default address" };
  }
}
