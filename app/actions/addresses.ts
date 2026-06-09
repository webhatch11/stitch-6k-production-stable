"use server";

import { db } from "@/lib/db";
import { UserAddress } from "@/lib/registry";

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
    const saved = await db.saveUserAddress(address);
    return { success: true, address: saved };
  } catch (error: any) {
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
