"use server";

import { db } from "@/lib/db";
import { UserAddress } from "@/lib/registry";

import { addressSchema } from "@/lib/schemas/address";

export async function getUserAddressesAction(userId: string) {
  try {
    const addresses = await db.getUserAddresses(userId);
    return { success: true, addresses };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch addresses" };
  }
}

export async function saveUserAddressAction(address: Partial<UserAddress>) {
  try {
    const validated = addressSchema.parse(address);
    const saved = await db.saveUserAddress(validated as UserAddress);
    return { success: true, address: saved };
  } catch (error: any) {
    if (error.name === "ZodError" || error.issues || error.errors) {
      const list = error.issues || error.errors;
      const messages = list.map((e: any) => e.message).join(". ");
      return { success: false, error: `Validation Error: ${messages}` };
    }
    return { success: false, error: error.message || "Failed to save address" };
  }
}

export async function deleteUserAddressAction(id: string, userId: string) {
  try {
    await db.deleteUserAddress(id, userId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete address" };
  }
}

export async function setDefaultUserAddressAction(id: string, userId: string) {
  try {
    await db.setDefaultUserAddress(id, userId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to set default address" };
  }
}
