/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadService } from "./client-raw";
import { CacheService } from "../cache";
import { mapDbProductToProduct } from "./utils";
import { Product, ProductVariant } from "../types";
import { PRODUCT_CACHE_TTL_SECS, PRODUCT_LIST_CACHE_TTL_SECS } from "../inventory-config";

// Standalone variants attacher (moved from db.ts)
export async function attachVariantsToProducts(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const productIds = products.map((p) => p.id);
  const { data: allVariants } = await supabase
    .from("product_variants")
    .select("id, product_id, size, color, sku, price, stock")
    .in("product_id", productIds);

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of allVariants || []) {
    const arr = variantsByProduct.get(v.product_id) || [];
    arr.push({
      id: v.id,
      productId: v.product_id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      price: Number(v.price),
      stock: v.stock || 0,
    });
    variantsByProduct.set(v.product_id, arr);
  }

  return products.map((p) => {
    const variants = variantsByProduct.get(p.id) || [];

    const derivedSizeStock: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    for (const v of variants) {
      derivedSizeStock[v.size] = (derivedSizeStock[v.size] || 0) + v.stock;
    }

    const finalSizeStock = variants.length > 0 ? derivedSizeStock : p.sizeStock;
    const totalStock = Object.values(finalSizeStock || {}).reduce(
      (sum, n) => sum + (n || 0),
      0
    );

    const derivedColors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));
    const finalColors = variants.length > 0 ? derivedColors : p.colors;
    const safeColors = finalColors && finalColors.length > 0 ? finalColors : ["Default"];

    return {
      ...p,
      sizeStock: finalSizeStock,
      stock: totalStock,
      colors: safeColors,
      variants,
    };
  });
}

export async function getProducts(options?: {
  includeDeleted?: boolean;
  trashedOnly?: boolean;
  display_section?: string;
  adminView?: boolean;
}): Promise<Product[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  let cacheKey = options?.trashedOnly
    ? "products:list:trashed"
    : options?.includeDeleted
      ? "products:list:all"
      : options?.adminView
        ? "products:list:admin"
        : "products:list";
  if (options?.display_section) {
    cacheKey += `:section:${options.display_section}`;
  }
  const cached = await CacheService.get<Product[]>(cacheKey);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  let query = supabase
    .from("products")
    .select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords, reorder_point")
    .order("created_at", { ascending: false });

  if (options?.trashedOnly) {
    query = query.not("deleted_at", "is", null);
  } else if (!options?.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (options?.display_section) {
    query = query.filter("display_sections", "cs", `["${options.display_section}"]`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching products from Supabase:", error);
    return [];
  }
  const mapped = (data || []).map(mapDbProductToProduct);
  const res = await attachVariantsToProducts(mapped);
  await CacheService.set(cacheKey, res, PRODUCT_LIST_CACHE_TTL_SECS);
  return res;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price, base_price, gst_rate, stock, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, deleted_at, product_status")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    console.error("getProductsByIds error:", error);
    return [];
  }

  return (data || []).map(mapDbProductToProduct);
}

export async function saveProduct(product: Partial<Product>): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  let baseSlug = product.slug || (product.title ? product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") : "untitled-product");
  if (baseSlug.length > 150) {
    baseSlug = baseSlug.slice(0, 150).replace(/-+$/, "");
  }
  let uniqueSlug = baseSlug;
  let suffix = 2;
  let attempts = 0;
  let dbPayload: any;

  while (attempts < 5) {
    while (true) {
      let query = supabase.from("products").select("id").eq("slug", uniqueSlug);
      if (product.id) {
        query = query.neq("id", product.id);
      }
      const { data: existingSlug } = await query.maybeSingle();
      if (!existingSlug) {
        break;
      }
      uniqueSlug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    dbPayload = {
      id: product.id || "ART-" + Date.now(),
      slug: uniqueSlug,
      title: product.title || "Untitled Product",
      price: product.price || 0,
      compare_price: product.comparePrice || 0,
      category: product.category || "Cotton",
      image: product.image || (product.images && product.images[0]) || "",
      images: product.images || [product.image || ""],
      is_new: product.isNew !== undefined ? product.isNew : true,
      stock: product.stock || 0,
      description: product.description || "",
      is_atelier_exclusive: product.isAtelierExclusive || false,
      size_stock_s: product.sizeStock?.S || 0,
      size_stock_m: product.sizeStock?.M || 0,
      size_stock_l: product.sizeStock?.L || 0,
      size_stock_xl: product.sizeStock?.XL || 0,
      size_stock_xxl: product.sizeStock?.XXL || 0,
      base_price: product.basePrice || 0,
      gst_rate: product.gstRate || 12,
      discount_rate: product.discountRate || 0,
      spec_fabric: product.specFabric || "",
      spec_fit: product.specFit || "",
      spec_collar: product.specCollar || "",
      spec_sleeve: product.specSleeve || "",
      spec_care: product.specCare || "",
      custom_badge: product.customBadge || "",
      featured: product.featured || false,
      bestseller: product.bestseller || false,
      material: product.material || "",
      colors: product.colors || [],
      ratings: product.ratings || 5.0,
      display_sections: product.display_sections || [],
      compare_at_price: product.compareAtPrice || null,
      weight_grams: product.weightGrams || null,
      product_status: product.productStatus || "active",
      seo_title: product.seoTitle || null,
      seo_description: product.seoDescription || null,
      seo_keywords: product.seoKeywords || null,
      reorder_point: product.reorderPoint ?? null,
    };

    const { error } = await supabase.from("products").upsert(dbPayload);
    if (error) {
      console.error("Error saving product to Supabase:", error);
      if (error.code === "23505") {
        if (error.message?.includes("slug") || error.details?.includes("slug") || error.message?.includes("products_slug_key")) {
          uniqueSlug = `${baseSlug}-${suffix}`;
          suffix++;
          attempts++;
          continue;
        }
        throw new Error("Product SKU already exists.");
      }
      throw error;
    }
    break;
  }

  if (product.variants && product.variants.length > 0) {
    const productId = dbPayload.id;
    const uniqueVariantsMap = new Map<string, typeof product.variants[0]>();
    for (const v of product.variants) {
      const key = `${v.size}|${v.color}`;
      uniqueVariantsMap.set(key, v);
    }
    const uniqueVariants = Array.from(uniqueVariantsMap.values());

    const variantRows = [];
    for (const v of uniqueVariants) {
      const sku = v.sku || `${productId}-${v.size}-${v.color.slice(0, 3).toUpperCase()}`;

      // Pre-check for duplicate SKU belonging to a different product to give a friendly error
      const { data: otherVariant } = await supabase
        .from("product_variants")
        .select("id")
        .eq("sku", sku)
        .neq("product_id", productId)
        .maybeSingle();

      if (otherVariant) {
        throw new Error("Variant SKU already exists.");
      }

      const { data: existingVar } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", productId)
        .eq("size", v.size)
        .eq("color", v.color)
        .maybeSingle();

      const rowPayload: any = {
        product_id: productId,
        size: v.size,
        color: v.color,
        sku,
        price: v.price ?? product.basePrice ?? product.price ?? 0,
        stock: v.stock ?? 0,
      };
      if (existingVar?.id) {
        rowPayload.id = existingVar.id;
      }
      variantRows.push(rowPayload);
    }

    const { error: varErr } = await supabase
      .from("product_variants")
      .upsert(variantRows, { onConflict: "id" });
    if (varErr) {
      console.error("Error upserting product variants:", varErr);
      if (varErr.code === "23505") {
        throw new Error("Variant SKU already exists.");
      }
      throw varErr;
    }
  }

  if (product.variants !== undefined) {
    const productId = dbPayload.id;
    const incomingKeys = new Set(
      (product.variants || []).map((v) => `${v.size}|${v.color}`)
    );
    const { data: existing } = await supabase
      .from("product_variants")
      .select("id, size, color")
      .eq("product_id", productId);

    const toDelete = (existing || []).filter(
      (e: any) => !incomingKeys.has(`${e.size}|${e.color}`)
    );
    if (toDelete.length > 0) {
      await supabase
        .from("product_variants")
        .delete()
        .in("id", toDelete.map((e: any) => e.id));
    }
  }

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const { supabase, isSupabaseConfigured } = loadService();
  const cacheKey = `products:slug:${slug}`;
  const cached = await CacheService.get<Product>(cacheKey);
  if (cached) return cached;

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords, reorder_point")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error fetching product by slug from Supabase:", error);
    return undefined;
  }
  const mapped = data ? mapDbProductToProduct(data) : undefined;
  if (!mapped) return undefined;
  const [res] = await attachVariantsToProducts([mapped]);
  await CacheService.set(cacheKey, res, PRODUCT_CACHE_TTL_SECS);
  return res;
}

export async function getProductById(id: string, options?: { adminView?: boolean }): Promise<Product | undefined> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  let query = supabase
    .from("products")
    .select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords")
    .eq("id", id);

  if (options?.adminView) {
    query = query.is("deleted_at", null);
  } else {
    query = query.is("deleted_at", null).or("product_status.eq.active,product_status.is.null");
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Error fetching product by ID from Supabase:", error);
    return undefined;
  }
  const mapped = data ? mapDbProductToProduct(data) : undefined;
  if (!mapped) return undefined;
  const [res] = await attachVariantsToProducts([mapped]);
  return res;
}

export async function relatedProducts(slug: string): Promise<Product[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const current = await getProductBySlug(slug);
  if (!current) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords")
    .neq("slug", slug)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching related products from Supabase:", error);
    return [];
  }

  const mapped = (data || []).map(mapDbProductToProduct);
  const sameCategory = mapped.filter((p) => p.category === current.category);
  const diffCategory = mapped.filter((p) => p.category !== current.category);
  return [...sameCategory, ...diffCategory].slice(0, 4);
}

export async function logProductAudit(
  action: "soft_delete" | "restore" | "permanent_delete",
  productId: string,
  productTitle: string,
  adminUserId?: string,
  adminUserEmail?: string,
  reason?: string
): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from("product_audit_logs").insert({
    action,
    product_id: productId,
    product_title: productTitle,
    admin_user_id: adminUserId || null,
    admin_user_email: adminUserEmail || "system",
    reason: reason || null,
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    console.error("Error deleting product from Supabase:", error);
    throw error;
  }

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");
}

export async function softDeleteProduct(
  id: string,
  adminUserId?: string,
  adminUserEmail?: string,
  reason?: string
): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: existing } = await supabase
    .from("products")
    .select("title, slug")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return false;

  const deletionTime = new Date();
  deletionTime.setDate(deletionTime.getDate() + 7);

  const { error } = await supabase
    .from("products")
    .update({
      deleted_at: new Date().toISOString(),
      scheduled_permanent_deletion_at: deletionTime.toISOString(),
    })
    .eq("id", id);

  if (error) return false;

  await logProductAudit("soft_delete", id, existing.title, adminUserId, adminUserEmail, reason);

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");

  return true;
}

export async function restoreProduct(id: string, adminUserId?: string, adminUserEmail?: string): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const { data: existing } = await supabase
    .from("products")
    .select("title, slug")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return false;

  const { error } = await supabase
    .from("products")
    .update({
      deleted_at: null,
      scheduled_permanent_deletion_at: null,
    })
    .eq("id", id);

  if (error) return false;

  await logProductAudit("restore", id, existing.title, adminUserId, adminUserEmail);

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");

  return true;
}

export async function permanentlyDeleteProduct(
  id: string,
  adminUserId?: string,
  adminUserEmail?: string,
  reason?: string
): Promise<void> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection not configured.");
  }

  const { data: product, error: fetchErr } = await supabase
    .from("products")
    .select("title, image, images")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !product) {
    throw new Error(fetchErr?.message || "Product not found for permanent deletion.");
  }

  const imageUrls: string[] = [];
  if (product.image) imageUrls.push(product.image);
  if (product.images && Array.isArray(product.images)) {
    imageUrls.push(...product.images);
  }

  const publicIds = imageUrls
    .map((url) => {
      const match = url.match(/\/image\/upload\/(?:v\d+\/)?([^.]+)/);
      return match ? match[1] : null;
    })
    .filter((id): id is string => !!id);

  if (publicIds.length > 0) {
    const { cloudinary } = await import("../cloudinary");
    for (const publicId of publicIds) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryErr) {
        console.error(`[Cloudinary Cleanup] Failed to delete asset "${publicId}":`, cloudinaryErr);
      }
    }
  }

  const { error: deleteErr } = await supabase.from("products").delete().eq("id", id);

  if (deleteErr) {
    console.error("[permanentlyDeleteProduct] Database delete failed:", deleteErr);
    throw deleteErr;
  }

  await logProductAudit("permanent_delete", id, product.title, adminUserId, adminUserEmail, reason);

  await CacheService.delPattern("products:list*");
  await CacheService.delPattern("products:slug:*");
}

export async function getActiveProductIds(productIds: string[]): Promise<string[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .is("deleted_at", null);

  if (error) {
    console.error("Error validating product IDs:", error);
    return [];
  }
  return (data || []).map((p) => p.id);
}

export async function submitReview(review: { name: string; location: string; rating: number; comment: string; ip_hash?: string; product_id?: string; order_id?: string }) {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("reviews").insert([review]);
  return !error;
}

export async function getReviews(filter?: { approved?: boolean; limit?: number; offset?: number }) {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  let q = supabase
    .from("reviews")
    .select("id, rating, comment, name, location, approved, created_at, approved_by")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filter && typeof filter.approved === "boolean") {
    q = q.eq("approved", filter.approved);
  }

  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
  return data || [];
}

export async function updateReviewStatus(id: string, approved: boolean, approvedBy?: string) {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const updateData: any = { approved };
  if (approved && approvedBy) {
    updateData.approved_by = approvedBy;
  }
  const { error } = await supabase.from("reviews").update(updateData).eq("id", id);
  return !error;
}

export async function deleteReview(id: string) {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase
    .from("reviews")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function updateReview(id: string, review: { comment?: string; rating?: number }) {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Database connection not configured. " +
      "Check NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  const { error } = await supabase.from("reviews").update(review).eq("id", id);
  return !error;
}

export async function getProductAuditLogs(productId: string): Promise<any[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("product_audit_logs")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching product audit logs:", error);
    return [];
  }
  return data || [];
}

export async function getAllProductAuditLogs(limit: number = 100): Promise<any[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("product_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Error fetching all product audit logs:", error);
    return [];
  }
  return data || [];
}

export async function getTrackingLogs(limit: number = 100): Promise<any[]> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("tracking_logs")
    .select(`
      id,
      shipment_id,
      raw_payload,
      created_at,
      shipments:shipment_id (
        awb_code,
        order_id,
        status
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Error fetching tracking logs:", error);
    return [];
  }
  return data || [];
}

export async function updateProductReorderPoint(productId: string, reorderPoint: number | null): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) return false;
  const { error } = await supabase
    .from("products")
    .update({ reorder_point: reorderPoint })
    .eq("id", productId);
  if (error) {
    console.error("Error updating product reorder point:", error);
    return false;
  }
  await CacheService.delPattern("products:list*");
  await CacheService.delPattern(`products:slug:*`);
  return true;
}

export const productsDb = {
  getProducts,
  getProductsByIds,
  saveProduct,
  getProductBySlug,
  getProductById,
  relatedProducts,
  logProductAudit,
  deleteProduct,
  softDeleteProduct,
  restoreProduct,
  permanentlyDeleteProduct,
  getActiveProductIds,
  submitReview,
  getReviews,
  updateReviewStatus,
  deleteReview,
  updateReview,
  getProductAuditLogs,
  getAllProductAuditLogs,
  getTrackingLogs,
  updateProductReorderPoint,
};
