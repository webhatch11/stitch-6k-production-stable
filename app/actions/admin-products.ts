"use server";

import { getServerUser } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Product } from "@/lib/registry";
import { z } from "zod";

const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title required").max(200),
  category: z.string().min(1),
  description: z.string().max(2000).optional(),
  basePrice: z.number().nonnegative(),
  gstRate: z.number().min(0).max(28),
  discountRate: z.number().min(0).max(100),
  image: z.string().url().or(z.literal("")).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  sizeStock: z
    .object({
      S: z.number().int().nonnegative(),
      M: z.number().int().nonnegative(),
      L: z.number().int().nonnegative(),
      XL: z.number().int().nonnegative(),
      XXL: z.number().int().nonnegative(),
    })
    .optional(),
  specFabric: z.string().optional(),
  specFit: z.string().optional(),
  specCollar: z.string().optional(),
  specSleeve: z.string().optional(),
  specCare: z.string().optional(),
  isNew: z.boolean().optional(),
  isAtelierExclusive: z.boolean().optional(),
  customBadge: z.string().optional(),
});

export async function saveProductAction(input: unknown) {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized — admin required" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten(),
    };
  }

  const data = parsed.data;

  const totalStock = data.sizeStock
    ? data.sizeStock.S + data.sizeStock.M + data.sizeStock.L +
      data.sizeStock.XL + data.sizeStock.XXL
    : 0;

  const finalPrice =
    data.basePrice * (1 + data.gstRate / 100) * (1 - data.discountRate / 100);

  const payload: Partial<Product> = {
    ...data,
    price: Math.round(finalPrice),
    stock: totalStock,
  };

  try {
    await db.saveProduct(payload);
    revalidatePath("/admindashboard/inventory");
    revalidatePath("/shopallshirts");
    revalidatePath("/genz");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    console.error("[saveProductAction] error:", e);
    return { success: false, error: e.message || "Save failed" };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await requireAdmin();
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid product ID" };
    }
    const ok = await db.softDeleteProduct(id);
    if (!ok) return { success: false, error: "Product not found" };
    revalidatePath("/admindashboard/inventory");
    revalidatePath("/shopallshirts");
    revalidatePath("/genz");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to delete product" };
  }
}

export async function restoreProductAction(id: string) {
  try {
    await requireAdmin();
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid product ID" };
    }
    const ok = await db.restoreProduct(id);
    if (!ok) return { success: false, error: "Product not found" };
    revalidatePath("/admindashboard/inventory");
    revalidatePath("/shopallshirts");
    revalidatePath("/genz");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to restore product" };
  }
}

export async function restockProductAction(
  productId: string,
  addPerSize: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }
  if (!productId?.trim()) return { success: false, error: "Invalid product ID" };
  if (!Number.isInteger(addPerSize) || addPerSize <= 0) {
    return { success: false, error: "addPerSize must be a positive integer" };
  }
  try {
    const products = await db.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, error: "Product not found" };
    const s = product.sizeStock || {};
    const newSizeStock = {
      S: (s.S || 0) + addPerSize,
      M: (s.M || 0) + addPerSize,
      L: (s.L || 0) + addPerSize,
      XL: (s.XL || 0) + addPerSize,
      XXL: (s.XXL || 0) + addPerSize,
    };
    const newTotal =
      newSizeStock.S + newSizeStock.M + newSizeStock.L + newSizeStock.XL + newSizeStock.XXL;
    await db.saveProduct({ ...product, sizeStock: newSizeStock, stock: newTotal });
    return { success: true };
  } catch (e: any) {
    console.error("[restockProductAction]", e);
    return { success: false, error: e.message || "Restock failed" };
  }
}

export async function adjustProductSizeAction(
  productId: string,
  size: "S" | "M" | "L" | "XL" | "XXL",
  diff: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }
  if (!productId?.trim()) return { success: false, error: "Invalid product ID" };
  const validSizes = ["S", "M", "L", "XL", "XXL"];
  if (!validSizes.includes(size)) return { success: false, error: "Invalid size" };
  if (!Number.isInteger(diff) || diff === 0) {
    return { success: false, error: "diff must be a non-zero integer" };
  }
  try {
    const products = await db.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, error: "Product not found" };
    const s = product.sizeStock || {};
    const newVal = Math.max(0, (s[size] || 0) + diff);
    const newSizeStock = { ...s, [size]: newVal };
    const newTotal =
      (newSizeStock.S || 0) +
      (newSizeStock.M || 0) +
      (newSizeStock.L || 0) +
      (newSizeStock.XL || 0) +
      (newSizeStock.XXL || 0);
    await db.saveProduct({ ...product, sizeStock: newSizeStock, stock: newTotal });
    return { success: true };
  } catch (e: any) {
    console.error("[adjustProductSizeAction]", e);
    return { success: false, error: e.message || "Adjust failed" };
  }
}
