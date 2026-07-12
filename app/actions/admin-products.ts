"use server";

import { getServerUser } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Product } from "@/lib/types";
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
  variants: z.array(z.object({
    size: z.string().min(1),
    color: z.string().min(1),
    sku: z.string(),
    price: z.number().min(0),
    stock: z.number().int().min(0),
  })).optional(),
  display_sections: z.array(z.enum(["new_arrivals", "bestsellers", "atelier_exclusives", "genz"])).optional(),
  compareAtPrice: z.number().nullable().optional(),
  weightGrams: z.number().nullable().optional(),
  productStatus: z.enum(["active", "draft", "archived"]).optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoKeywords: z.string().nullable().optional(),
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

export async function deleteProductAction(id: string, reason?: string) {
  try {
    const adminUser = await requireAdmin();
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid product ID" };
    }
    const ok = await db.softDeleteProduct(id, adminUser.id, adminUser.email, reason);
    if (!ok) return { success: false, error: "Product not found" };
    revalidatePath("/admindashboard/inventory");
    revalidatePath("/shopallshirts");
    revalidatePath("/genz");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    console.error('[admin-products.ts]:', e);
    return { success: false, error: e.message || "Failed to delete product" };
  }
}

export async function restoreProductAction(id: string) {
  try {
    const adminUser = await requireAdmin();
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid product ID" };
    }
    const ok = await db.restoreProduct(id, adminUser.id, adminUser.email);
    if (!ok) return { success: false, error: "Product not found" };
    revalidatePath("/admindashboard/inventory");
    revalidatePath("/shopallshirts");
    revalidatePath("/genz");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    console.error('[admin-products.ts]:', e);
    return { success: false, error: e.message || "Failed to restore product" };
  }
}

export async function permanentlyDeleteProductAction(id: string, reason?: string) {
  try {
    const adminUser = await requireAdmin();
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid product ID" };
    }
    await db.permanentlyDeleteProduct(id, adminUser.id, adminUser.email, reason);
    revalidatePath("/admindashboard/inventory");
    revalidatePath("/shopallshirts");
    revalidatePath("/genz");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    console.error('[admin-products.ts]:', e);
    return { success: false, error: e.message || "Failed to permanently delete product" };
  }
}

export async function restockVariantAction(
  productId: string,
  size: "S" | "M" | "L" | "XL" | "XXL",
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!productId?.trim()) return { success: false, error: "Invalid product ID" };
    const validSizes = ["S", "M", "L", "XL", "XXL"];
    if (!validSizes.includes(size)) return { success: false, error: "Invalid size" };
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, error: "quantity must be a positive integer" };
    }

    const products = await db.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, error: "Product not found" };

    // Find the colors of variants matching the target size
    const matchingVariants = product.variants?.filter((v) => v.size === size);

    const addPerVariant = (matchingVariants && matchingVariants.length > 0)
      ? matchingVariants.map((v) => ({
          size,
          color: v.color,
          add: quantity,
        }))
      : [{
          size,
          color: (product.colors && product.colors[0]) || "Default",
          add: quantity,
        }];

    const ok = await db.restockProductVariants(productId, addPerVariant);
    if (!ok) return { success: false, error: "Restock failed" };

    revalidatePath("/admindashboard/inventory");
    return { success: true };
  } catch (e: any) {
    console.error("[restockVariantAction]", e);
    return { success: false, error: e.message || "Restock failed" };
  }
}

export async function adjustProductSizeAction(
  productId: string,
  size: "S" | "M" | "L" | "XL" | "XXL",
  diff: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!productId?.trim()) return { success: false, error: "Invalid product ID" };
    const validSizes = ["S", "M", "L", "XL", "XXL"];
    if (!validSizes.includes(size)) return { success: false, error: "Invalid size" };
    if (!Number.isInteger(diff) || diff === 0) {
      return { success: false, error: "diff must be a non-zero integer" };
    }

    const ok = await db.adjustVariantStockBySize(productId, size, diff);
    if (!ok) return { success: false, error: "Adjust failed" };

    revalidatePath("/admindashboard/inventory");
    return { success: true };
  } catch (e: any) {
    console.error("[adjustProductSizeAction]", e);
    return { success: false, error: e.message || "Adjust failed" };
  }
}
