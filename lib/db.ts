import { RegistryManager, Product, ProductVariant, Order, Coupon, WalletTransaction, LoyaltyTransaction, UserAddress, OrderStatusHistory, Shipment, ShipmentEvent, TrackingLog } from "./registry";
import { CacheService } from "./cache";
import { InventoryService } from "./services/inventory";
import { shiprocket } from "./shiprocket";
import { CartItem } from "@/stores/cartStore";

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

// Initialize BullMQ background jobs on server start
if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
  const globalAny = global as any;
  if (!globalAny.jobsInitialized) {
    globalAny.jobsInitialized = true;
    import("./jobs/jobs-init").then(({ initJobs }) => {
      initJobs().catch((err) => console.warn("Failed to initialize background jobs:", err.message));
    });
    // Import workers to start listening
    import("./jobs/reservation-cleanup").catch(() => {});
    import("./jobs/shipment-retry").catch(() => {});
    import("./jobs/shipment-sync").catch(() => {});
  }
}

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
  if (!isSupabaseConfigured || !supabase) return products;

  const productIds = products.map((p) => p.id);
  const { data: allVariants } = await supabase
    .from("product_variants")
    .select("*")
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

export const db = {
  // --- Products ---
  async getProducts(options?: { includeDeleted?: boolean; trashedOnly?: boolean; display_section?: string }): Promise<Product[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    let cacheKey = options?.trashedOnly
      ? "products:list:trashed"
      : options?.includeDeleted
        ? "products:list:all"
        : "products:list";
    if (options?.display_section) {
      cacheKey += `:section:${options.display_section}`;
    }
    const cached = await CacheService.get<Product[]>(cacheKey);
    if (cached) return cached;

    if (!isSupabaseConfigured || !supabase) {
      const res = await RegistryManager.getProducts();
      let filteredRes = options?.display_section
        ? res.filter(p => p.display_sections?.includes(options.display_section!))
        : res;
      if (!options?.includeDeleted) {
        filteredRes = filteredRes.filter(p => !p.deleted_at && (p.productStatus === "active" || !p.productStatus));
      }
      await CacheService.set(cacheKey, filteredRes, 600);
      return filteredRes;
    }

    let query = supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (options?.trashedOnly) {
      query = query.not("deleted_at", "is", null);
    } else if (!options?.includeDeleted) {
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
    await CacheService.set(cacheKey, res, 600);
    return res;
  },

  async saveProduct(product: Partial<Product>): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    // Invalidate caches
    await CacheService.delPattern("products:list*");
    await CacheService.delPattern("products:slug:*");

    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.saveProduct(product);
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
        .upsert(variantRows, { onConflict: "product_id,size,color" });
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
      const res = await RegistryManager.getProductBySlug(slug);
      if (res) await CacheService.set(cacheKey, res, 600);
      return res;
    }
    const { data, error } = await supabase
      .from("products")
      .select("*")
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
    await CacheService.set(cacheKey, res, 600);
    return res;
  },

  async relatedProducts(slug: string): Promise<Product[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.relatedProducts(slug);
    }
    const current = await this.getProductBySlug(slug);
    if (!current) return [];

    const { data, error } = await supabase
      .from("products")
      .select("*")
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

  async deleteProduct(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    // Invalidate caches
    await CacheService.del("products:list");
    await CacheService.delPattern("products:slug:*");

    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.deleteProduct(id);
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Error deleting product from Supabase:", error);
      throw error;
    }
  },

  async softDeleteProduct(id: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;

    const { data: existing } = await supabase
      .from("products")
      .select("slug")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return false;

    await CacheService.del("products:list");
    await CacheService.del("products:list:all");
    await CacheService.del("products:list:trashed");
    if (existing?.slug) {
      await CacheService.del(`products:slug:${existing.slug}`);
    }
    await CacheService.delPattern("products:slug:*");

    return true;
  },

  async restoreProduct(id: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;

    const { data: existing } = await supabase
      .from("products")
      .select("slug")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("products")
      .update({ deleted_at: null })
      .eq("id", id);

    if (error) return false;

    await CacheService.del("products:list");
    await CacheService.del("products:list:all");
    await CacheService.del("products:list:trashed");
    if (existing?.slug) {
      await CacheService.del(`products:slug:${existing.slug}`);
    }
    await CacheService.delPattern("products:slug:*");

    return true;
  },

  // --- Orders ---
  async getOrders(userId?: string): Promise<Order[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      const list = await RegistryManager.getOrders();
      if (userId) {
        return list.filter((o) => o.customer === userId || o.customer.toLowerCase().includes(userId.toLowerCase()));
      }
      return list;
    }
    let query = supabase.from("orders").select("*");
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
      const list = await RegistryManager.getOrders();
      const order = list.find((o) => o.id === orderId);
      return order || null;
    }
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching order by id ${orderId}:`, error);
      return null;
    }
    return data ? mapDbOrderToOrder(data) : null;
  },

  async getOrderByAwb(awb: string): Promise<Order | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      const list = await RegistryManager.getOrders();
      return list.find((o) => o.shiprocketId === awb) || null;
    }
    const { data, error } = await supabase
      .from("orders")
      .select("*")
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
      if (typeof window === "undefined") {
        return {
          id: order.id || "ORD-" + Math.floor(Math.random() * 9000 + 1000),
          customer: order.customer || "Guest Customer",
          date: order.date || new Date().toLocaleDateString("en-IN"),
          total: order.total || 0,
          status: order.status || "Pending",
          items: order.items || [],
          originalTotal: order.originalTotal || 0,
          couponDiscount: order.couponDiscount || 0,
          couponCode: order.couponCode || "",
          walletPaid: order.walletPaid || 0,
          gatewayPaid: order.gatewayPaid || 0,
          pointsRedeemed: order.pointsRedeemed || 0,
          pointsDiscount: order.pointsDiscount || 0,
          pointsEarned: order.pointsEarned || 0,
        };
      }
      return RegistryManager.saveOrder(order);
    }

    const orderId = order.id || "ORD-" + Math.floor(Math.random() * 9000 + 1000);

    // Check if order exists
    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching order to save:", fetchError);
    }

    const isExisting = !!existingOrder;

    // Build DB payload with only defined fields (partial update/insert)
    const dbPayload: any = {};
    if (order.id !== undefined) dbPayload.id = orderId;
    if (order.customer !== undefined) dbPayload.customer = order.customer;
    if (order.date !== undefined) dbPayload.date = order.date;
    if (order.total !== undefined) dbPayload.total = order.total;
    if (order.status !== undefined) dbPayload.status = order.status;
    if (order.items !== undefined) dbPayload.items = order.items;
    if (order.originalTotal !== undefined) dbPayload.original_total = order.originalTotal;
    if (order.couponDiscount !== undefined) dbPayload.coupon_discount = order.couponDiscount;
    if (order.couponCode !== undefined) dbPayload.coupon_code = order.couponCode;
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
        coupon_code: order.couponCode || "",
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
    };

    return mergedOrder;
  },

  async getDashboardMetrics() {
    const { supabase, isSupabaseConfigured } = loadService();
    const cacheKey = "analytics:dashboard";
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    if (!isSupabaseConfigured || !supabase) {
      const res = await RegistryManager.getDashboardMetrics();
      await CacheService.set(cacheKey, res, 300);
      return res;
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
      const res = await RegistryManager.getCoupons();
      await CacheService.set(cacheKey, res, 86400); // 24 hours
      return res;
    }
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching coupons from Supabase:", error);
      return [];
    }
    const res = (data || []).map(mapDbCouponToCoupon);
    await CacheService.set(cacheKey, res, 86400); // 24 hours
    return res;
  },

  async saveCoupon(coupon: Partial<Coupon>): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    await CacheService.del("settings:coupons");
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.saveCoupon(coupon);
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.deleteCoupon(id);
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
    
    if (!isSupabaseConfigured || !supabase) return null;
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

  async saveSetting(key: string, value: any): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;
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
      return RegistryManager.validateCoupon(code, cartTotal, userId, cartItems);
    }
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
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
    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
      return { valid: false, error: "Coupon has expired." };
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
        .select("*", { count: "exact", head: true })
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
        } else {
          const mockProds = RegistryManager.getProducts();
          const p = mockProds.find(item => item.id === buyProductId);
          if (p?.title) buyProductName = p.title;
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
        } else {
          const mockProds = RegistryManager.getProducts();
          const p = mockProds.find(item => item.id === getProductId);
          if (p?.title) getProductName = p.title;
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
      return RegistryManager.incrementCouponUsage(code);
    }
    const { data, error } = await supabase.rpc("coupon_atomic_increment", {
      p_code: code.toUpperCase()
    });

    if (error) {
      console.error("Error executing atomic coupon increment:", error);
      return false;
    }
    return data === true;
  },

  async decrementCouponUsage(code: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.decrementCouponUsage(code);
    }
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (error || !data) {
      console.error("Error fetching coupon to decrement usage:", error);
      return false;
    }

    const currentUsage = data.usage_count !== undefined ? Number(data.usage_count) : (data.usageCount !== undefined ? Number(data.usageCount) : 0);
    const newUsage = Math.max(0, currentUsage - 1);

    const updatePayload: any = {};
    if (data.usage_count !== undefined) {
      updatePayload.usage_count = newUsage;
    }
    if (data.usageCount !== undefined) {
      updatePayload.usageCount = newUsage;
    }
    if (Object.keys(updatePayload).length === 0) {
      updatePayload.usage_count = newUsage;
    }

    const { error: updateErr } = await supabase
      .from("coupons")
      .update(updatePayload)
      .eq("code", code.toUpperCase());

    if (updateErr) {
      console.error("Error updating coupon usage count on Supabase:", updateErr);
      return false;
    }
    return true;
  },

  // --- Wallet ---
  async getWalletBalance(userId?: string): Promise<number> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getWalletBalance();
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
      return RegistryManager.getWalletTransactions();
    }
    const uid = userId;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching wallet transactions from Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getWalletData(userId?: string) {
    const balance = await this.getWalletBalance(userId);
    const transactions = await this.getWalletTransactions(userId);
    return { balance, transactions };
  },

  async applyWalletDebit(amount: number, orderId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyWalletDebit(amount, orderId);
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
      return RegistryManager.applyWalletCredit(amount, description, orderId);
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
      return RegistryManager.getLoyaltyPoints();
    }
    const uid = userId;
    if (!uid) return 0;

    const { data, error } = await supabase
      .from("profiles")
      .select("loyalty_points")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      console.error("Error fetching loyalty points from Supabase:", error);
      return 0;
    }
    return data ? Number(data.loyalty_points) : 0;
  },

  async getLoyaltyTransactions(userId?: string): Promise<LoyaltyTransaction[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getLoyaltyTransactions();
    }
    const uid = userId;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("loyalty_transactions")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching loyalty transactions from Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getLoyaltyData(userId?: string) {
    const points = await this.getLoyaltyPoints(userId);
    const transactions = await this.getLoyaltyTransactions(userId);
    return { points, transactions };
  },

  async applyLoyaltyDebit(points: number, orderId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyLoyaltyDebit(points, orderId);
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
      return RegistryManager.awardLoyaltyPoints(total, orderId);
    }
    const points = Math.floor(total / 10);
    if (points <= 0) return;

    const uid = userId;
    if (!uid) return;

    await supabase.rpc("loyalty_atomic_credit", {
      p_user_id: uid,
      p_points: points,
      p_idempotency_key: "EARNED-" + orderId,
      p_desc: `Earned on Order #${orderId}`
    });
  },

  async applyLoyaltyCredit(points: number, description: string, orderId: string, userId?: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyLoyaltyCredit(points, description, orderId);
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
      return RegistryManager.requestManualReturn(orderId, payload);
    }
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("*")
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
        refund_option: payload.refundOption,
        return_request_date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      })
      .eq("id", orderId);

    return !error;
  },

  async approveReturnPickup(orderId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.approveReturnPickup(orderId);
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
      return RegistryManager.processReturnRefund(orderId, qualityCheckPassed);
    }

    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;

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

    if (orderUpdateErr) return false;

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
      return RegistryManager.rejectReturn(orderId, rejectReason);
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
      return RegistryManager.cancelOrderAndRefund(orderId);
    }

    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;
    if (orderData.status === "Cancelled") return false;

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

    if (updateErr) return false;

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
    if (!isSupabaseConfigured || !supabase) return false;

    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*")
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
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.approvePendingOrder(orderId);
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "Paid" })
      .eq("id", orderId);

    return !error;
  },

  // --- Addresses ---
  async getUserAddresses(userId: string = "guest"): Promise<UserAddress[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getAddresses(userId);
    }
    const { data, error } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false });

    if (error) {
      console.error("Error fetching addresses from Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getAddressById(addressId: string, userId: string): Promise<UserAddress | null> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching address by id:", error);
      return null;
    }
    return data || null;
  },

  async saveUserAddress(address: Partial<UserAddress>): Promise<UserAddress> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      if (typeof window === "undefined") {
        return {
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
      }
      return RegistryManager.saveAddress(address);
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
      return RegistryManager.deleteAddress(id);
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
      return RegistryManager.setDefaultAddress(id, userId);
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
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from("user_cart")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching user cart from Supabase:", error);
      return [];
    }

    const items: CartItem[] = [];
    for (const row of data || []) {
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
    if (!isSupabaseConfigured || !supabase) return;

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
    if (!isSupabaseConfigured || !supabase) return;

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
    if (!isSupabaseConfigured || !supabase) return;

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
    if (!isSupabaseConfigured || !supabase) return;

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
      console.warn(`[logDeductionFailure] Supabase not configured. Skip db logging for ${productId} ${size}/${color}`);
      return;
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
    if (!isSupabaseConfigured || !supabase) return false;

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
    if (!isSupabaseConfigured || !supabase) return false;

    const { data: variants, error: fetchErr } = await supabase
      .from("product_variants")
      .select("id, color, stock")
      .eq("product_id", productId)
      .eq("size", size);

    if (fetchErr) return false;

    if (variants && variants.length > 0) {
      // Spread delta evenly across colors; for a single color this is exact
      for (const v of variants) {
        const newStock = Math.max(0, v.stock + delta);
        const { error } = await supabase
          .from("product_variants")
          .update({ stock: newStock })
          .eq("id", v.id);
        if (error) {
          console.error("adjustVariantStockBySize error:", error);
          return false;
        }
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

    await CacheService.del("products:list");
    await CacheService.del("products:list:all");
    await CacheService.delPattern("products:slug:*");
    return true;
  },

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getOrderStatusHistory(orderId);
    }
    const { data, error } = await supabase
      .from("order_status_history")
      .select("*")
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
      if (typeof window === "undefined") {
        return {
          id: "OSH-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
          order_id: orderId,
          status,
          updated_by: updatedBy || "system",
          metadata: metadata || {},
          created_at: new Date().toISOString()
        };
      }
      return RegistryManager.addOrderStatusHistory(orderId, status, updatedBy, metadata);
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
      const orders = await this.getOrders();
      const customerMap = new Map<string, any>();

      const defaultCustomers = [
        { name: "Aarav Sharma", email: "aarav.sharma@example.com", wallet_balance: 2500, loyalty_points: 500, ltv: 0, order_count: 0 },
        { name: "Ananya Patel", email: "ananya.patel@example.com", wallet_balance: 1800, loyalty_points: 320, ltv: 0, order_count: 0 },
        { name: "Kabir Mehta", email: "kabir.mehta@example.com", wallet_balance: 0, loyalty_points: 150, ltv: 0, order_count: 0 }
      ];

      for (const c of defaultCustomers) {
        customerMap.set(c.email, c);
      }

      for (const order of orders) {
        const email = `${order.customer.toLowerCase().replace(/\s+/g, ".")}@example.com`;
        const existing = customerMap.get(email);
        const orderTotal = order.status !== "Cancelled" && order.status !== "Expired" ? order.total : 0;
        const orderCount = 1;

        if (existing) {
          existing.ltv += orderTotal;
          existing.order_count += orderCount;
          if (order.customer.toLowerCase() === "guest customer" || order.customer.toLowerCase() === "guest") {
            existing.wallet_balance = await this.getWalletBalance();
            existing.loyalty_points = await this.getLoyaltyPoints();
          }
        } else {
          customerMap.set(email, {
            name: order.customer,
            email,
            wallet_balance: order.customer.toLowerCase() === "guest customer" || order.customer.toLowerCase() === "guest"
              ? await this.getWalletBalance()
              : Math.floor(Math.random() * 2000),
            loyalty_points: order.customer.toLowerCase() === "guest customer" || order.customer.toLowerCase() === "guest"
              ? await this.getLoyaltyPoints()
              : Math.floor(Math.random() * 400),
            ltv: orderTotal,
            order_count: orderCount,
          });
        }
      }

      return Array.from(customerMap.values());
    }

    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("*");

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

  async adjustCustomerBalance(email: string, type: "wallet" | "loyalty", amount: number, description: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      if (type === "wallet") {
        if (amount < 0) {
          await this.applyWalletDebit(Math.abs(amount), "ADMIN-ADJ", "ADMIN-ADJ");
        } else {
          await this.applyWalletCredit(amount, description, "ADMIN-ADJ");
        }
      } else {
        if (amount < 0) {
          await this.applyLoyaltyDebit(Math.abs(amount), "ADMIN-ADJ");
        } else {
          await this.applyLoyaltyCredit(amount, description, "ADMIN-ADJ");
        }
      }
      return true;
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
      if (typeof window === "undefined") return null;
      return RegistryManager.getShipmentByOrderId(orderId);
    }
    const { data, error } = await supabase
      .from("shipments")
      .select("*")
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
      if (typeof window === "undefined") return [];
      return RegistryManager.getShipmentEvents(shipmentId);
    }
    const { data, error } = await supabase
      .from("shipment_events")
      .select("*")
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
      if (typeof window === "undefined") {
        return {
          id: shipment.id || "SHIP-" + Date.now(),
          order_id: shipment.order_id || "",
          shiprocket_order_id: shipment.shiprocket_order_id || "",
          shipment_id: shipment.shipment_id || "",
          awb_code: shipment.awb_code || "",
          courier_name: shipment.courier_name || "",
          status: shipment.status || "Order Placed",
          etd: shipment.etd || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          weight: shipment.weight || 0.4,
          dimensions_length: shipment.dimensions_length || 30,
          dimensions_width: shipment.dimensions_width || 22,
          dimensions_height: shipment.dimensions_height || 5,
          created_at: shipment.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return RegistryManager.saveShipment(shipment);
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
      if (typeof window === "undefined") {
        return {
          id: event.id || "EVT-" + Date.now(),
          shipment_id: event.shipment_id || "",
          status: event.status || "",
          activity: event.activity || "",
          location: event.location || "",
          timestamp: event.timestamp || new Date().toISOString()
        };
      }
      return RegistryManager.saveShipmentEvent(event);
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
      if (typeof window === "undefined") return;
      return RegistryManager.saveTrackingLog(log);
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
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return `TEMP-${Date.now()}`;
    }
    const { data, error } = await supabase.rpc("get_next_order_number");
    if (error) {
      console.error("Error getting next order number from DB:", error);
      return `TEMP-${Date.now()}`;
    }
    return data;
  },

  async createPaymentAuditLog(orderId: string, previousStatus: string | null, newStatus: string, source: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      console.log(`[Offline Payment Audit Log] Order: ${orderId}, ${previousStatus} -> ${newStatus} via ${source}`);
      return;
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
      console.log(`[Offline Order Event] Order: ${orderId}, Event: ${event}`);
      if (typeof window !== "undefined") {
        try {
          const events = JSON.parse(localStorage.getItem(`order_events:${orderId}`) || "[]");
          events.push({ event, created_at: new Date().toISOString() });
          localStorage.setItem(`order_events:${orderId}`, JSON.stringify(events));
        } catch (e) {
          console.error("Error writing local storage order events", e);
        }
      }
      return;
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
      if (typeof window !== "undefined") {
        try {
          dbEvents = JSON.parse(localStorage.getItem(`order_events:${orderId}`) || "[]");
        } catch (e) {
          dbEvents = [];
        }
        dbHistory = RegistryManager.getOrderStatusHistory(orderId);
      }
    } else {
      const [eventsRes, historyRes] = await Promise.all([
        supabase
          .from("order_events")
          .select("*")
          .eq("order_id", orderId),
        supabase
          .from("order_status_history")
          .select("*")
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
      const quantity = order.items.length || 1;
      const orderItems = order.items.map((itemStr: any, idx: number) => {
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

      // Update order status with shiprocketId
      const updatedOrder = { ...order, shiprocketId: result.awbCode || "" };
      await this.saveOrder(updatedOrder);

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
    if (!isSupabaseConfigured || !supabase) return false;
    const { error } = await supabase.from("reviews").insert([review]);
    return !error;
  },

  async getReviews(filter?: { approved?: boolean }) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return [];
    let q = supabase.from("reviews").select("*").order("created_at", { ascending: false });
    if (filter && typeof filter.approved === "boolean") {
      q = q.eq("approved", filter.approved);
    }
    const { data } = await q;
    return data || [];
  },

  async updateReviewStatus(id: string, approved: boolean) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;
    const { error } = await supabase.from("reviews").update({ approved }).eq("id", id);
    return !error;
  },

  async deleteReview(id: string) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    return !error;
  },

  async updateReview(id: string, review: { comment: string }) {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) return false;
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

        if (["confirmed", "processing", "packed"].includes(status)) {
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
          .select("*", { count: "exact", head: true })
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

      return {
        aov,
        pendingShipments: pendingCount,
        refundRequests: refundCount,
        customerGrowth,
      };
    } catch (e) {
      console.error("Error in getDashboardKPIMetrics:", e);
      return {
        aov: 0,
        pendingShipments: 0,
        refundRequests: 0,
        customerGrowth: 0,
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
};

