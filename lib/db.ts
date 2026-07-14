import { Product, ProductVariant, Order, Coupon, WalletTransaction, LoyaltyTransaction, UserAddress, OrderStatusHistory, Shipment, ShipmentEvent, TrackingLog, OrderNote } from "./types";
import { ShippingRules } from "./shipping";
import { CacheService } from "./cache";
import { InventoryService } from "./services/inventory";
import { shiprocket } from "./shiprocket";
import { CartItem } from "@/stores/cartStore";
import { PRODUCT_CACHE_TTL_SECS, PRODUCT_LIST_CACHE_TTL_SECS } from "./inventory-config";

const DEFAULT_PICKUP_LOCATION = 
  process.env.SHIPROCKET_PICKUP_LOCATION || 
  "Primary Warehouse";

// Lazy-loaded service client. The supabase-service module is server-only
// (it carries SUPABASE_SERVICE_ROLE_KEY and has a browser-throw guard).
// We import it dynamically inside a server-only branch so it never enters
// client bundles.

type ServiceModule = typeof import("./supabase-service");
let _serviceMod: ServiceModule | null = null;

function loadService(): { supabase: ServiceModule["supabaseService"] | null; isSupabaseConfigured: boolean } {
  if (typeof window !== "undefined") {
    return { supabase: null, isSupabaseConfigured: false };
  }
  if (!_serviceMod) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _serviceMod = require("./supabase-service") as ServiceModule;
  }
  return {
    supabase: _serviceMod.supabaseService,
    isSupabaseConfigured: _serviceMod.isServiceClientConfigured,
  };
}

// NOTE: BullMQ job scheduling and workers run ONLY in the dedicated worker
// process (lib/jobs/worker.ts, started via `npm run worker` with IS_WORKER=true).
// The web/Next.js process is a pure producer — it enqueues jobs (e.g. via
// dispatchFulfillment) but must never instantiate Workers, otherwise a
// separately-deployed worker would double-process every queue.

// Helper mappings for Database compatibility
const mapDbProductToProduct = (p: any): Product => {
  if (!p) return p;
  return {
    id: p.id,
    slug: p.slug || "",
    title: p.title,
    price: Number(p.price),
    comparePrice: p.compare_price ? Number(p.compare_price) : undefined,
    category: p.category,
    image: p.image,
    images: p.images || [],
    isNew: p.is_new,
    stock: p.stock,
    description: p.description,
    isAtelierExclusive: p.is_agent_exclusive || p.is_atelier_exclusive,
    sizeStock: {
      S: p.size_stock_s || 0,
      M: p.size_stock_m || 0,
      L: p.size_stock_l || 0,
      XL: p.size_stock_xl || 0,
      XXL: p.size_stock_xxl || 0,
    },
    basePrice: p.base_price ? Number(p.base_price) : undefined,
    gstRate: p.gst_rate ? Number(p.gst_rate) : undefined,
    discountRate: p.discount_rate ? Number(p.discount_rate) : undefined,
    specFabric: p.spec_fabric,
    specFit: p.spec_fit,
    specCollar: p.spec_collar,
    specSleeve: p.spec_sleeve,
    specCare: p.spec_care,
    customBadge: p.custom_badge || p.customBadge || "",
    featured: p.featured || false,
    bestseller: p.bestseller || false,
    material: p.material || "",
    colors: p.colors || [],
    ratings: p.ratings ? Number(p.ratings) : undefined,
    reviews: p.reviews || [],
    deleted_at: p.deleted_at || null,
    deletedAt: p.deleted_at || null,
    scheduledPermanentDeletionAt: p.scheduled_permanent_deletion_at || null,
    display_sections: p.display_sections || [],
    compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : (p.compare_price ? Number(p.compare_price) : null),
    weightGrams: p.weight_grams || null,
    productStatus: p.product_status || 'active',
    seoTitle: p.seo_title || null,
    seoDescription: p.seo_description || null,
    seoKeywords: p.seo_keywords || null,
  };
};

async function attachVariantsToProducts(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

  const productIds = products.map((p) => p.id);
  const { data: allVariants } = await supabase
    .from("product_variants").select("id, product_id, size, color, sku, price, stock")
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

    // Derive sizeStock from variants (sum stock across all colors per size)
    const derivedSizeStock: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    for (const v of variants) {
      derivedSizeStock[v.size] = (derivedSizeStock[v.size] || 0) + v.stock;
    }

    // Use derived sizeStock if variants exist; fall back to legacy columns otherwise
    const finalSizeStock = variants.length > 0 ? derivedSizeStock : p.sizeStock;
    const totalStock = Object.values(finalSizeStock || {}).reduce(
      (sum, n) => sum + (n || 0),
      0
    );

    // Derive available colors dynamically from variants
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

const mapDbOrderToOrder = (o: any): Order => {
  if (!o) return o;
  return {
    id: o.id,
    customer: o.customer,
    date: o.date,
    total: Number(o.total),
    status: o.status,
    items: o.items || [],
    originalTotal: Number(o.original_total),
    couponDiscount: Number(o.coupon_discount || 0),
    couponCode: o.coupon_code || "",
    walletPaid: Number(o.wallet_paid || 0),
    gatewayPaid: Number(o.gateway_paid || 0),
    pointsRedeemed: Number(o.points_redeemed || 0),
    pointsDiscount: Number(o.points_discount || 0),
    pointsEarned: Number(o.points_earned || 0),
    returnReason: o.return_reason,
    returnDetails: o.return_details,
    returnImage: o.return_image,
    refundOption: o.refund_option,
    returnRequestDate: o.return_request_date,
    returnDate: o.return_date,
    returnRejectReason: o.return_reject_reason,
    qualityCheckPassed: o.quality_check_passed,
    shiprocketId: o.shiprocket_id || o.shiprocketId || "",
    cartItems: o.cart_items || [],
    paymentStatus: o.payment_status || o.paymentStatus || "",
    userId: o.user_id || undefined,
    address_snapshot: o.address_snapshot || null,
    refund_id: o.refund_id || undefined,
    refund_amount: o.refund_amount != null ? Number(o.refund_amount) : undefined,
    refund_status: o.refund_status || undefined,
    refund_reason: o.refund_reason || undefined,
    refunded_at: o.refunded_at || undefined,
    razorpay_payment_id: o.razorpay_payment_id || undefined,
    created_at: o.created_at || undefined,
    createdAt: o.created_at || undefined,
    delivered_at: o.delivered_at || undefined,
    deliveredAt: o.delivered_at || undefined,
    return_awb: o.return_awb || undefined,
    returnAwb: o.return_awb || undefined,
    return_pickup_scheduled: o.return_pickup_scheduled || undefined,
    returnPickupScheduled: o.return_pickup_scheduled || undefined,
    utm_source: o.utm_source || undefined,
    utmSource: o.utm_source || undefined,
    utm_medium: o.utm_medium || undefined,
    utmMedium: o.utm_medium || undefined,
    utm_campaign: o.utm_campaign || undefined,
    utmCampaign: o.utm_campaign || undefined,
    shippingAmount: o.shipping_amount != null ? Number(o.shipping_amount) : 0,
    shipping_amount: o.shipping_amount != null ? Number(o.shipping_amount) : 0,
  };
};

const mapDbAddressToUserAddress = (a: any): UserAddress => {
  if (!a) return a;
  return {
    id: a.id,
    user_id: a.user_id,
    name: a.name,
    phone: a.phone,
    address_line_1: a.address_line_1 || a.address_line1 || "",
    address_line_2: a.address_line_2 || a.address_line2 || "",
    city: a.city,
    state: a.state,
    postal_code: a.postal_code,
    country: a.country,
    is_default: !!a.is_default,
  };
};

const mapDbCouponToCoupon = (c: any): Coupon => {
  if (!c) return c;
  return {
    id: c.id,
    code: c.code,
    discount: Number(c.discount),
    type: c.type,
    active: c.active,
    expiryDate: c.expiry_date || c.expiryDate || null,
    minCartValue: (c.min_cart_value !== null && c.min_cart_value !== undefined) ? Number(c.min_cart_value) : ((c.minCartValue !== null && c.minCartValue !== undefined) ? Number(c.minCartValue) : null),
    maxUsage: (c.max_usage !== null && c.max_usage !== undefined) ? Number(c.max_usage) : ((c.maxUsage !== null && c.maxUsage !== undefined) ? Number(c.maxUsage) : null),
    usageCount: (c.usage_count !== null && c.usage_count !== undefined) ? Number(c.usage_count) : ((c.usageCount !== null && c.usageCount !== undefined) ? Number(c.usageCount) : 0),
    min_cart_value: (c.min_cart_value !== null && c.min_cart_value !== undefined) ? Number(c.min_cart_value) : ((c.minCartValue !== null && c.minCartValue !== undefined) ? Number(c.minCartValue) : null),
    max_usage: (c.max_usage !== null && c.max_usage !== undefined) ? Number(c.max_usage) : ((c.maxUsage !== null && c.maxUsage !== undefined) ? Number(c.maxUsage) : null),
    usage_count: (c.usage_count !== null && c.usage_count !== undefined) ? Number(c.usage_count) : ((c.usageCount !== null && c.usageCount !== undefined) ? Number(c.usageCount) : 0),
    buyQuantity: c.buy_quantity !== undefined ? c.buy_quantity : (c.buyQuantity || null),
    getQuantity: c.get_quantity !== undefined ? c.get_quantity : (c.getQuantity || null),
    getDiscountPercent: c.get_discount_percent !== undefined ? c.get_discount_percent : (c.getDiscountPercent || null),
    buyProductId: c.buy_product_id !== undefined ? c.buy_product_id : (c.buyProductId || null),
    getProductId: c.get_product_id !== undefined ? c.get_product_id : (c.getProductId || null),
  };
};

export interface CategorySales {
  category: string;
  revenue: number;
  orderCount: number;
  unitsSold: number;
  percentage: number;
}

export interface RepeatPurchaseStats {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}

export interface AdSpend {
  id?: string;
  channel: string;
  month: string;
  spendAmount: number;
  campaignName?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface ROASReport {
  channel: string;
  month: string;
  spend: number;
  revenue: number;
  roas: number;
  roasFormatted: string;
}

export const db = {
  // --- Products ---
  async getProducts(options?: { includeDeleted?: boolean; trashedOnly?: boolean; display_section?: string; adminView?: boolean }): Promise<Product[]> {
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
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    let query = supabase
      .from("products").select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords")
      .order("created_at", { ascending: false });

    if (options?.trashedOnly) {
      query = query.not("deleted_at", "is", null);
    } else if (options?.adminView) {
      // Admin view: show all non-deleted (active, draft, archived) but not trashed
      query = query.is("deleted_at", null);
    } else if (!options?.includeDeleted) {
      // Storefront: only active products
      query = query.is("deleted_at", null).or("product_status.eq.active,product_status.is.null");
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
  },

  async saveProduct(product: Partial<Product>): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    // Invalidate caches
    await CacheService.delPattern("products:list*");
    await CacheService.delPattern("products:slug:*");

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const dbPayload = {
      id: product.id || "ART-" + Date.now(),
      slug: product.slug || (product.title ? product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") : "untitled-product"),
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
      product_status: product.productStatus || 'active',
      seo_title: product.seoTitle || null,
      seo_description: product.seoDescription || null,
      seo_keywords: product.seoKeywords || null,
    };

    const { error } = await supabase.from("products").upsert(dbPayload);
    if (error) {
      console.error("Error saving product to Supabase:", error);
      throw error;
    }

    // Upsert variants if provided
    if (product.variants && product.variants.length > 0) {
      const productId = dbPayload.id;
      const uniqueVariantsMap = new Map<string, typeof product.variants[0]>();
      for (const v of product.variants) {
        const key = `${v.size}|${v.color}`;
        uniqueVariantsMap.set(key, v);
      }
      const uniqueVariants = Array.from(uniqueVariantsMap.values());

      const variantRows = uniqueVariants.map((v) => ({
        product_id: productId,
        size: v.size,
        color: v.color,
        sku: v.sku || `${productId}-${v.size}-${v.color.slice(0, 3).toUpperCase()}`,
        price: v.price ?? product.basePrice ?? product.price ?? 0,
        stock: v.stock ?? 0,
      }));
      const { error: varErr } = await supabase
        .from("product_variants")
        .upsert(variantRows, { onConflict: "product_id,size" });
      if (varErr) {
        console.error("Error upserting product variants:", varErr);
      }
    }

    // Delete variants removed from the incoming list
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
  },

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const { supabase, isSupabaseConfigured } = loadService();
    const cacheKey = `products:slug:${slug}`;
    const cached = await CacheService.get<Product>(cacheKey);
    if (cached) return cached;

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("products").select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords")
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
  },

  async getProductById(id: string, options?: { adminView?: boolean }): Promise<Product | undefined> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    let query = supabase
      .from("products").select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords")
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
  },

  async relatedProducts(slug: string): Promise<Product[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const current = await this.getProductBySlug(slug);
    if (!current) return [];

    const { data, error } = await supabase
      .from("products").select("id, slug, title, price, compare_price, category, image, images, is_new, stock, description, is_atelier_exclusive, size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl, base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care, custom_badge, featured, bestseller, material, colors, ratings, deleted_at, display_sections, compare_at_price, weight_grams, product_status, seo_title, seo_description, seo_keywords")
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
  },

  async logProductAudit(
    action: 'soft_delete' | 'restore' | 'permanent_delete',
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
      admin_user_email: adminUserEmail || 'system',
      reason: reason || null,
    });
  },

  async deleteProduct(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    await CacheService.delPattern("products:list*");
    await CacheService.delPattern("products:slug:*");

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Error deleting product from Supabase:", error);
      throw error;
    }
  },

  async softDeleteProduct(id: string, adminUserId?: string, adminUserEmail?: string, reason?: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: existing } = await supabase
      .from("products")
      .select("title, slug")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return false;

    // Calculate deletion scheduled time: NOW + 7 days
    const deletionTime = new Date();
    deletionTime.setDate(deletionTime.getDate() + 7);

    const { error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        scheduled_permanent_deletion_at: deletionTime.toISOString()
      })
      .eq("id", id);

    if (error) return false;

    // Write audit log
    await this.logProductAudit('soft_delete', id, existing.title, adminUserId, adminUserEmail, reason);

    await CacheService.delPattern("products:list*");
    await CacheService.delPattern("products:slug:*");

    return true;
  },

  async restoreProduct(id: string, adminUserId?: string, adminUserEmail?: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
        scheduled_permanent_deletion_at: null
      })
      .eq("id", id);

    if (error) return false;

    // Write audit log
    await this.logProductAudit('restore', id, existing.title, adminUserId, adminUserEmail);

    await CacheService.delPattern("products:list*");
    await CacheService.delPattern("products:slug:*");

    return true;
  },

  async permanentlyDeleteProduct(id: string, adminUserId?: string, adminUserEmail?: string, reason?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection not configured.');
    }

    // 1. Fetch details of target product to get title, images, and public IDs
    const { data: product, error: fetchErr } = await supabase
      .from("products")
      .select("title, image, images")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !product) {
      throw new Error(fetchErr?.message || "Product not found for permanent deletion.");
    }

    // 2. Extract Cloudinary image URLs and parse public IDs
    const imageUrls: string[] = [];
    if (product.image) imageUrls.push(product.image);
    if (product.images && Array.isArray(product.images)) {
      imageUrls.push(...product.images);
    }

    const publicIds = imageUrls
      .map(url => {
        // Extract public ID from format: https://res.cloudinary.com/cloud_name/image/upload/v12345/folder/public_id.ext
        const match = url.match(/\/image\/upload\/(?:v\d+\/)?([^.]+)/);
        return match ? match[1] : null;
      })
      .filter((id): id is string => !!id);

    // 3. Delete from Cloudinary
    if (publicIds.length > 0) {
      const { cloudinary } = await import("./cloudinary");
      for (const publicId of publicIds) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (cloudinaryErr) {
          console.error(`[Cloudinary Cleanup] Failed to delete asset "${publicId}":`, cloudinaryErr);
          // Don't halt execution, log and retry or proceed so we don't leave db hanging
        }
      }
    }

    // 4. Cascade delete product record (triggers variant deletion cascade)
    const { error: deleteErr } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      console.error("[permanentlyDeleteProduct] Database delete failed:", deleteErr);
      throw deleteErr;
    }

    // 5. Write audit log
    await this.logProductAudit('permanent_delete', id, product.title, adminUserId, adminUserEmail, reason);

    // 6. Clear Redis Cache
    await CacheService.delPattern("products:list*");
    await CacheService.delPattern("products:slug:*");
  },

  async getActiveProductIds(productIds: string[]): Promise<string[]> {
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
    return (data || []).map(p => p.id);
  },

  // --- Orders ---
  async getOrders(userId?: string): Promise<Order[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    let query = supabase.from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount");
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders from Supabase:", error);
      return [];
    }
    return (data || []).map(mapDbOrderToOrder);
  },

  async getUserOrders(userId: string): Promise<Order[]> {
    return this.getOrders(userId);
  },

  async getOrder(orderId: string): Promise<Order | null> {
    return this.getOrderById(orderId);
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching order by id ${orderId}:`, error);
      return null;
    }
    return data ? mapDbOrderToOrder(data) : null;
  },

  async getOrderByIdempotencyKey(key: string): Promise<Order | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("idempotency_key", key)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching order by idempotency key ${key}:`, error);
      return null;
    }
    return data ? mapDbOrderToOrder(data) : null;
  },

  async getOrderByAwb(awb: string): Promise<Order | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("shiprocket_id", awb)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching order by AWB ${awb}:`, error);
      return null;
    }
    return data ? mapDbOrderToOrder(data) : null;
  },

  async saveOrder(order: Partial<Order>): Promise<Order> {
    const { supabase, isSupabaseConfigured } = loadService();
    // Invalidate metrics cache
    await CacheService.del("analytics:dashboard");

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    let orderId = order.id || "ORD-" + Math.floor(Math.random() * 9000 + 1000);

    // If it's a completely new order (no order.id starting with '6K-' exists, or it doesn't exist in DB):
    const isNew = !order.id || (!order.id.startsWith("6K-"));

    // Check if order exists
    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching order to save:", fetchError);
    }

    const isExisting = !!existingOrder;
    if (!isExisting && isNew) {
      const pm = (order.gatewayPaid && order.gatewayPaid > 0) || order.razorpay_payment_id || (order as any).razorpay_order_id ? 'razorpay' : 'wallet';
      orderId = await this.generateOrderId(pm);
    }

    // Build DB payload with only defined fields (partial update/insert)
    const dbPayload: any = {};
    dbPayload.id = orderId;
    if (order.customer !== undefined) dbPayload.customer = order.customer;
    if (order.date !== undefined) dbPayload.date = order.date;
    if (order.total !== undefined) dbPayload.total = order.total;
    if (order.status !== undefined) dbPayload.status = order.status;
    if (order.items !== undefined) dbPayload.items = order.items;
    if (order.originalTotal !== undefined) dbPayload.original_total = order.originalTotal;
    if (order.couponDiscount !== undefined) dbPayload.coupon_discount = order.couponDiscount;
    if (order.couponCode !== undefined) dbPayload.coupon_code = order.couponCode ? order.couponCode.trim().toUpperCase() : "";
    if (order.walletPaid !== undefined) dbPayload.wallet_paid = order.walletPaid;
    if (order.gatewayPaid !== undefined) dbPayload.gateway_paid = order.gatewayPaid;
    if (order.pointsRedeemed !== undefined) dbPayload.points_redeemed = order.pointsRedeemed;
    if (order.pointsDiscount !== undefined) dbPayload.points_discount = order.pointsDiscount;
    if (order.pointsEarned !== undefined) dbPayload.points_earned = order.pointsEarned;
    if (order.returnReason !== undefined) dbPayload.return_reason = order.returnReason;
    if (order.returnDetails !== undefined) dbPayload.return_details = order.returnDetails;
    if (order.returnImage !== undefined) dbPayload.return_image = order.returnImage;
    if (order.refundOption !== undefined) dbPayload.refund_option = order.refundOption;
    if (order.returnRequestDate !== undefined) dbPayload.return_request_date = order.returnRequestDate;
    if (order.returnDate !== undefined) dbPayload.return_date = order.returnDate;
    if (order.returnRejectReason !== undefined) dbPayload.return_reject_reason = order.returnRejectReason;
    if (order.qualityCheckPassed !== undefined) dbPayload.quality_check_passed = order.qualityCheckPassed;
    if (order.shiprocketId !== undefined) dbPayload.shiprocket_id = order.shiprocketId;
    if (order.idempotencyKey !== undefined) dbPayload.idempotency_key = order.idempotencyKey;
    if (order.cartItems !== undefined) dbPayload.cart_items = order.cartItems;
    if (order.paymentStatus !== undefined) dbPayload.payment_status = order.paymentStatus;
    if (order.userId !== undefined || order.user_id !== undefined) dbPayload.user_id = order.userId || order.user_id;
    if (order.address_snapshot !== undefined) dbPayload.address_snapshot = order.address_snapshot;
    if (order.deliveredAt !== undefined || order.delivered_at !== undefined) dbPayload.delivered_at = order.deliveredAt || order.delivered_at;
    if (order.returnAwb !== undefined || order.return_awb !== undefined) dbPayload.return_awb = order.returnAwb || order.return_awb;
    if (order.returnPickupScheduled !== undefined || order.return_pickup_scheduled !== undefined) dbPayload.return_pickup_scheduled = order.returnPickupScheduled || order.return_pickup_scheduled;
    if (order.utmSource !== undefined || order.utm_source !== undefined) dbPayload.utm_source = order.utmSource || order.utm_source;
    if (order.utmMedium !== undefined || order.utm_medium !== undefined) dbPayload.utm_medium = order.utmMedium || order.utm_medium;
    if (order.utmCampaign !== undefined || order.utm_campaign !== undefined) dbPayload.utm_campaign = order.utmCampaign || order.utm_campaign;
    if (order.shippingAmount !== undefined || order.shipping_amount !== undefined) dbPayload.shipping_amount = order.shippingAmount ?? order.shipping_amount;

    if (order.status && order.status.toLowerCase() === "delivered") {
      dbPayload.delivered_at = (existingOrder && existingOrder.delivered_at) || dbPayload.delivered_at || new Date().toISOString();
    }

    if (isExisting) {
      const { error } = await supabase.from("orders").update(dbPayload).eq("id", orderId);
      if (error) {
        console.error("Error updating order in Supabase:", error);
        throw error;
      }
    } else {
      // For insertion, default required fields if missing
      const insertPayload = {
        id: orderId,
        customer: order.customer || "Guest Customer",
        date: order.date || new Date().toLocaleDateString("en-IN"),
        total: order.total || 0,
        status: order.status || "Pending",
        items: order.items || [],
        original_total: order.originalTotal || 0,
        coupon_discount: order.couponDiscount || 0,
        coupon_code: order.couponCode ? order.couponCode.trim().toUpperCase() : "",
        wallet_paid: order.walletPaid || 0,
        gateway_paid: order.gatewayPaid || 0,
        points_redeemed: order.pointsRedeemed || 0,
        points_discount: order.pointsDiscount || 0,
        points_earned: order.pointsEarned || 0,
        idempotency_key: order.idempotencyKey || orderId,
        cart_items: order.cartItems || [],
        payment_status: order.paymentStatus || "PENDING",
        user_id: order.userId || order.user_id || null,
        address_snapshot: order.address_snapshot ?? null,
        utm_source: order.utmSource || order.utm_source || null,
        utm_medium: order.utmMedium || order.utm_medium || null,
        utm_campaign: order.utmCampaign || order.utm_campaign || null,
        shipping_amount: order.shippingAmount ?? order.shipping_amount ?? 0,
        ...dbPayload
      };
      const { error } = await supabase.from("orders").insert(insertPayload);
      if (error) {
        console.error("Error inserting order in Supabase:", error);
        throw error;
      }
    }

    // Return merged Order representation
    const mergedOrder: Order = {
      id: orderId,
      customer: order.customer || (existingOrder ? existingOrder.customer : "Guest Customer"),
      date: order.date || (existingOrder ? existingOrder.date : new Date().toLocaleDateString("en-IN")),
      total: order.total !== undefined ? order.total : (existingOrder ? Number(existingOrder.total) : 0),
      status: order.status || (existingOrder ? existingOrder.status : "Pending"),
      items: order.items || (existingOrder ? existingOrder.items : []),
      originalTotal: order.originalTotal !== undefined ? order.originalTotal : (existingOrder ? Number(existingOrder.original_total) : 0),
      couponDiscount: order.couponDiscount !== undefined ? order.couponDiscount : (existingOrder ? Number(existingOrder.coupon_discount) : 0),
      couponCode: order.couponCode !== undefined ? order.couponCode : (existingOrder ? existingOrder.coupon_code : ""),
      walletPaid: order.walletPaid !== undefined ? order.walletPaid : (existingOrder ? Number(existingOrder.wallet_paid) : 0),
      gatewayPaid: order.gatewayPaid !== undefined ? order.gatewayPaid : (existingOrder ? Number(existingOrder.gateway_paid) : 0),
      pointsRedeemed: order.pointsRedeemed !== undefined ? order.pointsRedeemed : (existingOrder ? Number(existingOrder.points_redeemed) : 0),
      pointsDiscount: order.pointsDiscount !== undefined ? order.pointsDiscount : (existingOrder ? Number(existingOrder.points_discount) : 0),
      pointsEarned: order.pointsEarned !== undefined ? order.pointsEarned : (existingOrder ? Number(existingOrder.points_earned) : 0),
      returnReason: order.returnReason !== undefined ? order.returnReason : (existingOrder ? existingOrder.return_reason : undefined),
      returnDetails: order.returnDetails !== undefined ? order.returnDetails : (existingOrder ? existingOrder.return_details : undefined),
      returnImage: order.returnImage !== undefined ? order.returnImage : (existingOrder ? existingOrder.return_image : undefined),
      refundOption: order.refundOption !== undefined ? order.refundOption : (existingOrder ? existingOrder.refund_option : undefined),
      returnRequestDate: order.returnRequestDate !== undefined ? order.returnRequestDate : (existingOrder ? existingOrder.return_request_date : undefined),
      returnDate: order.returnDate !== undefined ? order.returnDate : (existingOrder ? existingOrder.return_date : undefined),
      returnRejectReason: order.returnRejectReason !== undefined ? order.returnRejectReason : (existingOrder ? existingOrder.return_reject_reason : undefined),
      qualityCheckPassed: order.qualityCheckPassed !== undefined ? order.qualityCheckPassed : (existingOrder ? existingOrder.quality_check_passed : undefined),
      shiprocketId: order.shiprocketId !== undefined ? order.shiprocketId : (existingOrder ? existingOrder.shiprocket_id : undefined),
      cartItems: order.cartItems || (existingOrder ? existingOrder.cart_items : []),
      paymentStatus: order.paymentStatus || (existingOrder ? existingOrder.payment_status : "PENDING"),
      address_snapshot: order.address_snapshot !== undefined ? order.address_snapshot : (existingOrder ? existingOrder.address_snapshot : null),
      delivered_at: dbPayload.delivered_at !== undefined ? dbPayload.delivered_at : (existingOrder ? existingOrder.delivered_at : undefined),
      deliveredAt: dbPayload.delivered_at !== undefined ? dbPayload.delivered_at : (existingOrder ? existingOrder.delivered_at : undefined),
      return_awb: dbPayload.return_awb !== undefined ? dbPayload.return_awb : (existingOrder ? existingOrder.return_awb : undefined),
      returnAwb: dbPayload.return_awb !== undefined ? dbPayload.return_awb : (existingOrder ? existingOrder.return_awb : undefined),
      return_pickup_scheduled: dbPayload.return_pickup_scheduled !== undefined ? dbPayload.return_pickup_scheduled : (existingOrder ? existingOrder.return_pickup_scheduled : undefined),
      returnPickupScheduled: dbPayload.return_pickup_scheduled !== undefined ? dbPayload.return_pickup_scheduled : (existingOrder ? existingOrder.return_pickup_scheduled : undefined),
      shippingAmount: order.shippingAmount !== undefined ? order.shippingAmount : (order.shipping_amount !== undefined ? order.shipping_amount : (existingOrder ? Number(existingOrder.shipping_amount) : 0)),
      shipping_amount: order.shippingAmount !== undefined ? order.shippingAmount : (order.shipping_amount !== undefined ? order.shipping_amount : (existingOrder ? Number(existingOrder.shipping_amount) : 0)),
    };

    return mergedOrder;
  },

  async getDashboardMetrics() {
    const { supabase, isSupabaseConfigured } = loadService();
    const cacheKey = "analytics:dashboard";
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data, error } = await supabase.rpc("get_dashboard_aggregates");
    if (error) {
      console.error("Error fetching dashboard aggregates via RPC:", error);
      return {
        totalOrders: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        creditRevenue: 0,
        inventoryCount: 0,
        totalStock: 0,
        walletLiability: 0,
        conversion: "4.2%",
      };
    }

    await CacheService.set(cacheKey, data, 300);
    return data;
  },


  // --- Coupons ---
  async getCoupons(): Promise<Coupon[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    const cacheKey = "settings:coupons";
    const cached = await CacheService.get<Coupon[]>(cacheKey);
    if (cached) return cached;

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("coupons").select("id, code, discount, type, active, min_cart_value, buy_product_id, get_product_id, get_discount_percent, buy_quantity, get_quantity, usage_count, max_usage, expiry_date")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching coupons from Supabase:", error);
      return [];
    }
    const res = (data || []).map(mapDbCouponToCoupon);
    await CacheService.set(cacheKey, res, 60); // Cache for 60 seconds instead of 24 hours
    return res;
  },

  async saveCoupon(coupon: Partial<Coupon>): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    await CacheService.del("settings:coupons");
    await CacheService.delPattern("analytics:coupons:*");
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const dbPayload = {
      id: coupon.id || "CPN-" + Date.now(),
      code: (coupon.code || "CODE").toUpperCase(),
      discount: coupon.discount !== undefined ? coupon.discount : 0,
      type: coupon.type || "percent",
      active: coupon.active !== undefined ? coupon.active : true,
      expiry_date: coupon.expiryDate,
      min_cart_value: coupon.minCartValue,
      max_usage: coupon.maxUsage,
      usage_count: coupon.usageCount,
      buy_quantity: coupon.buyQuantity,
      get_quantity: coupon.getQuantity,
      get_discount_percent: coupon.getDiscountPercent,
      buy_product_id: coupon.buyProductId,
      get_product_id: coupon.getProductId,
    };

    const { error } = await supabase.from("coupons").upsert(dbPayload);
    if (error) {
      console.error("Error saving coupon to Supabase:", error);
      throw error;
    }
  },

  async deleteCoupon(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    await CacheService.del("settings:coupons");
    await CacheService.delPattern("analytics:coupons:*");
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      console.error("Error deleting coupon from Supabase:", error);
      throw error;
    }
  },
  
  async getSetting(key: string): Promise<any> {
    const { supabase, isSupabaseConfigured } = loadService();
    const cacheKey = `settings:${key}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      if (key === "flags") {
        (globalThis as any).codEnabled = cached.cod_enabled;
      }
      return cached;
    }
    
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    
    if (error || !data) return null;
    if (key === "flags" && data.value) {
      (globalThis as any).codEnabled = data.value.cod_enabled;
    }
    await CacheService.set(cacheKey, data.value, 600);
    return data.value;
  },

  async getShippingRules(): Promise<ShippingRules> {
    const setting = await this.getSetting('shipping_rules');
    return {
      mode: setting?.mode || 'free_above',
      flatRate: setting?.flat_rate || 99,
      freeAboveAmount: setting?.free_above_amount || 999,
      displayMessage: setting?.display_message || 'Free shipping on orders above ₹999'
    };
  },

  async saveSetting(key: string, value: any): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) return false;
    if (key === "flags" && value) {
      (globalThis as any).codEnabled = value.cod_enabled;
    }
    await CacheService.del(`settings:${key}`);
    return true;
  },

  async validateCoupon(code: string, cartTotal: number, userId?: string, cartItems?: any[]): Promise<{ valid: boolean; coupon?: Coupon; error?: string; discountAmount?: number; message?: string; freeItems?: any[] }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("coupons").select("id, code, discount, type, active, min_cart_value, buy_product_id, get_product_id, get_discount_percent, buy_quantity, get_quantity, usage_count, max_usage, expiry_date")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (error) {
      console.error("Error validating coupon on Supabase:", error);
      return { valid: false, error: "Database error validating coupon." };
    }
    if (!data) {
      return { valid: false, error: "Coupon not found." };
    }

    const coupon = mapDbCouponToCoupon(data);

    if (!coupon.active) {
      return { valid: false, error: "Coupon is inactive." };
    }
    if (coupon.expiryDate) {
      const expiryDate = new Date(coupon.expiryDate);
      expiryDate.setHours(23, 59, 59, 999);
      if (new Date() > expiryDate) {
        return {
          valid: false,
          error: `This coupon expired on ${expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
        };
      }
    }
    if (coupon.minCartValue !== undefined && coupon.minCartValue !== null && cartTotal < coupon.minCartValue) {
      return { valid: false, error: `Minimum cart value of ₹${coupon.minCartValue} required.` };
    }
    if (coupon.maxUsage !== undefined && coupon.maxUsage !== null && coupon.usageCount !== undefined && coupon.usageCount !== null && coupon.usageCount >= coupon.maxUsage) {
      return { valid: false, error: "Coupon usage limit has been reached." };
    }

    if (userId) {
      const { count, error: countError } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("coupon_code", code.toUpperCase());

      if (countError) {
        console.error("Error checking user coupon usage:", countError);
      } else if (count && count > 0) {
        return {
          valid: false,
          error: "You have already used this coupon",
        };
      }
    }

    // Security: BOGO discounts are derived from per-item prices. The cartItems
    // array is client-supplied, so a customer could inflate item.price to make
    // the free/discounted items worth more than they really are and zero out the
    // order total. Before computing any price-based discount, overwrite each
    // item's price with the authoritative value from the products table. Items
    // that don't resolve to a real product contribute a price of 0.
    if (
      cartItems &&
      cartItems.length > 0 &&
      (coupon.type === "bogo_quantity" || coupon.type === "bogo_product")
    ) {
      const dbProducts = await this.getProducts();
      const priceById = new Map<string, number>();
      const priceByTitle = new Map<string, number>();
      for (const p of dbProducts) {
        if (p.id !== undefined && p.id !== null) priceById.set(String(p.id), p.price);
        if (p.title) priceByTitle.set(p.title.toLowerCase(), p.price);
      }
      cartItems = cartItems.map((item) => {
        let authoritativePrice: number | undefined;
        if (item.productId !== undefined && item.productId !== null) {
          authoritativePrice = priceById.get(String(item.productId));
        }
        if (authoritativePrice === undefined && item.productName) {
          authoritativePrice = priceByTitle.get(String(item.productName).toLowerCase());
        }
        return { ...item, price: authoritativePrice ?? 0 };
      });
    }

    let discountAmount = 0;
    if (coupon.type === "percent") {
      discountAmount = Math.floor((cartTotal * coupon.discount) / 100);
      return { valid: true, coupon, discountAmount };
    }
    if (coupon.type === "flat") {
      discountAmount = coupon.discount;
      return { valid: true, coupon, discountAmount };
    }

    if (coupon.type === "bogo_quantity") {
      const buyQty = coupon.buyQuantity || 1;
      const getQty = coupon.getQuantity || 1;
      if (!cartItems || cartItems.length < buyQty) {
        return {
          valid: false,
          error: `Add at least ${buyQty} items to your cart to use this offer.`,
        };
      }
      const sorted = [...cartItems].sort((a, b) => a.price - b.price);
      const freeCount = Math.floor(cartItems.length / buyQty) * getQty;
      const freeItems = sorted.slice(0, freeCount);
      const discountAmount = freeItems.reduce((sum, item) => sum + item.price, 0);
      return {
        valid: true,
        coupon,
        discountAmount,
        freeItems,
      };
    }

    if (coupon.type === "bogo_product") {
      const buyProductId = coupon.buyProductId;
      const getProductId = coupon.getProductId;
      if (!cartItems) {
        return { valid: false, error: "Cart items required for validation." };
      }
      const hasBuyProduct = cartItems.some(item => item.productId === buyProductId);
      if (!hasBuyProduct) {
        let buyProductName = buyProductId || "";
        const { data: buyProdData } = await supabase
          .from("products")
          .select("title")
          .eq("id", buyProductId)
          .maybeSingle();
        if (buyProdData?.title) {
          buyProductName = buyProdData.title;
        }
        return {
          valid: false,
          error: `Buy "${buyProductName}" to unlock this coupon.`,
        };
      }

      const getProduct = cartItems.find(item => item.productId === getProductId);
      if (!getProduct) {
        let getProductName = getProductId || "";
        const { data: getProdData } = await supabase
          .from("products")
          .select("title")
          .eq("id", getProductId)
          .maybeSingle();
        if (getProdData?.title) {
          getProductName = getProdData.title;
        }
        return {
          valid: true,
          coupon,
          discountAmount: 0,
          message: `Add "${getProductName}" to cart to get ${coupon.getDiscountPercent}% off.`,
        };
      }

      const discountAmount = Math.floor((getProduct.price * (coupon.getDiscountPercent || 0)) / 100);
      return {
        valid: true,
        coupon,
        discountAmount,
      };
    }

    if (coupon.type === "spend_discount") {
      const minSpend = coupon.minCartValue || 0;
      if (cartTotal < minSpend) {
        const remaining = minSpend - cartTotal;
        return {
          valid: false,
          error: `Spend ₹${minSpend} to unlock this offer. You need ₹${remaining} more.`,
        };
      }
      const discountAmount = Math.floor((cartTotal * (coupon.getDiscountPercent || 0)) / 100);
      return {
        valid: true,
        coupon,
        discountAmount,
      };
    }

    return { valid: true, coupon, discountAmount };
  },

  async incrementCouponUsage(code: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase.rpc("coupon_atomic_increment", {
      p_code: code.toUpperCase()
    });

    if (error) {
      console.error("Error executing atomic coupon increment:", error);
      return false;
    }
    // RPC returns JSON object { success: boolean, error?: string }
    const success = (data && typeof data === 'object' && 'success' in data)
      ? (data as any).success === true
      : false;

    if (success) {
      await CacheService.del("settings:coupons");
      await CacheService.delPattern("analytics:coupons:*");
    }
    return success;
  },

  async decrementCouponUsage(code: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase.rpc("coupon_atomic_decrement", {
      p_code: code.toUpperCase()
    });

    if (error) {
      console.error("Error executing atomic coupon decrement:", error);
      // Fallback: manually update usage count decrement
      const { data: cData } = await supabase
        .from("coupons")
        .select("id, usage_count")
        .eq("code", code.toUpperCase())
        .maybeSingle();

      if (cData) {
        const cur = cData.usage_count || 0;
        await supabase
          .from("coupons")
          .update({ usage_count: Math.max(0, cur - 1) })
          .eq("id", cData.id);
        
        await CacheService.del("settings:coupons");
        await CacheService.delPattern("analytics:coupons:*");
        return true;
      }
      return false;
    }

    const success = (data && typeof data === 'object' && 'success' in data)
      ? (data as any).success === true
      : false;

    if (success) {
      await CacheService.del("settings:coupons");
      await CacheService.delPattern("analytics:coupons:*");
    }
    return success;
  },

  // --- Wallet ---
  async getWalletBalance(userId?: string): Promise<number> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
  },

  async getWalletTransactions(userId?: string): Promise<WalletTransaction[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const uid = userId;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("wallet_transactions").select("id, user_id, amount, type, description, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching wallet transactions from Supabase:", error);
      return [];
    }
    return (data || []).map(row => ({
      id: row.id,
      date: row.created_at || "",
      amount: Number(row.amount),
      type: row.type as "credit" | "debit",
      description: row.description || "",
    }));
  },

  async getWalletData(userId?: string) {
    const balance = await this.getWalletBalance(userId);
    const transactions = await this.getWalletTransactions(userId);
    return { balance, transactions };
  },

  async applyWalletDebit(amount: number, orderId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const uid = userId;
    if (!uid) return { success: false, error: "User authentication required." };

    const { data, error } = await supabase.rpc("wallet_atomic_debit", {
      p_user_id: uid,
      p_amount: amount,
      p_idempotency_key: orderId,
      p_desc: `Payment for Order #${orderId}`
    });

    if (error) {
      console.error("Atomic wallet debit error:", error);
      return { success: false, error: "Database error debiting wallet." };
    }
    if (data && !data.success) {
      return { success: false, error: data.error };
    }
    return { success: true };
  },

  async applyWalletCredit(amount: number, description: string, orderId: string, userId?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const uid = userId;
    if (!uid) return;

    await supabase.rpc("wallet_atomic_credit", {
      p_user_id: uid,
      p_amount: amount,
      p_idempotency_key: "WALLET-CREDIT-" + orderId,
      p_desc: description || `Refund for Order #${orderId}`
    });
  },

  // --- Loyalty ---
  async getLoyaltyPoints(userId?: string): Promise<number> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    if (!userId) return 0;

    // Fetch stored balance and expired-but-not-yet-swept points in parallel
    const [profileRes, expiredRes] = await Promise.all([
      supabase.from("profiles").select("loyalty_points").eq("id", userId).maybeSingle(),
      supabase
        .from("loyalty_transactions")
        .select("points")
        .eq("user_id", userId)
        .eq("type", "credit")
        .lt("expires_at", new Date().toISOString())
        .is("expired_processed", null)
    ]);

    if (profileRes.error || !profileRes.data) {
      console.error("Error fetching loyalty points from Supabase:", profileRes.error);
      return 0;
    }

    const storedBalance = Number(profileRes.data.loyalty_points);
    // Subtract expired points that the nightly job hasn't swept yet
    const expiredUnprocessed = (expiredRes.data || []).reduce(
      (sum: number, row: any) => sum + Number(row.points), 0
    );

    return Math.max(0, storedBalance - expiredUnprocessed);
  },

  async getLoyaltyTransactions(userId?: string): Promise<LoyaltyTransaction[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    if (!userId) return [];

    const { data, error } = await supabase
      .from("loyalty_transactions")
      // MINOR-003: select `date` column (formatted string) + created_at + expires_at
      .select("id, user_id, points, type, description, date, created_at, expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching loyalty transactions from Supabase:", error);
      return [];
    }
    return (data || []).map(row => ({
      id: row.id,
      date: row.date || row.created_at || "",  // prefer formatted date, fall back to ISO
      points: Number(row.points),
      type: row.type as "credit" | "debit",
      description: row.description || "",
      expiresAt: row.expires_at || null,
    }));
  },

  async getLoyaltyData(userId?: string) {
    const points = await this.getLoyaltyPoints(userId);
    const transactions = await this.getLoyaltyTransactions(userId);
    return { points, transactions };
  },

  async applyLoyaltyDebit(points: number, orderId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const uid = userId;
    if (!uid) return { success: false, error: "User authentication required." };

    const { data, error } = await supabase.rpc("loyalty_atomic_debit", {
      p_user_id: uid,
      p_points: points,
      p_idempotency_key: orderId,
      p_desc: `Redeemed on Order #${orderId}`
    });

    if (error) {
      console.error("Atomic loyalty debit error:", error);
      return { success: false, error: "Database error debiting loyalty points." };
    }
    if (data && !data.success) {
      return { success: false, error: data.error };
    }
    return { success: true };
  },

  async awardLoyaltyPoints(total: number, orderId: string, userId?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    // Caller should pass netTotal (original_total - coupon_discount), NOT total-with-shipping
    // Business rule: ₹100 net spend = 5 points
    const points = Math.floor(total / 100) * 5;
    if (points <= 0) return;

    const uid = userId;
    if (!uid) return;

    const { data, error } = await supabase.rpc("loyalty_atomic_credit", {
      p_user_id: uid,
      p_points: points,
      p_idempotency_key: "EARNED-" + orderId,
      p_desc: `Earned on Order #${orderId}`
    });

    if (error) {
      console.error("[awardLoyaltyPoints] RPC error:", error, "orderId:", orderId);
    } else if (data && !data.success) {
      // 'Duplicate transaction' is expected when both verify + webhook fire — not a real error
      if (data.error !== 'Duplicate transaction') {
        console.error("[awardLoyaltyPoints] Failed:", data.error, "orderId:", orderId);
      }
    }
  },

  async applyLoyaltyCredit(points: number, description: string, orderId: string, userId?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const uid = userId;
    if (!uid) return;

    await supabase.rpc("loyalty_atomic_credit", {
      p_user_id: uid,
      p_points: points,
      p_idempotency_key: "LOYALTY-CREDIT-" + orderId,
      p_desc: description || `Refund for Order #${orderId}`
    });
  },

  // --- Returns & Refunds Logistics ---
  async requestManualReturn(
    orderId: string,
    payload: { reason: string; details: string; image: string; refundOption: string }
  ): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data: orderData, error: orderErr } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;
    if (orderData.status === "Returned" || orderData.status === "Return Requested") return false;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "Return Requested",
        return_reason: payload.reason,
        return_details: payload.details,
        return_image: payload.image,
        refund_option: payload.refundOption === "bank" ? "original_source" : payload.refundOption,
        return_request_date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      })
      .eq("id", orderId);

    return !error;
  },

  async approveReturnPickup(orderId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "Return in Transit" })
      .eq("id", orderId);

    return !error;
  },

  async processReturnRefund(orderId: string, qualityCheckPassed = true, reason?: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: orderData, error: orderErr } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;
    if (orderData.status === "Returned") return false;

    // Atomic claim: set refund_status = "pending" only when it is currently NULL.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ refund_status: "pending" })
      .eq("id", orderId)
      .is("refund_status", null)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      return false; // Another call already claimed, or a refund is already in progress
    }

    const walletPaid = Number(orderData.wallet_paid || 0);
    const gatewayPaid = Number(orderData.gateway_paid || 0);
    const totalRefundAmount = walletPaid + gatewayPaid;
    const refundReason = reason || "Return approved by admin";

    // 1. Update order status + store refund metadata
    const returnDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const { error: orderUpdateErr } = await supabase
      .from("orders")
      .update({
        status: "Returned",
        return_date: returnDate,
        quality_check_passed: qualityCheckPassed,
        refund_reason: refundReason,
        refund_amount: totalRefundAmount,
      })
      .eq("id", orderId);

    if (orderUpdateErr) {
      // Revert claim on update failure
      await supabase.from("orders").update({ refund_status: null }).eq("id", orderId);
      return false;
    }

    // 2. QC passed → restock variant inventory from cart_items JSONB.
    if (qualityCheckPassed) {
      const cartItemsForRestock = orderData.cart_items;
      if (Array.isArray(cartItemsForRestock) && cartItemsForRestock.length > 0) {
        for (const item of cartItemsForRestock) {
          const productId = item.productId || item.product_id;
          const size = item.size;
          const color = item.color;
          const quantity = item.quantity || 1;
          if (!productId || !size || !color) {
            console.warn("[Restock] cart item missing fields, skipping:", item);
            continue;
          }
          try {
            await InventoryService.restoreStockAtomic(productId, size, color, quantity);
          } catch (e: any) {
            console.error(`[Restock] failed for ${productId} ${size}/${color}:`, e.message);
          }
        }
      } else {
        console.warn(`[Restock] order ${orderId} has no cart_items JSONB; inventory not restocked`);
      }
    }

    // 3. Refund routing: wallet vs bank
    if (orderData.refund_option === "wallet") {
      // Entire amount (gateway + wallet) goes to store wallet — no Razorpay call
      if (orderData.user_id) {
        await this.applyWalletCredit(
          totalRefundAmount,
          `Return Credit for Order #${orderId}`,
          orderId,
          orderData.user_id
        );
      }
      await supabase
        .from("orders")
        .update({ refund_status: "wallet_only", refunded_at: new Date().toISOString() })
        .eq("id", orderId);
    } else {
      // Wallet portion → store wallet
      if (walletPaid > 0 && orderData.user_id) {
        await this.applyWalletCredit(
          walletPaid,
          `Refund of Wallet Portion for Order #${orderId}`,
          orderId,
          orderData.user_id
        );
      }

      // Gateway portion → Razorpay refund
      if (gatewayPaid > 0) {
        const razorpayPaymentId = orderData.razorpay_payment_id;

        if (!razorpayPaymentId) {
          console.warn(`[Refund] No razorpay_payment_id for order ${orderId}; skipping Razorpay refund.`);
          await supabase
            .from("orders")
            .update({ refund_status: "wallet_only", refunded_at: new Date().toISOString() })
            .eq("id", orderId);
        } else {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { razorpay } = require("./razorpay") as typeof import("./razorpay");
            const refundResult = await razorpay.payments.refund(razorpayPaymentId, {
              amount: Math.round(gatewayPaid * 100),
              speed: "normal",
              notes: { order_id: orderId, reason: refundReason },
              receipt: `REF-${orderId}-${Date.now()}`,
            });

            await supabase
              .from("orders")
              .update({
                refund_id: refundResult.id,
                refund_status: "initiated",
                refunded_at: new Date().toISOString(),
              })
              .eq("id", orderId);
          } catch (e: any) {
            console.error(`[Refund] Razorpay refund failed for ${orderId}:`, e.message);
            await supabase
              .from("orders")
              .update({
                refund_status: "failed",
                refund_reason: `${refundReason} | Razorpay error: ${e.message}`,
                refunded_at: new Date().toISOString(),
              })
              .eq("id", orderId);
          }
        }
      } else {
        // Wallet-only or free order: set terminal status
        await supabase
          .from("orders")
          .update({
            refund_status: walletPaid > 0 ? "wallet_only" : "processed",
            refunded_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      }
    }

    // 4. Revoke earned loyalty points (via RPC → profiles.loyalty_points)
    const pointsEarned = Number(orderData.points_earned || 0);
    if (pointsEarned > 0 && orderData.user_id) {
      await this.applyLoyaltyDebit(
        pointsEarned,
        "REVOKE-RETURN-" + orderId,
        orderData.user_id
      );
    }

    // 5. Restore redeemed loyalty points (via RPC → profiles.loyalty_points)
    const pointsRedeemed = Number(orderData.points_redeemed || 0);
    if (pointsRedeemed > 0 && orderData.user_id) {
      await this.applyLoyaltyCredit(
        pointsRedeemed,
        `Restored for Returned Order #${orderId}`,
        "RESTORE-RETURN-" + orderId,
        orderData.user_id
      );
    }

    return true;
  },

  async rejectReturn(orderId: string, rejectReason: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase
      .from("orders")
      .update({
        status: "Return Rejected",
        return_reject_reason: rejectReason,
      })
      .eq("id", orderId);

    return !error;
  },

  async cancelOrderAndRefund(orderId: string, reason?: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: orderData, error: orderErr } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;
    if (orderData.status === "Cancelled") return false;

    // Atomic claim: set refund_status = "pending" only when it is currently NULL.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ refund_status: "pending" })
      .eq("id", orderId)
      .is("refund_status", null)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      return false; // Another call already claimed, or a refund is already in progress
    }

    const walletPaid = Number(orderData.wallet_paid || 0);
    const gatewayPaid = Number(orderData.gateway_paid || 0);
    const totalRefundAmount = walletPaid + gatewayPaid;
    const refundReason = reason || "Order cancelled by admin";
    const cancelDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    // 1. Update status + store refund reason + amount
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "Cancelled",
        refund_reason: refundReason,
        refund_amount: totalRefundAmount,
      })
      .eq("id", orderId);

    if (updateErr) {
      // Revert claim on update failure
      await supabase.from("orders").update({ refund_status: null }).eq("id", orderId);
      return false;
    }

    // 2. Restock variant inventory from cart_items JSONB (has productId, size, color, quantity).
    // Falls back to a warning for legacy orders without cart_items.
    const cartItemsForRestock = orderData.cart_items;
    if (Array.isArray(cartItemsForRestock) && cartItemsForRestock.length > 0) {
      for (const item of cartItemsForRestock) {
        const productId = item.productId || item.product_id;
        const size = item.size;
        const color = item.color;
        const quantity = item.quantity || 1;
        if (!productId || !size || !color) {
          console.warn("[Restock] cart item missing fields, skipping:", item);
          continue;
        }
        try {
          await InventoryService.restoreStockAtomic(productId, size, color, quantity);
        } catch (e: any) {
          console.error(`[Restock] failed for ${productId} ${size}/${color}:`, e.message);
        }
      }
    } else {
      console.warn(`[Restock] order ${orderId} has no cart_items JSONB; inventory not restocked`);
    }

    // 3. Wallet portion → store wallet (NOW PASSING user_id — fixes the silent no-op)
    if (walletPaid > 0 && orderData.user_id) {
      await this.applyWalletCredit(
        walletPaid,
        `Refund of Wallet Portion for Cancelled Order #${orderId}`,
        orderId,
        orderData.user_id
      );
    }

    // 4. Gateway portion → Razorpay refund
    if (gatewayPaid > 0) {
      const razorpayPaymentId = orderData.razorpay_payment_id;

      if (!razorpayPaymentId) {
        console.warn(`[Refund] No razorpay_payment_id for order ${orderId}; skipping Razorpay refund. Gateway ₹${gatewayPaid} NOT refunded.`);
        await supabase
          .from("orders")
          .update({ refund_status: "wallet_only", refunded_at: new Date().toISOString() })
          .eq("id", orderId);
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { razorpay } = require("./razorpay") as typeof import("./razorpay");
          const refundResult = await razorpay.payments.refund(razorpayPaymentId, {
            amount: Math.round(gatewayPaid * 100),
            speed: "normal",
            notes: { order_id: orderId, reason: refundReason },
            receipt: `REF-${orderId}-${Date.now()}`,
          });

          await supabase
            .from("orders")
            .update({
              refund_id: refundResult.id,
              refund_status: "initiated",
              refunded_at: new Date().toISOString(),
            })
            .eq("id", orderId);
        } catch (e: any) {
          console.error(`[Refund] Razorpay refund failed for ${orderId}:`, e.message);
          await supabase
            .from("orders")
            .update({
              refund_status: "failed",
              refund_reason: `${refundReason} | Razorpay error: ${e.message}`,
              refunded_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          // Don't return false — status update + wallet refund already succeeded
        }
      }
    } else {
      // Wallet-only or free order: set terminal status
      await supabase
        .from("orders")
        .update({
          refund_status: walletPaid > 0 ? "wallet_only" : "processed",
          refunded_at: new Date().toISOString(),
        })
        .eq("id", orderId);
    }

    // 5. Revoke earned loyalty points (via RPC → profiles.loyalty_points)
    const pointsEarned = Number(orderData.points_earned || 0);
    if (pointsEarned > 0 && orderData.user_id) {
      await this.applyLoyaltyDebit(
        pointsEarned,
        "REVOKE-CANCEL-" + orderId,
        orderData.user_id
      );
    }

    // 6. Restore redeemed loyalty points (via RPC → profiles.loyalty_points)
    const pointsRedeemed = Number(orderData.points_redeemed || 0);
    if (pointsRedeemed > 0 && orderData.user_id) {
      await this.applyLoyaltyCredit(
        pointsRedeemed,
        `Restored for Cancelled Order #${orderId}`,
        "RESTORE-CANCEL-" + orderId,
        orderData.user_id
      );
    }

    return true;
  },

  async issueRefund(orderId: string, reason: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: orderData, error } = await supabase
      .from("orders").select("id, customer, date, total, status, items, original_total, coupon_discount, coupon_code, wallet_paid, gateway_paid, points_redeemed, points_discount, points_earned, return_reason, return_details, return_image, refund_option, return_request_date, return_date, return_reject_reason, quality_check_passed, shiprocket_id, cart_items, payment_status, user_id, address_snapshot, refund_id, refund_amount, refund_status, refund_reason, refunded_at, razorpay_payment_id, created_at, delivered_at, return_awb, return_pickup_scheduled, utm_source, utm_medium, utm_campaign, shipping_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !orderData) return false;

    // Atomic claim: set refund_status = "pending" only when it is currently NULL.
    // This prevents two concurrent calls (admin double-click, network retry) from
    // both passing the guard and issuing duplicate Razorpay refunds.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ refund_status: "pending" })
      .eq("id", orderId)
      .is("refund_status", null)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      return false; // Another call already claimed, or a refund is already in progress
    }

    const gatewayPaid = Number(orderData.gateway_paid || 0);
    const walletPaid = Number(orderData.wallet_paid || 0);
    const totalRefund = gatewayPaid + walletPaid;

    // Wallet portion → store wallet
    if (walletPaid > 0 && orderData.user_id) {
      await this.applyWalletCredit(
        walletPaid,
        `Refund for Order #${orderId}: ${reason}`,
        orderId,
        orderData.user_id
      );
    }

    // Gateway portion → Razorpay
    if (gatewayPaid > 0) {
      const razorpayPaymentId = orderData.razorpay_payment_id;

      if (!razorpayPaymentId) {
        await supabase.from("orders").update({
          refund_status: "wallet_only",
          refund_amount: walletPaid,
          refund_reason: reason,
          refunded_at: new Date().toISOString(),
        }).eq("id", orderId);
        return true;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { razorpay } = require("./razorpay") as typeof import("./razorpay");
        const refundResult = await razorpay.payments.refund(razorpayPaymentId, {
          amount: Math.round(gatewayPaid * 100),
          speed: "normal",
          notes: { order_id: orderId, reason },
          receipt: `REF-${orderId}-${Date.now()}`,
        });

        await supabase.from("orders").update({
          refund_id: refundResult.id,
          refund_status: "initiated",
          refund_amount: totalRefund,
          refund_reason: reason,
          refunded_at: new Date().toISOString(),
        }).eq("id", orderId);

        return true;
      } catch (e: any) {
        console.error(`[Refund] Razorpay failed for ${orderId}:`, e.message);
        await supabase.from("orders").update({
          refund_status: "failed",
          refund_amount: walletPaid,
          refund_reason: `${reason} | Error: ${e.message}`,
          refunded_at: new Date().toISOString(),
        }).eq("id", orderId);
        return false;
      }
    } else {
      // Wallet-only order
      await supabase.from("orders").update({
        refund_status: walletPaid > 0 ? "wallet_only" : "processed",
        refund_amount: walletPaid,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      }).eq("id", orderId);
      return true;
    }
  },

  async approvePendingOrder(orderId: string): Promise<boolean> {
    return this.runPostPaymentSideEffects(orderId);
  },

  async generateOrderId(paymentMethod: 'razorpay' | 'wallet'): Promise<string> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection not configured.');
    }
    const { data, error } = await supabase.rpc('get_next_order_sequence');
    if (error) {
      console.error('Error generating sequence ID:', error);
      throw error;
    }
    const sequence = String(data).padStart(5, '0');
    const prefix = paymentMethod === 'razorpay' ? 'RPO' : 'WPO';
    return `6K-${prefix}-${sequence}`;
  },

  async verifyRazorpayPayment(orderId: string): Promise<{ success: boolean; status: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection not configured.');
    }
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (!order.razorpay_payment_id) throw new Error('No Razorpay payment ID found on this order');

    const { razorpay } = require("./razorpay") as typeof import("./razorpay");
    const payment = await razorpay.payments.fetch(order.razorpay_payment_id) as any;
    if (payment.status === 'captured') {
      await this.approvePendingOrder(orderId);
      return { success: true, status: 'activated' };
    }
    if (payment.status === 'failed') {
      await supabase.from("orders").update({
        status: "Failed",
        payment_status: "Failed"
      }).eq("id", orderId);

      await this.releaseReservation(order.idempotencyKey || orderId);
      await this.addOrderStatusHistory(order.idempotencyKey || orderId, "Failed", "System (Payment Verification)", {
        payment_status: "Failed",
        reason: "Payment failed on gateway check"
      });
      return { success: true, status: 'failed' };
    }
    return { success: true, status: payment.status };
  },

  async verifyRazorpayRefund(orderId: string): Promise<{ status: string; processedAt?: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection not configured.');
    }
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (!order.refund_id) throw new Error('No refund ID found on this order');

    const { razorpay } = require("./razorpay") as typeof import("./razorpay");
    const refund = await razorpay.refunds.fetch(order.refund_id) as any;
    
    let dbRefundStatus = refund.status;
    let refundedAt: string | undefined = undefined;

    if (refund.status === 'processed') {
      dbRefundStatus = 'credited';
      refundedAt = refund.processed_at ? new Date(Number(refund.processed_at) * 1000).toISOString() : new Date().toISOString();
    } else if (refund.status === 'failed') {
      dbRefundStatus = 'failed';
    }

    await supabase.from("orders").update({
      refund_status: dbRefundStatus as any,
      refunded_at: refundedAt || new Date().toISOString()
    }).eq("id", orderId);

    return { status: refund.status, processedAt: refund.processed_at ? String(refund.processed_at) : undefined };
  },

  async runPostPaymentSideEffects(orderId: string, razorpayPaymentId?: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;

    const dbOrder = await this.getOrderById(orderId);
    if (!dbOrder) return false;

    const earned = Math.floor(dbOrder.total / 100) * 5; // ₹100 = 5 points

    const updatePayload: any = {
      status: "Paid",
      payment_status: "Paid",
      points_earned: earned
    };
    if (razorpayPaymentId) {
      updatePayload.razorpay_payment_id = razorpayPaymentId;
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (updateErr) {
      console.error("[runPostPaymentSideEffects] status update failed:", updateErr);
      return false;
    }

    // a. Deduct inventory stock
    let deductSuccess = false;
    try {
      const { data: currentRes } = await supabase
        .from("inventory_reservations")
        .select("status")
        .eq("session_id", dbOrder.idempotencyKey || orderId)
        .maybeSingle();

      if (currentRes?.status === "fulfilled") {
        deductSuccess = true;
      } else {
        deductSuccess = await this.deductStock(dbOrder.cartItems || [], dbOrder.idempotencyKey || orderId);
      }
    } catch (e) {
      console.error("[runPostPaymentSideEffects] deductStock failed:", e);
    }

    // b. Increment coupon usage
    if (dbOrder.couponCode) {
      try {
        await this.incrementCouponUsage(dbOrder.couponCode);
      } catch (e) {
        console.error("[runPostPaymentSideEffects] incrementCouponUsage failed:", e);
      }
    }

    // c. Debit wallet
    if (dbOrder.walletPaid && dbOrder.walletPaid > 0) {
      try {
        await this.applyWalletDebit(dbOrder.walletPaid, dbOrder.id, dbOrder.userId || dbOrder.user_id);
      } catch (e) {
        console.error("[runPostPaymentSideEffects] applyWalletDebit failed:", e);
      }
    }

    // d. Debit loyalty points
    if (dbOrder.pointsRedeemed && dbOrder.pointsRedeemed > 0) {
      try {
        await this.applyLoyaltyDebit(dbOrder.pointsRedeemed, dbOrder.id, dbOrder.userId || dbOrder.user_id);
      } catch (e) {
        console.error("[runPostPaymentSideEffects] applyLoyaltyDebit failed:", e);
      }
    }

    // e. Award loyalty points
    try {
      const webhookEarnBase = Math.max(0, (dbOrder.originalTotal || 0) - (dbOrder.couponDiscount || 0));
      await this.awardLoyaltyPoints(webhookEarnBase, dbOrder.id, dbOrder.userId || dbOrder.user_id);
    } catch (e) {
      console.error("[runPostPaymentSideEffects] awardLoyaltyPoints failed:", e);
    }

    // f. Update payments record
    try {
      const { data: payment } = await supabase
        .from("payments")
        .select("id")
        .eq("order_id", dbOrder.id)
        .maybeSingle();

      if (payment) {
        await supabase.from("payments").update({
          status: "CAPTURED"
        }).eq("id", payment.id);

        await supabase.from("payment_logs").insert({
          payment_id: payment.id,
          previous_status: "CREATED",
          new_status: "CAPTURED",
          metadata: { source: "verification", razorpay_payment_id: dbOrder.razorpay_payment_id }
        });
      }
    } catch (e) {
      console.error("[runPostPaymentSideEffects] payments update failed:", e);
    }

    // g. Payment audit log
    try {
      await this.createPaymentAuditLog(dbOrder.id, "Payment Pending", "Paid", "verification");
    } catch (e) {
      console.error("[runPostPaymentSideEffects] createPaymentAuditLog failed:", e);
    }

    // h. Order event / status history
    try {
      await this.createOrderEvent(dbOrder.id, "Payment Successful");
      await this.addOrderStatusHistory(dbOrder.idempotencyKey || orderId, "Paid", "System (Post Payment)", {
        status_changed_to: "Paid"
      });
    } catch (e) {
      console.error("[runPostPaymentSideEffects] createOrderEvent/history failed:", e);
    }

    // i. Dispatch fulfillment
    try {
      await this.dispatchFulfillment(dbOrder.id);
    } catch (e) {
      console.error("[runPostPaymentSideEffects] dispatchFulfillment failed:", e);
    }

    // j. Send Order Confirmation Email
    try {
      let customerEmail = dbOrder.address_snapshot?.email || "";
      if (!customerEmail && (dbOrder.userId || dbOrder.user_id) && supabase) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", dbOrder.userId || dbOrder.user_id)
          .maybeSingle();
        if (profile?.email) {
          customerEmail = profile.email;
        }
      }

      if (customerEmail) {
        const { sendOrderConfirmationEmail } = await import("@/lib/email");
        
        // Group cart items to compute quantities for duplicates
        const rawItems = dbOrder.cartItems || [];
        const groupedMap = new Map<string, { productName: string; size: string; quantity: number; price: number }>();
        for (const item of rawItems) {
          const key = `${item.productName || item.title || "Product"}-${item.size || "Free Size"}`;
          if (groupedMap.has(key)) {
            groupedMap.get(key)!.quantity += 1;
          } else {
            groupedMap.set(key, {
              productName: item.productName || item.title || "Product",
              size: item.size || "Free Size",
              quantity: 1,
              price: Number(item.price || 0),
            });
          }
        }
        const groupedItems = Array.from(groupedMap.values());

        const addr = dbOrder.address_snapshot;
        const addressStr = addr
          ? [addr.name, addr.phone, addr.address_line_1, addr.address_line_2, `${addr.city} - ${addr.postal_code}`, addr.state, addr.country]
              .filter(Boolean)
              .join(", ")
          : "No address details available";

        await sendOrderConfirmationEmail({
          id: dbOrder.id,
          customerName: dbOrder.customer || "Valued Customer",
          customerEmail,
          items: groupedItems,
          total: Number(dbOrder.total || 0),
          address: addressStr
        });
      }
    } catch (emailError) {
      console.error("[Email] Order confirmation email failed:", emailError);
    }

    return true;
  },

  // --- Addresses ---
  async getUserAddresses(userId: string = "guest"): Promise<UserAddress[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("user_addresses").select("id, user_id, name, address_line_1, address_line_2, city, state, postal_code, country, phone, is_default, created_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false });

    if (error) {
      console.error("Error fetching addresses from Supabase:", error);
      return [];
    }
    return (data || []).map(mapDbAddressToUserAddress);
  },

  async getAddressById(addressId: string, userId: string): Promise<UserAddress | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("user_addresses").select("id, user_id, name, address_line_1, address_line_2, city, state, postal_code, country, phone, is_default, created_at")
      .eq("id", addressId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching address by id:", error);
      return null;
    }
    return data ? mapDbAddressToUserAddress(data) : null;
  },

  async saveUserAddress(address: Partial<UserAddress>): Promise<UserAddress> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
  },

  async deleteUserAddress(id: string, userId: string = "guest"): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    
    // fetch before delete to check if default (scoped to owner)
    const { data: toDelete } = await supabase.from("user_addresses").select("is_default").eq("id", id).eq("user_id", userId).maybeSingle();

    const { error } = await supabase.from("user_addresses").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      console.error("Error deleting address from Supabase:", error);
      throw error;
    }

    if (toDelete?.is_default) {
      const { data: nextAddress } = await supabase.from("user_addresses").select("id").eq("user_id", userId).limit(1).maybeSingle();
      if (nextAddress) {
        await supabase.from("user_addresses").update({ is_default: true }).eq("id", nextAddress.id);
      }
    }
  },

  async setDefaultUserAddress(id: string, userId: string = "guest"): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
  },

  // --- Cart DB Sync ---
  async getUserCart(userId: string): Promise<CartItem[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data, error } = await supabase
      .from("user_cart").select("product_id, product_name, price, size, image, color, quantity")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching user cart from Supabase:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const productIds = Array.from(new Set(data.map(row => row.product_id)));
    const activeProducts = await this.getActiveProductIds(productIds);
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
  },

  async syncCartToDB(userId: string, items: CartItem[]): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    try {
      if (items.length === 0) {
        await supabase.from("user_cart").delete().eq("user_id", userId);
        return;
      }

      const grouped: Record<string, {
        user_id: string;
        product_id: string;
        product_name: string;
        price: number;
        size: string;
        color: string;
        image: string | null;
        quantity: number;
      }> = {};

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

      const keysToKeep = new Set(payload.map(p => `${p.product_id}_${p.size}_${p.color}`));
      const { data: existing } = await supabase
        .from("user_cart")
        .select("product_id, size, color")
        .eq("user_id", userId);

      if (existing) {
        const toDelete = existing.filter(e => !keysToKeep.has(`${e.product_id}_${e.size}_${e.color}`));
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
  },

  async addToUserCart(userId: string, item: CartItem): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
        updated_at: new Date().toISOString()
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
  },

  async removeFromUserCart(
    userId: string,
    productId: string,
    size: string,
    color: string
  ): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
  },

  async clearUserCart(userId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    try {
      const { error } = await supabase
        .from("user_cart")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error in clearUserCart:", error);
      }
    } catch (err) {
      console.error("clearUserCart error:", err);
    }
  },

  async verifyStock(items: any[], sessionId?: string): Promise<{ success: boolean; message?: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    // Format cart items for validation
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
      // Perform atomic reservations for all items in a single batch RPC call
      const products = await this.getProducts();
      const batchItems = formatted.map((item) => {
        const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
        return {
          product_id: product ? product.id : "",
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        };
      }).filter((item) => item.product_id !== "");

      if (batchItems.length > 0) {
        const { data, error } = await supabase.rpc("reserve_variant_inventory_batch_atomic", {
          p_items: batchItems,
          p_expires_mins: 15,
          p_session: sessionId,
        });

        if (error || (data && !data.success)) {
          // Rollback any reservations already made for this session
          await supabase.from("inventory_reservations").delete().eq("session_id", sessionId);
          return { 
            success: false, 
            message: data?.error || data?.errors?.join(" | ") || error?.message || "Failed to reserve batch inventory stock" 
          };
        }
      }
    }

    return { success: true };
  },

  async logDeductionFailure(productId: string, size: string, color: string, quantity: number, orderId?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    try {
      const { error } = await supabase.from("deduction_failures").insert({
        product_id: productId,
        size,
        color,
        quantity,
        order_id: orderId,
        failed_at: new Date().toISOString()
      });
      if (error) {
        console.error("Failed to insert into deduction_failures:", error);
      }
    } catch (e: any) {
      console.error("deduction_failures table does not exist or write failed:", e.message);
    }
  },

  async deductStock(items: any[], sessionId?: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    const products = await this.getProducts();
    for (const item of items) {
      const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
      if (!product) {
        console.error(`[deductStock] FAILED: Product "${item.productName}" not found in database.`);
        return false;
      }
      const size = (item.size || "M") as "S" | "M" | "L" | "XL" | "XXL";
      const color = item.color || "Default";
      const qty = item.quantity || 1;
      const success = await InventoryService.deductStockAtomic(
        product.id, size, color, qty, sessionId
      );
      if (!success) {
        console.error(`[deductStock] FAILED for ${product.id} ${size}/${color}, order=${sessionId}`);
        await this.logDeductionFailure?.(product.id, size, color, qty, sessionId);
        return false;
      }
    }
    if (isSupabaseConfigured && supabase && sessionId) {
      await supabase.from("inventory_reservations").update({ status: 'fulfilled' }).eq("session_id", sessionId);
    }
    return true;
  },

  async restoreStock(items: any[], sessionId?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    const products = await this.getProducts();
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
      await supabase.from("inventory_reservations").update({ status: 'cancelled' }).eq("session_id", sessionId);
    }
  },

  async restockProductVariants(
    productId: string,
    addPerVariant: { size: string; color: string; add: number }[]
  ): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    for (const { size, color, add } of addPerVariant) {
      if (add <= 0) continue;

      // Check if variant exists in product_variants
      const { data: variants, error: fetchErr } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", productId)
        .eq("size", size)
        .eq("color", color);

      if (!fetchErr && variants && variants.length > 0) {
        // Variant exists, use the RPC function
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
        // Fallback: update legacy column on products table
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

        // Recalculate total product stock
        const { data: updatedProd } = await supabase
          .from("products")
          .select("size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl")
          .eq("id", productId)
          .single();

        if (updatedProd) {
          const newTotalStock = (updatedProd.size_stock_s || 0) +
                                (updatedProd.size_stock_m || 0) +
                                (updatedProd.size_stock_l || 0) +
                                (updatedProd.size_stock_xl || 0) +
                                (updatedProd.size_stock_xxl || 0);
          await supabase
            .from("products")
            .update({ stock: newTotalStock })
            .eq("id", productId);
        }
      }
    }

    // Recalculate and synchronize parent product stock fields
    await this.syncProductTotalStock(productId);

    await CacheService.del("products:list");
    await CacheService.del("products:list:all");
    await CacheService.delPattern("products:slug:*");
    return true;
  },

  async adjustVariantStockBySize(
    productId: string,
    size: string,
    delta: number
  ): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: variants, error: fetchErr } = await supabase
      .from("product_variants")
      .select("id, color, stock")
      .eq("product_id", productId)
      .eq("size", size);

    if (fetchErr) return false;

    if (variants && variants.length > 0) {
      // Update the size variant (at most one due to UNIQUE size constraint)
      const v = variants[0];
      const newStock = Math.max(0, v.stock + delta);
      const { error } = await supabase
        .from("product_variants")
        .update({ stock: newStock })
        .eq("id", v.id);
      if (error) {
        console.error("adjustVariantStockBySize error:", error);
        return false;
      }
    } else {
      // Fallback: update legacy column on products table
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

    // Sync total product stock and size stock columns
    await this.syncProductTotalStock(productId);

    await CacheService.del("products:list");
    await CacheService.del("products:list:all");
    await CacheService.delPattern("products:slug:*");
    return true;
  },

  async syncProductTotalStock(productId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;

    // Fetch all variants for this product
    const { data: variants } = await supabase
      .from("product_variants")
      .select("size, stock")
      .eq("product_id", productId);

    if (variants && variants.length > 0) {
      // Derive sizeStock and total stock
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
      // Fallback: recalculate stock from existing size_stock columns
      const { data: product } = await supabase
        .from("products")
        .select("size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl")
        .eq("id", productId)
        .single();

      if (product) {
        const totalStock = (product.size_stock_s || 0) +
                           (product.size_stock_m || 0) +
                           (product.size_stock_l || 0) +
                           (product.size_stock_xl || 0) +
                           (product.size_stock_xxl || 0);
        await supabase
          .from("products")
          .update({ stock: totalStock })
          .eq("id", productId);
      }
    }
    return true;
  },

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("order_status_history").select("id, order_id, status, notes, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching order status history:", error);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      order_id: row.order_id,
      status: row.status,
      updated_by: row.updated_by || "system",
      metadata: row.metadata || {},
      created_at: row.created_at
    }));
  },

  async addOrderStatusHistory(orderId: string, status: string, updatedBy?: string, metadata?: any): Promise<OrderStatusHistory> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const entry = {
      order_id: orderId,
      status,
      updated_by: updatedBy || "system",
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("order_status_history").insert(entry).select().single();
    if (error) {
      console.error("Error inserting order status history:", error);
      throw error;
    }
    return {
      id: data.id,
      order_id: data.order_id,
      status: data.status,
      updated_by: data.updated_by,
      metadata: data.metadata,
      created_at: data.created_at
    };
  },

  async getCustomers(): Promise<any[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: profiles, error: pError } = await supabase
      .from("profiles").select("id, name, email, phone, role, wallet_balance, loyalty_points, is_blocked, blocked_at, blocked_reason, created_at");

    if (pError) {
      console.error("Error fetching profiles:", pError);
      return [];
    }

    const { data: orders, error: oError } = await supabase
      .from("orders")
      .select("user_id, total, status");

    if (oError) {
      console.error("Error fetching orders for customers:", oError);
      return (profiles || []).map(p => ({
        ...p,
        ltv: 0,
        order_count: 0
      }));
    }

    return (profiles || []).map(p => {
      const userOrders = (orders || []).filter(o => o.user_id === p.id);
      const validOrders = userOrders.filter(o => o.status !== "Cancelled" && o.status !== "Expired");
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
  },

  async getCustomerProfile(userId: string): Promise<any | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('name, email, phone')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching customer profile:", error);
      return null;
    }
    return data;
  },

  async adjustCustomerBalance(email: string, type: "wallet" | "loyalty", amount: number, description: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
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
      const { error } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", profile.id);

      if (error) return false;

      await supabase.from("wallet_transactions").insert({
        id: "WLT-ADJ-" + Date.now(),
        user_id: profile.id,
        date: new Date().toLocaleDateString("en-IN"),
        amount: Math.abs(amount),
        type: amount > 0 ? "credit" : "debit",
        description
      });
    } else {
      const newPoints = Number(profile.loyalty_points || 0) + amount;
      const { error } = await supabase
        .from("profiles")
        .update({ loyalty_points: newPoints })
        .eq("id", profile.id);

      if (error) return false;

      await supabase.from("loyalty_transactions").insert({
        id: "LYL-ADJ-" + Date.now(),
        user_id: profile.id,
        date: new Date().toLocaleDateString("en-IN"),
        points: Math.abs(amount),
        type: amount > 0 ? "credit" : "debit",
        description
      });
    }

    return true;
  },

  // --- Shipments ---
  async getShipmentByOrderId(orderId: string): Promise<Shipment | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("shipments").select("id, order_id, shiprocket_order_id, shipment_id, awb_code, courier_name, status, created_at, updated_at")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching shipment from Supabase:", error);
      return null;
    }
    return data;
  },

  async getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("shipment_events").select("id, shipment_id, status, activity, location, timestamp")
      .eq("shipment_id", shipmentId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error fetching shipment events from Supabase:", error);
      return [];
    }
    return data || [];
  },

  async saveShipment(shipment: Partial<Shipment>): Promise<Shipment> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const payload = {
      order_id: shipment.order_id,
      shiprocket_order_id: shipment.shiprocket_order_id,
      shipment_id: shipment.shipment_id,
      awb_code: shipment.awb_code,
      courier_name: shipment.courier_name,
      status: shipment.status,
      etd: shipment.etd,
      weight: shipment.weight,
      dimensions_length: shipment.dimensions_length || 30,
      dimensions_width: shipment.dimensions_width || 22,
      dimensions_height: shipment.dimensions_height || 5,
      updated_at: new Date().toISOString()
    };

    if (shipment.id) {
      (payload as any).id = shipment.id;
    }

    const { data, error } = await supabase
      .from("shipments")
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error saving shipment to Supabase:", error);
      throw error;
    }
    return data;
  },

  async saveShipmentEvent(event: Partial<ShipmentEvent>): Promise<ShipmentEvent> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const payload = {
      shipment_id: event.shipment_id,
      status: event.status,
      activity: event.activity,
      location: event.location,
      timestamp: event.timestamp || new Date().toISOString()
    };

    if (event.id) {
      (payload as any).id = event.id;
    }

    const { data, error } = await supabase
      .from("shipment_events")
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error saving shipment event to Supabase:", error);
      throw error;
    }
    return data;
  },

  async saveTrackingLog(log: { shipment_id: string; raw_payload: any }): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { error } = await supabase
      .from("tracking_logs")
      .insert({
        shipment_id: log.shipment_id,
        raw_payload: log.raw_payload
      });

    if (error) {
      console.error("Error saving tracking log to Supabase:", error);
    }
  },

  async getNextOrderNumber(): Promise<string> {
    return this.generateOrderId('razorpay');
  },

  async createPaymentAuditLog(orderId: string, previousStatus: string | null, newStatus: string, source: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("payment_audit_logs").insert({
      order_id: orderId,
      previous_status: previousStatus,
      new_status: newStatus,
      source: source
    });
    if (error) {
      console.error("Error creating payment audit log:", error);
    }
  },

  async createOrderEvent(orderId: string, event: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("order_events").insert({
      order_id: orderId,
      event: event,
      created_at: new Date().toISOString()
    });
    if (error) {
      console.error("Error creating order event:", error);
    }
  },

  async getOrderEvents(orderId: string): Promise<Array<{
    id: string;
    type: string;        // "status_change" | "payment" | "refund" | "shipment"
    description: string; // human-readable
    actor?: string;      // email or system name
    payload?: any;       // optional details
    created_at: string;
  }>> {
    const { supabase, isSupabaseConfigured } = loadService();

    let dbEvents: any[] = [];
    let dbHistory: any[] = [];

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    } else {
      const [eventsRes, historyRes] = await Promise.all([
        supabase
          .from("order_events").select("id, order_id, message, created_at")
          .eq("order_id", orderId),
        supabase
          .from("order_status_history").select("id, order_id, status, notes, created_at")
          .eq("order_id", orderId)
      ]);

      if (eventsRes.error) {
        console.error("Error fetching order events:", eventsRes.error);
      } else {
        dbEvents = eventsRes.data || [];
      }

      if (historyRes.error) {
        console.error("Error fetching order status history:", historyRes.error);
      } else {
        dbHistory = historyRes.data || [];
      }
    }

    const merged: Array<{
      id: string;
      type: string;
      description: string;
      actor?: string;
      payload?: any;
      created_at: string;
    }> = [];

    for (const ev of dbEvents) {
      const evDesc = ev.event || ev.description || "";
      const evDescLower = evDesc.toLowerCase();
      merged.push({
        id: ev.id || "EVT-" + Math.random().toString(36).substr(2, 9),
        type: evDescLower.includes("refund") ? "refund" :
              evDescLower.includes("shipment") || evDescLower.includes("awb") ? "shipment" :
              evDescLower.includes("payment") ? "payment" : "event",
        description: evDesc,
        actor: "System",
        created_at: ev.created_at
      });
    }

    for (const h of dbHistory) {
      merged.push({
        id: h.id,
        type: "status_change",
        description: `Order status changed to ${h.status}`,
        actor: h.updated_by || "system",
        payload: h.metadata || {},
        created_at: h.created_at
      });
    }

    return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async releaseReservation(sessionId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (isSupabaseConfigured && supabase) {
      await supabase.from("inventory_reservations").update({ status: 'RELEASED' }).eq("session_id", sessionId);
    }
  },

  async dispatchFulfillment(orderId: string): Promise<{ success: boolean; status: 'CREATED' | 'RETRYING'; error?: string }> {
    try {
      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Use the address captured at checkout time — no fallback or name-matching
      const snap = order.address_snapshot;
      if (!snap) {
        throw new Error(`Order ${orderId} has no address_snapshot — cannot dispatch without a verified delivery address`);
      }
      const shippingAddress = {
        name: snap.name || order.customer,
        phone: snap.phone || "",
        address_line_1: snap.address_line_1 || "",
        address_line_2: snap.address_line_2 || "",
        city: snap.city || "",
        state: snap.state || "",
        postal_code: snap.postal_code || "",
        country: snap.country || "India",
        email: snap.email || "",
      };

      // Format items
      const useCartItems = Array.isArray(order.cartItems) && order.cartItems.length > 0;
      const quantity = useCartItems ? order.cartItems!.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) : (order.items.length || 1);
      const orderItems = useCartItems
        ? order.cartItems!.map((item: any, idx: number) => {
            const name = item.productName || item.title || "Luxury Atelier Shirt";
            const sku = item.productId ? `SKU-${item.productId}-${item.size || "M"}-${item.color || "Default"}` : `SKU-${name.toUpperCase().substring(0, 5).replace(/\s+/g, "")}-${idx}`;
            return {
              name,
              sku,
              units: item.quantity || 1,
              selling_price: Number(item.price || Math.round(order.total / quantity)),
            };
          })
        : order.items.map((itemStr: any, idx: number) => {
            const name = typeof itemStr === "string" ? itemStr : (itemStr.productName || itemStr.title || "Luxury Atelier Shirt");
            const sku = `SKU-${name.toUpperCase().substring(0, 5).replace(/\s+/g, "")}-${idx}`;
            return {
              name,
              sku,
              units: 1,
              selling_price: Math.round(order.total / quantity),
            };
          });

      const weight = 0.4 * quantity;
      const length = 30;
      const width = 22;
      const height = Math.max(5, 5 * quantity);

      const shiprocketPayload = {
        order_id: order.id,
        order_date: new Date().toISOString().split("T")[0],
        pickup_location: DEFAULT_PICKUP_LOCATION,
        billing_customer_name: shippingAddress.name.split(" ")[0] || "Customer",
        billing_last_name: shippingAddress.name.split(" ").slice(1).join(" ") || "Atelier",
        billing_address: shippingAddress.address_line_1,
        billing_address_2: shippingAddress.address_line_2,
        billing_city: shippingAddress.city,
        billing_pincode: shippingAddress.postal_code,
        billing_state: shippingAddress.state,
        billing_country: shippingAddress.country,
        billing_email: shippingAddress.email,
        billing_phone: shippingAddress.phone,
        shipping_is_billing: true,
        order_items: orderItems,
        payment_method: "Prepaid" as const,
        sub_total: order.total,
        length,
        width,
        height,
        weight,
      };

      const result = await shiprocket.createAndDispatchOrder(shiprocketPayload);

      if (!result.success) {
        // Queue retry via BullMQ
        try {
          const { Queue } = await import("bullmq");
          const redisUrlStr = process.env.REDIS_URL || "redis://localhost:6379";
          const redisUrl = new URL(redisUrlStr);
          const connectionOptions = {
            host: redisUrl.hostname,
            port: Number(redisUrl.port) || 6379,
            password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
            tls: redisUrl.protocol === "rediss:" ? {} : undefined,
            maxRetriesPerRequest: null,
          };
          const retryQueue = new Queue("shipment-retry", { connection: connectionOptions });
          await retryQueue.add("retry_shipment", { orderId }, { delay: 5 * 60 * 1000 }); // initial 5 mins delay
          await retryQueue.close();
        } catch (queueErr) {
          console.error("[Dispatch] Failed to queue retry job:", queueErr);
        }

        // Save failed shipment as RETRYING
        await this.saveShipment({
          order_id: order.id,
          shiprocket_order_id: "",
          shipment_id: "",
          awb_code: `RETRY-AWB-${order.id}`,
          courier_name: "Shiprocket Partner Courier",
          status: "RETRYING",
          weight,
          dimensions_length: length,
          dimensions_width: width,
          dimensions_height: height,
        });

        await this.createOrderEvent(order.id, "Shipment Failed - Retrying");

        return { success: false, status: 'RETRYING', error: result.error };
      }

      // Success
      await this.saveShipment({
        order_id: order.id,
        shiprocket_order_id: String(result.shiprocketOrderId || ""),
        shipment_id: String(result.shipmentId || ""),
        awb_code: result.awbCode || "",
        courier_name: result.courierName || "Shiprocket Partner Courier",
        status: "CREATED",
        weight,
        dimensions_length: length,
        dimensions_width: width,
        dimensions_height: height,
      });

      await this.createOrderEvent(order.id, "Shipment Created");
      await this.createOrderEvent(order.id, "AWB Generated");

      // STEP 3: Label and Manifest generation
      let labelUrl: string | null = null;
      let manifestUrl: string | null = null;

      if (result.shipmentId) {
        try {
          const shipmentIdNum = Number(result.shipmentId);
          const labelRes = await shiprocket.generateShippingLabel(shipmentIdNum);
          if (labelRes.success && labelRes.labelUrl) {
            labelUrl = labelRes.labelUrl;
            
            const manifestRes = await shiprocket.generateManifest(shipmentIdNum);
            if (manifestRes.success && manifestRes.manifestUrl) {
              manifestUrl = manifestRes.manifestUrl;
            }

            // Update shipments row in Supabase
            const { supabase } = loadService();
            if (supabase) {
              await supabase
                .from("shipments")
                .update({
                  label_url: labelUrl,
                  manifest_url: manifestUrl,
                  updated_at: new Date().toISOString()
                })
                .eq("order_id", order.id);
            }

            await this.createOrderEvent(order.id, "Shipping label generated. AWB: " + result.awbCode);
          } else {
            console.error("[Dispatch] Shipping label generation failed:", labelRes.error);
          }
        } catch (labelErr) {
          console.error("[Dispatch] Error generating shipping label/manifest:", labelErr);
        }
      }

      // Update order status with shiprocketId and mark as Shipped
      const updatedOrder = { ...order, status: "Shipped", shiprocketId: result.awbCode || "" };
      await this.saveOrder(updatedOrder);

      // Create order status history log
      try {
        await this.addOrderStatusHistory(order.id, "Shipped", "Fulfillment dispatched via Shiprocket", {
          awb: result.awbCode || "",
          courier: result.courierName || "",
        });
      } catch (historyErr) {
        console.error("[Dispatch] Failed to add order status history:", historyErr);
      }

      // STEP 5: Call shipping confirmation email
      try {
        const snapEmail = order.address_snapshot?.email;
        const snapName = order.address_snapshot?.name || order.customer;
        if (snapEmail) {
          const { sendShippingConfirmationEmail } = await import("./email");
          const etdDate = result.etd 
            ? new Date(result.etd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          
          const items = Array.isArray(order.cartItems)
            ? order.cartItems.map((item: any) => ({
                name: item.productName || item.title || "Luxury Atelier Shirt",
                quantity: item.quantity || 1,
              }))
            : order.items.map((itemStr: any) => ({
                name: typeof itemStr === "string" ? itemStr : (itemStr.productName || itemStr.title || "Luxury Atelier Shirt"),
                quantity: 1,
              }));

          const trackingUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com") + "/ordertracking?orderId=" + order.id;

          await sendShippingConfirmationEmail({
            to: snapEmail,
            customerName: snapName,
            orderId: order.id,
            awbCode: result.awbCode || "PENDING",
            courierName: result.courierName || "Shiprocket Partner Courier",
            estimatedDelivery: etdDate,
            items,
            trackingUrl,
          });
        }
      } catch (emailErr) {
        console.error("[Dispatch] Failed to send shipping confirmation email:", emailErr);
      }

      return { success: true, status: 'CREATED' };

    } catch (e: any) {
      console.error("[Dispatch] Unhandled dispatch exception:", e);
      // Save shipment as RETRYING
      await this.saveShipment({
        order_id: orderId,
        shiprocket_order_id: "",
        shipment_id: "",
        awb_code: `RETRY-AWB-${orderId}`,
        courier_name: "Shiprocket Partner Courier",
        status: "RETRYING",
      });

      await this.createOrderEvent(orderId, "Shipment Failed - Retrying");

      // Queue retry via BullMQ
      try {
        const { Queue } = await import("bullmq");
        const redisUrlStr = process.env.REDIS_URL || "redis://localhost:6379";
        const redisUrl = new URL(redisUrlStr);
        const connectionOptions = {
          host: redisUrl.hostname,
          port: Number(redisUrl.port) || 6379,
          password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
          tls: redisUrl.protocol === "rediss:" ? {} : undefined,
          maxRetriesPerRequest: null,
        };
        const retryQueue = new Queue("shipment-retry", { connection: connectionOptions });
        await retryQueue.add("retry_shipment", { orderId }, { delay: 5 * 60 * 1000 });
        await retryQueue.close();
      } catch (queueErr) {
        console.error("[Dispatch] Failed to queue retry job:", queueErr);
      }

      return { success: false, status: 'RETRYING', error: e.message };
    }
  },

  async submitReview(review: { name: string; location: string; rating: number; comment: string }) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("reviews").insert([review]);
    return !error;
  },

  async getReviews(filter?: { approved?: boolean }) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    let q = supabase.from("reviews").select("id, rating, comment, name, location, approved, created_at").order("created_at", { ascending: false });
    if (filter && typeof filter.approved === "boolean") {
      q = q.eq("approved", filter.approved);
    }
    const { data } = await q;
    return data || [];
  },

  async updateReviewStatus(id: string, approved: boolean, approvedBy?: string) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const updateData: any = { approved };
    if (approved && approvedBy) {
      updateData.approved_by = approvedBy;
    }
    const { error } = await supabase.from("reviews").update(updateData).eq("id", id);
    return !error;
  },

  async deleteReview(id: string) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    return !error;
  },

  async updateReview(id: string, review: { comment?: string; rating?: number }) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase.from("reviews").update(review).eq("id", id);
    return !error;
  },

  // --- Analytics ---
  async getTodaySalesKPI(): Promise<{
    todaySales: number;
    todayOrders: number;
    salesChangePercent: number;
    ordersChangePercent: number;
    salesTrendStatus: "up" | "down" | "none" | "first";
    ordersTrendStatus: "up" | "down" | "none" | "first";
  }> {
    try {
      const orders = (await this.getOrders()) as any[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

      let todaySales = 0;
      let todayOrders = 0;
      let yesterdaySales = 0;
      let yesterdayOrders = 0;

      const parseOrderDate = (o: any): number => {
        const orderDateStr = o.created_at || o.createdAt || o.date;
        if (!orderDateStr) return Date.now();
        let orderTime = Date.parse(orderDateStr);
        if (isNaN(orderTime)) {
          const parts = orderDateStr.split("/");
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            orderTime = d.getTime();
          } else {
            orderTime = Date.now();
          }
        }
        return orderTime;
      };

      for (const o of orders) {
        const status = (o.status || "").toLowerCase();
        if (status === "cancelled" || status === "returned") continue;

        const orderTime = parseOrderDate(o);
        if (orderTime >= todayStart) {
          todaySales += Number(o.total || 0);
          todayOrders += 1;
        } else if (orderTime >= yesterdayStart && orderTime < todayStart) {
          yesterdaySales += Number(o.total || 0);
          yesterdayOrders += 1;
        }
      }

      let salesChangePercent = 0;
      let salesTrendStatus: "up" | "down" | "none" | "first" = "none";
      if (yesterdaySales === 0) {
        salesTrendStatus = todaySales > 0 ? "first" : "none";
      } else {
        const diff = todaySales - yesterdaySales;
        salesChangePercent = Math.round((diff / yesterdaySales) * 100);
        salesTrendStatus = diff > 0 ? "up" : (diff < 0 ? "down" : "none");
      }

      let ordersChangePercent = 0;
      let ordersTrendStatus: "up" | "down" | "none" | "first" = "none";
      if (yesterdayOrders === 0) {
        ordersTrendStatus = todayOrders > 0 ? "first" : "none";
      } else {
        const diff = todayOrders - yesterdayOrders;
        ordersChangePercent = Math.round((diff / yesterdayOrders) * 100);
        ordersTrendStatus = diff > 0 ? "up" : (diff < 0 ? "down" : "none");
      }

      return {
        todaySales,
        todayOrders,
        salesChangePercent,
        ordersChangePercent,
        salesTrendStatus,
        ordersTrendStatus,
      };
    } catch (e) {
      console.error("Error in getTodaySalesKPI:", e);
      return {
        todaySales: 0,
        todayOrders: 0,
        salesChangePercent: 0,
        ordersChangePercent: 0,
        salesTrendStatus: "none",
        ordersTrendStatus: "none",
      };
    }
  },

  async getDashboardKPIMetrics(): Promise<{
    aov: number;
    pendingShipments: number;
    refundRequests: number;
    customerGrowth: number;
    conversionRate: number;
    conversionRatePrev: number;
  }> {
    try {
      const orders = (await this.getOrders()) as any[];
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const parseOrderDate = (o: any): number => {
        const orderDateStr = o.created_at || o.createdAt || o.date;
        if (!orderDateStr) return Date.now();
        let orderTime = Date.parse(orderDateStr);
        if (isNaN(orderTime)) {
          const parts = orderDateStr.split("/");
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            orderTime = d.getTime();
          } else {
            orderTime = Date.now();
          }
        }
        return orderTime;
      };

      let recentTotal = 0;
      let recentCount = 0;
      let pendingCount = 0;
      let refundCount = 0;

      for (const o of orders) {
        const status = (o.status || "").toLowerCase();
        const orderTime = parseOrderDate(o);

        if (status !== "cancelled" && status !== "returned" && orderTime >= thirtyDaysAgo) {
          recentTotal += Number(o.total || 0);
          recentCount += 1;
        }

        if (["paid", "confirmed", "processing", "packed", "shipped", "out for delivery"].includes(status)) {
          pendingCount += 1;
        }

        if (["refund_requested", "refund_processing"].includes(status)) {
          refundCount += 1;
        }
      }

      const aov = recentCount > 0 ? Math.round(recentTotal / recentCount) : 0;

      let customerGrowth = 0;
      const { supabase, isSupabaseConfigured } = loadService();
      if (isSupabaseConfigured && supabase) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer")
          .gte("created_at", cutoff.toISOString());
        if (!error && count !== null) {
          customerGrowth = count;
        }
      }
      if (customerGrowth === 0) {
        const recentCustomers = new Set<string>();
        for (const o of orders) {
          if (parseOrderDate(o) >= thirtyDaysAgo) {
            recentCustomers.add(o.customer);
          }
        }
        customerGrowth = Math.max(1, recentCustomers.size);
      }

      let conversionRate = 0;
      let conversionRatePrev = 0;

      if (isSupabaseConfigured && supabase) {
        const date30DaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const date60DaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

        const { count: checkoutAttempts } = await supabase
          .from('orders')
          .select("id", { count: "exact", head: true })
          .gte('created_at', date30DaysAgo);

        const { count: completedOrders } = await supabase
          .from('orders')
          .select("id", { count: "exact", head: true })
          .eq('status', 'Paid')
          .gte('created_at', date30DaysAgo);

        conversionRate = (checkoutAttempts && checkoutAttempts > 0)
          ? Math.round(((completedOrders || 0) / checkoutAttempts) * 100)
          : 0;

        const { count: prevCheckoutAttempts } = await supabase
          .from('orders')
          .select("id", { count: "exact", head: true })
          .gte('created_at', date60DaysAgo)
          .lt('created_at', date30DaysAgo);

        const { count: prevCompletedOrders } = await supabase
          .from('orders')
          .select("id", { count: "exact", head: true })
          .eq('status', 'Paid')
          .gte('created_at', date60DaysAgo)
          .lt('created_at', date30DaysAgo);

        conversionRatePrev = (prevCheckoutAttempts && prevCheckoutAttempts > 0)
          ? Math.round(((prevCompletedOrders || 0) / prevCheckoutAttempts) * 100)
          : 0;
      } else {
        conversionRate = 14;
        conversionRatePrev = 12;
      }

      return {
        aov,
        pendingShipments: pendingCount,
        refundRequests: refundCount,
        customerGrowth,
        conversionRate,
        conversionRatePrev,
      };
    } catch (e) {
      console.error("Error in getDashboardKPIMetrics:", e);
      return {
        aov: 0,
        pendingShipments: 0,
        refundRequests: 0,
        customerGrowth: 0,
        conversionRate: 0,
        conversionRatePrev: 0,
      };
    }
  },

  async getRevenueTrend(days: number = 30): Promise<Array<{
    date: string;
    revenue: number;
    order_count: number;
    gateway_revenue: number;
    wallet_revenue: number;
  }>> {
    const cacheKey = `analytics:revenue_trend:${days}`;
    try {
      const cached = await CacheService.get<any[]>(cacheKey);
      if (cached) return cached;

      const orders = (await this.getOrders()) as any[];
      const dateMap = new Map<string, any>();

      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const key = d.toISOString().split("T")[0];
        dateMap.set(key, {
          date: dateStr,
          revenue: 0,
          order_count: 0,
          gateway_revenue: 0,
          wallet_revenue: 0,
        });
      }

      const parseOrderDate = (o: any): number => {
        const orderDateStr = o.created_at || o.createdAt || o.date;
        if (!orderDateStr) return Date.now();
        let orderTime = Date.parse(orderDateStr);
        if (isNaN(orderTime)) {
          const parts = orderDateStr.split("/");
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            orderTime = d.getTime();
          } else {
            orderTime = Date.now();
          }
        }
        return orderTime;
      };

      for (const o of orders) {
        const status = (o.status || "").toLowerCase();
        if (status === "cancelled" || status === "returned") continue;

        const orderTime = parseOrderDate(o);
        const orderDate = new Date(orderTime);
        const key = orderDate.toISOString().split("T")[0];

        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.revenue += Number(o.total || 0);
          entry.order_count += 1;
          entry.gateway_revenue += Number(o.gatewayPaid || o.gateway_paid || 0);
          entry.wallet_revenue += Number(o.walletPaid || o.wallet_paid || 0);
        }
      }

      const result = Array.from(dateMap.values());
      await CacheService.set(cacheKey, result, 300); // 5 minutes
      return result;
    } catch (e) {
      console.error("Error in getRevenueTrend:", e);
      return [];
    }
  },

  async getTopProducts(days: number = 30, limit: number = 8): Promise<Array<{
    productName: string;
    unitsSold: number;
    revenue: number;
  }>> {
    const cacheKey = `analytics:top_products:${days}:${limit}`;
    try {
      const cached = await CacheService.get<any[]>(cacheKey);
      if (cached) return cached;

      const orders = (await this.getOrders()) as any[];
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

      const parseOrderDate = (o: any): number => {
        const orderDateStr = o.created_at || o.createdAt || o.date;
        if (!orderDateStr) return Date.now();
        let orderTime = Date.parse(orderDateStr);
        if (isNaN(orderTime)) {
          const parts = orderDateStr.split("/");
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            orderTime = d.getTime();
          } else {
            orderTime = Date.now();
          }
        }
        return orderTime;
      };

      const productMap = new Map<string, { productName: string; unitsSold: number; revenue: number }>();

      for (const o of orders) {
        const status = (o.status || "").toLowerCase();
        if (status === "cancelled" || status === "returned") continue;

        const orderTime = parseOrderDate(o);
        if (orderTime < cutoff) continue;

        const rawItems = o.cartItems || o.cart_items || [];
        if (Array.isArray(rawItems)) {
          for (const item of rawItems) {
            let pName = "";
            let qty = 1;
            let price = 0;
            if (typeof item === "object" && item !== null) {
              pName = item.productName || item.title || item.productId || "Unnamed Product";
              qty = Number(item.quantity || item.qty || 1);
              price = Number(item.price || 0);
            } else if (typeof item === "string") {
              pName = item;
              qty = 1;
              price = 0;
            }
            if (!pName) continue;
            const existing = productMap.get(pName);
            if (existing) {
              existing.unitsSold += qty;
              existing.revenue += price * qty;
            } else {
              productMap.set(pName, { productName: pName, unitsSold: qty, revenue: price * qty });
            }
          }
        } else if (Array.isArray(o.items)) {
          for (const item of o.items) {
            const pName = String(item);
            const existing = productMap.get(pName);
            if (existing) {
              existing.unitsSold += 1;
            } else {
              productMap.set(pName, { productName: pName, unitsSold: 1, revenue: 0 });
            }
          }
        }
      }

      const result = Array.from(productMap.values());
      result.sort((a, b) => b.unitsSold - a.unitsSold);
      const sliced = result.slice(0, limit);
      await CacheService.set(cacheKey, sliced, 300); // 5 minutes
      return sliced;
    } catch (e) {
      console.error("Error in getTopProducts:", e);
      return [];
    }
  },

  async getCouponPerformance(days: number = 30): Promise<Array<{
    coupon_code: string;
    times_used: number;
    total_savings: number;
    avg_order_value: number;
  }>> {
    const cacheKey = `analytics:coupons:${days}`;
    try {
      const cached = await CacheService.get<any[]>(cacheKey);
      if (cached) return cached;

      const orders = (await this.getOrders()) as any[];
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

      const parseOrderDate = (o: any): number => {
        const orderDateStr = o.created_at || o.createdAt || o.date;
        if (!orderDateStr) return Date.now();
        let orderTime = Date.parse(orderDateStr);
        if (isNaN(orderTime)) {
          const parts = orderDateStr.split("/");
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            orderTime = d.getTime();
          } else {
            orderTime = Date.now();
          }
        }
        return orderTime;
      };

      const performanceMap = new Map<string, { coupon_code: string; times_used: number; total_savings: number; total_order_value: number }>();

      for (const o of orders) {
        const status = (o.status || "").toLowerCase();
        if (status === "cancelled" || status === "returned") continue;

        const orderTime = parseOrderDate(o);
        if (orderTime < cutoff) continue;

        const cCode = (o.couponCode || o.coupon_code || "").trim().toUpperCase();
        if (!cCode) continue;

        const savings = Number(o.couponDiscount || o.coupon_discount || 0);

        const existing = performanceMap.get(cCode);
        if (existing) {
          existing.times_used += 1;
          existing.total_savings += savings;
          existing.total_order_value += Number(o.total || 0);
        } else {
          performanceMap.set(cCode, {
            coupon_code: cCode,
            times_used: 1,
            total_savings: savings,
            total_order_value: Number(o.total || 0),
          });
        }
      }

      const result = Array.from(performanceMap.values()).map(cp => ({
        coupon_code: cp.coupon_code,
        times_used: cp.times_used,
        total_savings: cp.total_savings,
        avg_order_value: Math.round(cp.total_order_value / cp.times_used),
      }));

      result.sort((a, b) => b.times_used - a.times_used);
      const sliced = result.slice(0, 10);
      await CacheService.set(cacheKey, sliced, 300); // 5 minutes
      return sliced;
    } catch (e) {
      console.error("Error in getCouponPerformance:", e);
      return [];
    }
  },

  async getOrderNotes(orderId: string): Promise<OrderNote[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { data, error } = await supabase
      .from("order_notes").select("id, order_id, created_by, note, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching order notes:", error);
      throw error;
    }
    return (data || []).map(n => ({
      id: n.id,
      orderId: n.order_id,
      note: n.note,
      createdBy: n.created_by,
      createdAt: n.created_at
    }));
  },

  async addOrderNote(orderId: string, note: string, createdBy: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase
      .from("order_notes")
      .insert({
        order_id: orderId,
        note,
        created_by: createdBy
      });
    if (error) {
      console.error("Error saving order note:", error);
      throw error;
    }
  },

  async deleteOrderNote(noteId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase
      .from("order_notes")
      .delete()
      .eq("id", noteId);
    if (error) {
      console.error("Error deleting order note:", error);
      throw error;
    }
  },

  async recordPageView(path: string, sessionId: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { error } = await supabase
      .from("page_views")
      .insert({
        path,
        session_id: sessionId
      });
    if (error) {
      console.error("Error recording page view:", error);
    }
  },

  async getOnlineVisitorsCount(): Promise<number> {
    const { supabase, isSupabaseConfigured } = loadService();
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data, error } = await supabase
      .from("page_views")
      .select("session_id")
      .gte("created_at", fiveMinutesAgo);

    if (error) {
      console.error("Error getting online visitors:", error);
      return 3;
    }
    const uniqueSessions = new Set((data || []).map(r => r.session_id));
    return Math.max(3, uniqueSessions.size);
  },

  async getActiveCartsCount(): Promise<number> {
    const { supabase, isSupabaseConfigured } = loadService();
    const thirtyMinsAgo = new Date(Date.now() - 1800000).toISOString();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { count, error } = await supabase
      .from("user_cart")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", thirtyMinsAgo);

    if (error) {
      console.error("Error fetching active carts count:", error);
      return 7;
    }
    return count || 7;
  },

  async getMonthlyFinanceSummary(year: number, month: number): Promise<{
    grossRevenue: number;
    netRevenue: number;
    totalRefunds: number;
    gstCollected: number;
    ordersCount: number;
    avgOrderValue: number;
  }> {
    const { supabase, isSupabaseConfigured } = loadService();

    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select("total, refund_amount, status, cart_items")
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    if (error) {
      console.error("Error loading monthly finance summary:", error);
      throw error;
    }

    const validOrders = (orders || []).filter(o => o.status !== "Cancelled" && o.status !== "Expired");
    const grossRevenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalRefunds = validOrders.reduce((sum, o) => sum + Number(o.refund_amount || 0), 0);
    const netRevenue = grossRevenue - totalRefunds;

    // GST calculation: use actual product gstRate or fallback 12%
    let gstCollected = 0;
    for (const o of validOrders) {
      let orderGst = 0;
      const cartItemsList = o.cart_items || [];
      if (Array.isArray(cartItemsList) && cartItemsList.length > 0 && typeof cartItemsList[0] === "object") {
        for (const item of cartItemsList) {
          const price = Number(item.price || 0);
          const qty = Number(item.quantity || item.qty || 1);
          const rate = Number(item.gstRate || item.gst_rate || 12);
          const itemTotal = price * qty;
          orderGst += (itemTotal - (itemTotal / (1 + rate / 100)));
        }
      } else {
        const total = Number(o.total || 0);
        orderGst = total - (total / 1.12);
      }
      gstCollected += orderGst;
    }

    const ordersCount = validOrders.length;
    const avgOrderValue = ordersCount > 0 ? Math.round(grossRevenue / ordersCount) : 0;

    return {
      grossRevenue,
      netRevenue,
      totalRefunds,
      gstCollected: Math.round(gstCollected),
      ordersCount,
      avgOrderValue
    };
  },

  async getGSTReport(monthsCount: number): Promise<Array<{
    monthName: string;
    grossSales: number;
    gstCollected: number;
    netSales: number;
  }>> {
    const { supabase, isSupabaseConfigured } = loadService();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - monthsCount);
    const startLimit = dateLimit.toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("total, created_at, status, cart_items")
      .gte("created_at", startLimit);

    if (error) {
      console.error("Error loading GST report:", error);
      throw error;
    }

    const validOrders = (orders || []).filter(o => o.status !== "Cancelled" && o.status !== "Expired");
    
    const groups: Record<string, { grossSales: number; gstCollected: number; netSales: number }> = {};
    for (const order of validOrders) {
      const orderDate = new Date(order.created_at);
      const key = orderDate.toLocaleString("en-US", { month: "short", year: "numeric" });
      if (!groups[key]) {
        groups[key] = { grossSales: 0, gstCollected: 0, netSales: 0 };
      }
      const total = Number(order.total || 0);
      
      let orderGst = 0;
      const cartItemsList = order.cart_items || [];
      if (Array.isArray(cartItemsList) && cartItemsList.length > 0 && typeof cartItemsList[0] === "object") {
        for (const item of cartItemsList) {
          const price = Number(item.price || 0);
          const qty = Number(item.quantity || item.qty || 1);
          const rate = Number(item.gstRate || item.gst_rate || 12);
          const itemTotal = price * qty;
          orderGst += (itemTotal - (itemTotal / (1 + rate / 100)));
        }
      } else {
        orderGst = total - (total / 1.12);
      }

      groups[key].grossSales += total;
      groups[key].gstCollected += orderGst;
      groups[key].netSales += (total - orderGst);
    }

    return Object.entries(groups).map(([monthName, val]) => ({
      monthName,
      grossSales: Math.round(val.grossSales),
      gstCollected: Math.round(val.gstCollected),
      netSales: Math.round(val.netSales)
    })).sort((a, b) => new Date(b.monthName).getTime() - new Date(a.monthName).getTime());
  },

  async getCityOrders(): Promise<Array<{ city: string; count: number; revenue: number }>> {
    const { supabase, isSupabaseConfigured } = loadService();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("orders")
      .select("address_snapshot, total, status")
      .gte("created_at", thirtyDaysAgo);

    if (error) {
      console.error("Error loading city orders:", error);
      return [];
    }

    const cityData: Record<string, { count: number; revenue: number }> = {};
    for (const row of data || []) {
      const statusLower = (row.status || "").toLowerCase();
      if (statusLower === "cancelled" || statusLower === "returned" || statusLower === "expired" || statusLower === "failed") {
        continue;
      }
      const snap = row.address_snapshot;
      if (snap && snap.city) {
        const city = snap.city.trim().replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        if (!cityData[city]) {
          cityData[city] = { count: 0, revenue: 0 };
        }
        cityData[city].count += 1;
        cityData[city].revenue += Number(row.total || 0);
      }
    }

    return Object.entries(cityData)
      .map(([city, val]) => ({ city, count: val.count, revenue: Math.round(val.revenue) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  },

  async getSalesByCategory(days: number = 30): Promise<CategorySales[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    const cacheKey = `analytics:sales-category:${days}`;
    const cached = await CacheService.get<CategorySales[]>(cacheKey);
    if (cached) return cached;

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const { data: productsData, error: prodErr } = await supabase
      .from("products")
      .select("id, title, category");

    if (prodErr) {
      console.error("Error fetching products for category stats:", prodErr);
      return [];
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select("id, total, status, cart_items")
      .gte("created_at", cutoff);

    if (ordersErr) {
      console.error("Error fetching orders for category stats:", ordersErr);
      return [];
    }

    const productById: Record<string, any> = {};
    const productByTitle: Record<string, any> = {};
    const productByTitleLower: Record<string, any> = {};

    if (productsData) {
      for (const p of productsData) {
        if (p.id) productById[p.id] = p;
        if (p.title) {
          productByTitle[p.title] = p;
          productByTitleLower[p.title.toLowerCase().trim()] = p;
        }
      }
    }

    const categoryStatsMap: Record<string, { category: string; revenue: number; orderCount: number; unitsSold: number; orderIds: Set<string> }> = {};

    for (const order of ordersData || []) {
      const statusLower = (order.status || "").toLowerCase();
      if (statusLower === "cancelled" || statusLower === "returned" || statusLower === "expired" || statusLower === "failed") {
        continue;
      }

      const cartItems = order.cart_items || [];
      if (!Array.isArray(cartItems)) continue;

      for (const item of cartItems) {
        const cartItemName = item.productName || item.title || "";
        const cartItemId = item.productId || item.product_id;

        let matchedProduct = null;
        if (cartItemId && productById[cartItemId]) {
          matchedProduct = productById[cartItemId];
        } else if (cartItemName) {
          if (productByTitle[cartItemName]) {
            matchedProduct = productByTitle[cartItemName];
          } else {
            const keyLower = cartItemName.toLowerCase().trim();
            if (productByTitleLower[keyLower]) {
              matchedProduct = productByTitleLower[keyLower];
            }
          }
        }

        const category = matchedProduct ? (matchedProduct.category || "Uncategorized") : "Uncategorized";

        if (!categoryStatsMap[category]) {
          categoryStatsMap[category] = {
            category,
            revenue: 0,
            orderCount: 0,
            unitsSold: 0,
            orderIds: new Set<string>(),
          };
        }

        const itemQty = Number(item.quantity || item.qty || 1);
        categoryStatsMap[category].unitsSold += itemQty;
        categoryStatsMap[category].orderIds.add(order.id);
        categoryStatsMap[category].revenue += Number(order.total || 0);
      }
    }

    const result: CategorySales[] = Object.values(categoryStatsMap).map((c) => ({
      category: c.category,
      revenue: Math.round(c.revenue),
      orderCount: c.orderIds.size,
      unitsSold: c.unitsSold,
      percentage: 0,
    }));

    const totalRevenue = result.reduce((sum, item) => sum + item.revenue, 0);
    for (const item of result) {
      item.percentage = totalRevenue > 0 ? Number(((item.revenue / totalRevenue) * 100).toFixed(1)) : 0;
    }

    result.sort((a, b) => b.revenue - a.revenue);
    const finalResult = result.slice(0, 6);

    await CacheService.set(cacheKey, finalResult, 300);
    return finalResult;
  },

  async getRepeatPurchaseRate(days: number = 30): Promise<RepeatPurchaseStats> {
    const { supabase, isSupabaseConfigured } = loadService();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, status")
      .gte("created_at", cutoff);

    if (error) {
      console.error("Error in getRepeatPurchaseRate:", error);
      return { totalCustomers: 0, repeatCustomers: 0, repeatRate: 0 };
    }

    const userOrderCounts: Record<string, number> = {};
    for (const order of data || []) {
      const uId = order.user_id;
      if (!uId) continue;
      const statusLower = (order.status || "").toLowerCase();
      if (statusLower === "cancelled" || statusLower === "returned" || statusLower === "expired" || statusLower === "failed") {
        continue;
      }
      userOrderCounts[uId] = (userOrderCounts[uId] || 0) + 1;
    }

    let totalCustomers = 0;
    let repeatCustomers = 0;
    for (const count of Object.values(userOrderCounts)) {
      totalCustomers++;
      if (count > 1) {
        repeatCustomers++;
      }
    }

    const repeatRate = totalCustomers > 0
      ? Number(((repeatCustomers * 100) / totalCustomers).toFixed(1))
      : 0;

    return {
      totalCustomers,
      repeatCustomers,
      repeatRate,
    };
  },

  async getAdSpend(months: number = 3): Promise<AdSpend[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setDate(1);
    const { data, error } = await supabase
      .from("ad_spend")
      .select("id, channel, month, spend_amount, campaign_name, notes, created_at")
      .gte("month", cutoff.toISOString().split("T")[0])
      .order("month", { ascending: false });

    if (error) {
      console.error("Error in getAdSpend:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      channel: row.channel,
      month: row.month,
      spendAmount: Number(row.spend_amount),
      campaignName: row.campaign_name,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  },

  async saveAdSpend(data: {
    channel: string;
    month: string;
    spendAmount: number;
    campaignName?: string;
    notes?: string;
  }): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }
    const { channel, month, spendAmount, campaignName, notes } = data;
    const targetMonth = month.endsWith("-01") ? month : `${month}-01`;
    const campaign = campaignName || null;

    let query = supabase
      .from("ad_spend")
      .select("id")
      .eq("channel", channel)
      .eq("month", targetMonth);

    if (campaign) {
      query = query.eq("campaign_name", campaign);
    } else {
      query = query.is("campaign_name", null);
    }

    const { data: existing, error: selectErr } = await query;
    if (selectErr) throw selectErr;

    if (existing && existing.length > 0) {
      const { error: updateErr } = await supabase
        .from("ad_spend")
        .update({ spend_amount: spendAmount, notes: notes || null })
        .eq("id", existing[0].id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from("ad_spend")
        .insert({
          channel,
          month: targetMonth,
          spend_amount: spendAmount,
          campaign_name: campaign,
          notes: notes || null,
        });
      if (insertErr) throw insertErr;
    }
  },

  async getROASReport(months: number = 3): Promise<ROASReport[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Database connection not configured. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'environment variables.'
      );
    }

    const spendRecords = await this.getAdSpend(months);

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setDate(1);
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("total, utm_source, created_at, status")
      .gte("created_at", cutoff.toISOString());

    if (ordersErr) {
      console.error("Error in getROASReport orders fetch:", ordersErr);
      return [];
    }

    const validOrders = (orders || []).filter((o: any) => {
      const statusLower = (o.status || "").toLowerCase();
      return statusLower !== "cancelled" && statusLower !== "returned" && statusLower !== "expired" && statusLower !== "failed";
    });

    const spendMap: Record<string, number> = {};
    for (const s of spendRecords) {
      const mStr = s.month.substring(0, 10);
      const key = `${s.channel}_${mStr}`;
      spendMap[key] = (spendMap[key] || 0) + s.spendAmount;
    }

    const instagramSpendMonths = new Set<string>();
    for (const s of spendRecords) {
      if (s.channel === "instagram") {
        instagramSpendMonths.add(s.month.substring(0, 10));
      }
    }

    const revenueMap: Record<string, number> = {};
    for (const o of validOrders) {
      const orderDate = new Date(o.created_at);
      const yyyy = orderDate.getFullYear();
      const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
      const mStr = `${yyyy}-${mm}-01`;

      const utmSource = (o.utm_source || "").toLowerCase();
      let channel = "other";

      if (utmSource.includes("google")) {
        channel = "google_ads";
      } else if (utmSource.includes("facebook")) {
        channel = "meta_ads";
      } else if (utmSource.includes("instagram")) {
        if (instagramSpendMonths.has(mStr)) {
          channel = "instagram";
        } else {
          channel = "meta_ads";
        }
      } else if (utmSource !== "") {
        channel = "other";
      } else {
        continue;
      }

      const key = `${channel}_${mStr}`;
      revenueMap[key] = (revenueMap[key] || 0) + Number(o.total || 0);
    }

    const reportMap = new Map<string, ROASReport>();

    const allKeys = new Set([...Object.keys(spendMap), ...Object.keys(revenueMap)]);
    for (const key of allKeys) {
      const [channel, month] = key.split("_");
      if (!channel || !month) continue;

      const spend = spendMap[key] || 0;
      const revenue = revenueMap[key] || 0;
      if (spend === 0 && revenue === 0) continue;

      const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;
      const roasFormatted = spend > 0 ? `${roas}x` : "0.0x";

      reportMap.set(key, {
        channel,
        month,
        spend,
        revenue: Math.round(revenue),
        roas,
        roasFormatted,
      });
    }

    return Array.from(reportMap.values()).sort(
      (a, b) => b.month.localeCompare(a.month) || a.channel.localeCompare(b.channel)
    );
  },
};

