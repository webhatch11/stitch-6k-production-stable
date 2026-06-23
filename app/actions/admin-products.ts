"use server";

import { getServerUser } from "@/lib/supabase-server";
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
    return { success: true };
  } catch (e: any) {
    console.error("[saveProductAction] error:", e);
    return { success: false, error: e.message || "Save failed" };
  }
}

export async function deleteProductAction(productId: string) {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  if (!productId || typeof productId !== "string") {
    return { success: false, error: "Invalid product ID" };
  }

  try {
    await db.deleteProduct(productId);
    return { success: true };
  } catch (e: any) {
    console.error("[deleteProductAction] error:", e);
    return { success: false, error: e.message || "Delete failed" };
  }
}
