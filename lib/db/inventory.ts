/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { InventoryService } from "../services/inventory";
import { productsDb } from "./products";

export async function verifyStock(items: any[], sessionId?: string): Promise<{ success: boolean; message?: string }> {
  const { supabase, isSupabaseConfigured } = loadService();
  const formatted = items.map((item) => ({
    productName: item.productName,
    size: item.size || "M",
    color: item.color || "Default",
    quantity: item.quantity || 1,
  }));
  const result = await InventoryService.validateStock(formatted);
  if (!result.success) {
    return { success: false, message: result.errors.join(" | ") };
  }

  if (isSupabaseConfigured && supabase && sessionId) {
    const products = await productsDb.getProducts();
    const batchItems = formatted
      .map((item) => {
        const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
        return {
          product_id: product ? product.id : "",
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        };
      })
      .filter((item) => item.product_id !== "");

    if (batchItems.length > 0) {
      const { data, error } = await supabase.rpc("reserve_variant_inventory_batch_atomic", {
        p_items: batchItems,
        p_expires_mins: 15,
        p_session: sessionId,
      });

      if (error || (data && !data.success)) {
        await supabase.from("inventory_reservations").delete().eq("session_id", sessionId);
        return {
          success: false,
          message: data?.error || data?.errors?.join(" | ") || error?.message || "Failed to reserve batch inventory stock",
        };
      }
    }
  }

  return { success: true };
}

export async function logDeductionFailure(
  productId: string,
  size: string,
  color: string,
  quantity: number,
  orderId?: string
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
    const { error } = await supabase.from("deduction_failures").insert({
      product_id: productId,
      size,
      color,
      quantity,
      order_id: orderId,
      failed_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Failed to insert into deduction_failures:", error);
    }
  } catch (e: any) {
    console.error("deduction_failures table does not exist or write failed:", e.message);
  }
}

export async function deductStock(items: any[], sessionId?: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  const products = await productsDb.getProducts();
  for (const item of items) {
    const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
    if (!product) {
      console.error(`[deductStock] FAILED: Product "${item.productName}" not found in database.`);
      return false;
    }
    const size = (item.size || "M") as "S" | "M" | "L" | "XL" | "XXL";
    const color = item.color || "Default";
    const qty = item.quantity || 1;
    const success = await InventoryService.deductStockAtomic(product.id, size, color, qty, sessionId);
    if (!success) {
      console.error(`[deductStock] FAILED for ${product.id} ${size}/${color}, order=${sessionId}`);
      await logDeductionFailure(product.id, size, color, qty, sessionId);
      return false;
    }
  }
  if (isSupabaseConfigured && supabase && sessionId) {
    await supabase.from("inventory_reservations").update({ status: "fulfilled" }).eq("session_id", sessionId);
  }
  return true;
}

export async function restoreStock(items: any[], sessionId?: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  const products = await productsDb.getProducts();
  for (const item of items) {
    const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
    if (product) {
      const size = (item.size || "M") as "S" | "M" | "L" | "XL" | "XXL";
      const color = item.color || "Default";
      const qty = item.quantity || 1;
      await InventoryService.restoreStockAtomic(product.id, size, color, qty);
    }
  }
  if (isSupabaseConfigured && supabase && sessionId) {
    await supabase.from("inventory_reservations").update({ status: "cancelled" }).eq("session_id", sessionId);
  }
}

export async function restockProductVariants(
  productId: string,
  addPerVariant: { size: string; color: string; add: number }[]
): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  for (const { size, color, add } of addPerVariant) {
    if (add <= 0) continue;

    const { data: variants, error: fetchErr } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .eq("size", size)
      .eq("color", color);

    if (!fetchErr && variants && variants.length > 0) {
      const { error } = await supabase.rpc("restore_variant_stock", {
        p_product_id: productId,
        p_size: size,
        p_color: color,
        p_quantity: add,
      });
      if (error) {
        console.error("restockProductVariants error:", error);
        return false;
      }
    } else {
      const columnName = "size_stock_" + size.toLowerCase();
      const { data: productData, error: prodFetchErr } = await supabase
        .from("products")
        .select(columnName)
        .eq("id", productId)
        .single();

      if (prodFetchErr || !productData) {
        console.error("restockProductVariants product fallback fetch error:", prodFetchErr);
        return false;
      }

      const currentStock = (productData as any)[columnName] || 0;
      const { error: prodUpdateErr } = await supabase
        .from("products")
        .update({ [columnName]: currentStock + add })
        .eq("id", productId);

      if (prodUpdateErr) {
        console.error("restockProductVariants product fallback update error:", prodUpdateErr);
        return false;
      }

      const { data: updatedProd } = await supabase
        .from("products")
        .select("size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl")
        .eq("id", productId)
        .single();

      if (updatedProd) {
        const newTotalStock =
          (updatedProd.size_stock_s || 0) +
          (updatedProd.size_stock_m || 0) +
          (updatedProd.size_stock_l || 0) +
          (updatedProd.size_stock_xl || 0) +
          (updatedProd.size_stock_xxl || 0);
        await supabase.from("products").update({ stock: newTotalStock }).eq("id", productId);
      }
    }
  }

  await syncProductTotalStock(productId);

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");
  return true;
}

export async function adjustVariantStockBySize(productId: string, size: string, delta: number): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: variants, error: fetchErr } = await supabase
    .from("product_variants")
    .select("id, color, stock")
    .eq("product_id", productId)
    .eq("size", size);

  if (fetchErr) return false;

  if (variants && variants.length > 0) {
    const v = variants[0];
    const newStock = Math.max(0, v.stock + delta);
    const { error } = await supabase.from("product_variants").update({ stock: newStock }).eq("id", v.id);
    if (error) {
      console.error("adjustVariantStockBySize error:", error);
      return false;
    }
  } else {
    const columnName = "size_stock_" + size.toLowerCase();
    const { data: productData, error: prodFetchErr } = await supabase
      .from("products")
      .select(columnName)
      .eq("id", productId)
      .single();

    if (prodFetchErr || !productData) {
      console.error("adjustVariantStockBySize product fallback fetch error:", prodFetchErr);
      return false;
    }

    const currentStock = (productData as any)[columnName] || 0;
    const newStock = Math.max(0, currentStock + delta);
    const { error: prodUpdateErr } = await supabase
      .from("products")
      .update({ [columnName]: newStock })
      .eq("id", productId);

    if (prodUpdateErr) {
      console.error("adjustVariantStockBySize product fallback update error:", prodUpdateErr);
      return false;
    }
  }

  await syncProductTotalStock(productId);

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");
  return true;
}

export async function syncProductTotalStock(productId: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return false;

  const { data: variants } = await supabase.from("product_variants").select("size, stock").eq("product_id", productId);

  if (variants && variants.length > 0) {
    const derivedSizeStock: Record<string, number> = { s: 0, m: 0, l: 0, xl: 0, xxl: 0 };
    for (const v of variants) {
      const sizeKey = (v.size || "S").toLowerCase();
      derivedSizeStock[sizeKey] = (derivedSizeStock[sizeKey] || 0) + (v.stock || 0);
    }
    const totalStock = Object.values(derivedSizeStock).reduce((sum, n) => sum + n, 0);

    const { error } = await supabase
      .from("products")
      .update({
        stock: totalStock,
        size_stock_s: derivedSizeStock.s,
        size_stock_m: derivedSizeStock.m,
        size_stock_l: derivedSizeStock.l,
        size_stock_xl: derivedSizeStock.xl,
        size_stock_xxl: derivedSizeStock.xxl,
      })
      .eq("id", productId);

    if (error) {
      console.error("syncProductTotalStock update error:", error);
      return false;
    }
  } else {
    const { data: product } = await supabase
      .from("products")
      .select("size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl")
      .eq("id", productId)
      .single();

    if (product) {
      const totalStock =
        (product.size_stock_s || 0) +
        (product.size_stock_m || 0) +
        (product.size_stock_l || 0) +
        (product.size_stock_xl || 0) +
        (product.size_stock_xxl || 0);
      await supabase.from("products").update({ stock: totalStock }).eq("id", productId);
    }
  }
  return true;
}

export async function releaseReservation(sessionId: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (isSupabaseConfigured && supabase) {
    await supabase.from("inventory_reservations").update({ status: "RELEASED" }).eq("session_id", sessionId);
  }
}

export const inventoryDb = {
  verifyStock,
  logDeductionFailure,
  deductStock,
  restoreStock,
  restockProductVariants,
  adjustVariantStockBySize,
  syncProductTotalStock,
  releaseReservation,
};
