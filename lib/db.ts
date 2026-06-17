import { supabase, isSupabaseConfigured } from "./supabase";
import { RegistryManager, Product, Order, Coupon, WalletTransaction, LoyaltyTransaction, UserAddress, OrderStatusHistory } from "./registry";
import { InventoryService } from "./services/inventory";

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
  };
};

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
    expiryDate: c.expiry_date || c.expiryDate,
    minCartValue: c.min_cart_value !== undefined ? Number(c.min_cart_value) : (c.minCartValue !== undefined ? Number(c.minCartValue) : undefined),
    maxUsage: c.max_usage !== undefined ? Number(c.max_usage) : (c.maxUsage !== undefined ? Number(c.maxUsage) : undefined),
    usageCount: c.usage_count !== undefined ? Number(c.usage_count) : (c.usageCount !== undefined ? Number(c.usageCount) : undefined),
  };
};

export const db = {
  // --- Products ---
  async getProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getProducts();
    }
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products from Supabase:", error);
      return [];
    }
    return (data || []).map(mapDbProductToProduct);
  },

  async saveProduct(product: Partial<Product>): Promise<void> {
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
      reviews: product.reviews || [],
    };

    const { error } = await supabase.from("products").upsert(dbPayload);
    if (error) {
      console.error("Error saving product to Supabase:", error);
      throw error;
    }
  },

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getProductBySlug(slug);
    }
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Error fetching product by slug from Supabase:", error);
      return undefined;
    }
    return data ? mapDbProductToProduct(data) : undefined;
  },

  async relatedProducts(slug: string): Promise<Product[]> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.relatedProducts(slug);
    }
    const current = await this.getProductBySlug(slug);
    if (!current) return [];

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .neq("slug", slug)
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.deleteProduct(id);
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Error deleting product from Supabase:", error);
      throw error;
    }
  },

  // --- Orders ---
  async getOrders(): Promise<Order[]> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getOrders();
    }
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders from Supabase:", error);
      return [];
    }
    return (data || []).map(mapDbOrderToOrder);
  },

  async saveOrder(order: Partial<Order>): Promise<Order> {
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
    const newOrder: Order = {
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
      returnReason: order.returnReason,
      returnDetails: order.returnDetails,
      returnImage: order.returnImage,
      refundOption: order.refundOption,
      returnRequestDate: order.returnRequestDate,
      returnDate: order.returnDate,
      returnRejectReason: order.returnRejectReason,
      qualityCheckPassed: order.qualityCheckPassed,
      shiprocketId: order.shiprocketId,
    };

    const dbPayload = {
      id: newOrder.id,
      customer: newOrder.customer,
      date: newOrder.date,
      total: newOrder.total,
      status: newOrder.status,
      items: newOrder.items,
      original_total: newOrder.originalTotal,
      coupon_discount: newOrder.couponDiscount,
      coupon_code: newOrder.couponCode,
      wallet_paid: newOrder.walletPaid,
      gateway_paid: newOrder.gatewayPaid,
      points_redeemed: newOrder.pointsRedeemed,
      points_discount: newOrder.pointsDiscount,
      points_earned: newOrder.pointsEarned,
      return_reason: newOrder.returnReason,
      return_details: newOrder.returnDetails,
      return_image: newOrder.returnImage,
      refund_option: newOrder.refundOption,
      return_request_date: newOrder.returnRequestDate,
      return_date: newOrder.returnDate,
      return_reject_reason: newOrder.returnRejectReason,
      quality_check_passed: newOrder.qualityCheckPassed,
      shiprocket_id: newOrder.shiprocketId,
    };

    const { error } = await supabase.from("orders").upsert(dbPayload);
    if (error) {
      console.error("Error saving order to Supabase:", error);
      throw error;
    }
    return newOrder;
  },

  async getDashboardMetrics() {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getDashboardMetrics();
    }
    const orders = await this.getOrders();
    const activeOrders = orders.filter((o) => o.status !== "Returned");
    const products = await this.getProducts();
    const revenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const cashRevenue = activeOrders.reduce((sum, o) => sum + (o.gatewayPaid || 0), 0);
    const creditRevenue = activeOrders.reduce((sum, o) => sum + (o.walletPaid || 0), 0);
    const walletLiability = await this.getWalletBalance();
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return {
      totalOrders: activeOrders.length,
      totalRevenue: revenue,
      cashRevenue: cashRevenue,
      creditRevenue: creditRevenue,
      inventoryCount: products.length,
      totalStock: totalStock,
      walletLiability: walletLiability,
      conversion: "4.2%",
    };
  },


  // --- Coupons ---
  async getCoupons(): Promise<Coupon[]> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getCoupons();
    }
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching coupons from Supabase:", error);
      return [];
    }
    return (data || []).map(mapDbCouponToCoupon);
  },

  async saveCoupon(coupon: Partial<Coupon>): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.saveCoupon(coupon);
    }
    const dbPayload = {
      id: coupon.id || "CPN-" + Date.now(),
      code: (coupon.code || "CODE").toUpperCase(),
      discount: coupon.discount || 10,
      type: coupon.type || "percent",
      active: coupon.active !== undefined ? coupon.active : true,
      expiry_date: coupon.expiryDate,
      expiryDate: coupon.expiryDate,
      min_cart_value: coupon.minCartValue,
      minCartValue: coupon.minCartValue,
      max_usage: coupon.maxUsage,
      maxUsage: coupon.maxUsage,
      usage_count: coupon.usageCount,
      usageCount: coupon.usageCount,
    };

    const { error } = await supabase.from("coupons").upsert(dbPayload);
    if (error) {
      console.error("Error saving coupon to Supabase:", error);
      throw error;
    }
  },

  async deleteCoupon(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.deleteCoupon(id);
    }
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      console.error("Error deleting coupon from Supabase:", error);
      throw error;
    }
  },

  async validateCoupon(code: string, cartTotal: number): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.validateCoupon(code, cartTotal);
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
    if (coupon.minCartValue !== undefined && cartTotal < coupon.minCartValue) {
      return { valid: false, error: `Minimum cart value of ₹${coupon.minCartValue} required.` };
    }
    if (coupon.maxUsage !== undefined && coupon.usageCount !== undefined && coupon.usageCount >= coupon.maxUsage) {
      return { valid: false, error: "Coupon usage limit has been reached." };
    }

    return { valid: true, coupon };
  },

  async incrementCouponUsage(code: string): Promise<boolean> {
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getWalletBalance();
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getWalletTransactions();
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyWalletDebit(amount, orderId);
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyWalletCredit(amount, description, orderId);
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid) return;

    await supabase.rpc("wallet_atomic_credit", {
      p_user_id: uid,
      p_amount: amount,
      p_idempotency_key: "CREDIT-" + orderId + "-" + Date.now(),
      p_desc: description || `Refund for Order #${orderId}`
    });
  },

  // --- Loyalty ---
  async getLoyaltyPoints(userId?: string): Promise<number> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getLoyaltyPoints();
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.getLoyaltyTransactions();
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyLoyaltyDebit(points, orderId);
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.awardLoyaltyPoints(total, orderId);
    }
    const points = Math.floor(total / 10);
    if (points <= 0) return;

    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid) return;

    await supabase.rpc("loyalty_atomic_credit", {
      p_user_id: uid,
      p_points: points,
      p_idempotency_key: "EARNED-" + orderId,
      p_desc: `Earned on Order #${orderId}`
    });
  },

  async applyLoyaltyCredit(points: number, description: string, orderId: string, userId?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.applyLoyaltyCredit(points, description, orderId);
    }
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid) return;

    await supabase.rpc("loyalty_atomic_credit", {
      p_user_id: uid,
      p_points: points,
      p_idempotency_key: "CREDIT-" + orderId + "-" + Date.now(),
      p_desc: description || `Refund for Order #${orderId}`
    });
  },

  // --- Returns & Refunds Logistics ---
  async requestManualReturn(
    orderId: string,
    payload: { reason: string; details: string; image: string; refundOption: string }
  ): Promise<boolean> {
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.approveReturnPickup(orderId);
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "Return in Transit" })
      .eq("id", orderId);

    return !error;
  },

  async processReturnRefund(orderId: string, qualityCheckPassed = true): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.processReturnRefund(orderId, qualityCheckPassed);
    }
    
    // Fetch the order details
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;

    // 1. Update order status
    const returnDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const { error: orderUpdateErr } = await supabase
      .from("orders")
      .update({
        status: "Returned",
        return_date: returnDate,
        quality_check_passed: qualityCheckPassed
      })
      .eq("id", orderId);

    if (orderUpdateErr) return false;

    // 2. If QC Passed, restock product sizes back into inventory
    if (qualityCheckPassed && orderData.items && Array.isArray(orderData.items)) {
      const products = await this.getProducts();
      for (const itemName of orderData.items) {
        const product = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase());
        if (product) {
          // Increment stock counts
          const newStock = (product.stock || 0) + 1;
          // We can also increment the size details if we know it, or just overall stock
          await supabase
            .from("products")
            .update({ stock: newStock })
            .eq("id", product.id);
        }
      }
    }

    // 3. Process wallet refund logic
    const totalAmount = Number(orderData.total);
    const walletPaid = Number(orderData.wallet_paid || 0);
    const gatewayPaid = Number(orderData.gateway_paid || 0);

    if (orderData.refund_option === "wallet") {
      const refundAmount = gatewayPaid + walletPaid;
      await this.applyWalletCredit(refundAmount, `Manual Return Credit for Order #${orderId}`, orderId);
    } else {
      if (walletPaid > 0) {
        await this.applyWalletCredit(walletPaid, `Refund of Wallet Portion for Order #${orderId}`, orderId);
      }
      const bankRefund = gatewayPaid > 0 ? gatewayPaid : totalAmount - walletPaid;
      console.log(`[Refund simulation] Refunded ₹${bankRefund} to bank account for Order #${orderId}`);
    }

    // 4. Revoke earned loyalty points
    const pointsEarned = Number(orderData.points_earned || 0);
    if (pointsEarned > 0) {
      const balance = await this.getLoyaltyPoints();
      const newBalance = Math.max(0, balance - pointsEarned);
      await supabase.from("account_balances").upsert({ key: "loyalty_points", value: newBalance });
      await supabase.from("loyalty_transactions").insert({
        id: "LTX-" + Date.now(),
        date: returnDate,
        points: pointsEarned,
        type: "debit",
        description: `Revoked for Returned Order #${orderId}`,
      });
    }

    // 5. Restore redeemed loyalty points
    const pointsRedeemed = Number(orderData.points_redeemed || 0);
    if (pointsRedeemed > 0) {
      const balance = await this.getLoyaltyPoints();
      const newBalance = balance + pointsRedeemed;
      await supabase.from("account_balances").upsert({ key: "loyalty_points", value: newBalance });
      await supabase.from("loyalty_transactions").insert({
        id: "LTX-" + (Date.now() + 1),
        date: returnDate,
        points: pointsRedeemed,
        type: "credit",
        description: `Restored for Returned Order #${orderId}`,
      });
    }

    return true;
  },

  async rejectReturn(orderId: string, rejectReason: string): Promise<boolean> {
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

  async cancelOrderAndRefund(orderId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.cancelOrderAndRefund(orderId);
    }
    
    // Fetch order
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !orderData) return false;
    if (orderData.status === "Cancelled") return false;

    // 1. Update status
    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: "Cancelled" })
      .eq("id", orderId);

    if (updateErr) return false;

    // 2. Restock items back into inventory
    if (orderData.items && Array.isArray(orderData.items)) {
      const products = await this.getProducts();
      for (const itemName of orderData.items) {
        const product = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase());
        if (product) {
          const newStock = (product.stock || 0) + 1;
          await supabase
            .from("products")
            .update({ stock: newStock })
            .eq("id", product.id);
        }
      }
    }

    // 3. Process refund: wallet balance & bank refund
    const walletPaid = Number(orderData.wallet_paid || 0);
    const gatewayPaid = Number(orderData.gateway_paid || 0);

    if (walletPaid > 0) {
      await this.applyWalletCredit(walletPaid, `Refund of Wallet Portion for Cancelled Order #${orderId}`, orderId);
    }
    if (gatewayPaid > 0) {
      console.log(`[Refund simulation] Refunded ₹${gatewayPaid} to bank account for Cancelled Order #${orderId}`);
    }

    // 4. Revoke earned loyalty points
    const pointsEarned = Number(orderData.points_earned || 0);
    if (pointsEarned > 0) {
      const balance = await this.getLoyaltyPoints();
      const newBalance = Math.max(0, balance - pointsEarned);
      await supabase.from("account_balances").upsert({ key: "loyalty_points", value: newBalance });
      await supabase.from("loyalty_transactions").insert({
        id: "LTX-" + Date.now(),
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        points: pointsEarned,
        type: "debit",
        description: `Revoked for Cancelled Order #${orderId}`,
      });
    }

    // 5. Restore redeemed loyalty points
    const pointsRedeemed = Number(orderData.points_redeemed || 0);
    if (pointsRedeemed > 0) {
      const balance = await this.getLoyaltyPoints();
      const newBalance = balance + pointsRedeemed;
      await supabase.from("account_balances").upsert({ key: "loyalty_points", value: newBalance });
      await supabase.from("loyalty_transactions").insert({
        id: "LTX-" + (Date.now() + 1),
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        points: pointsRedeemed,
        type: "credit",
        description: `Restored for Cancelled Order #${orderId}`,
      });
    }

    return true;
  },

  async approvePendingOrder(orderId: string): Promise<boolean> {
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

  async saveUserAddress(address: Partial<UserAddress>): Promise<UserAddress> {
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
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.deleteAddress(id);
    }
    
    // fetch before delete to check if default
    const { data: toDelete } = await supabase.from("user_addresses").select("is_default").eq("id", id).maybeSingle();

    const { error } = await supabase.from("user_addresses").delete().eq("id", id);
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
      .eq("id", id);
  },

  async verifyStock(items: any[], sessionId?: string): Promise<{ success: boolean; message?: string }> {
    // Format cart items for validation
    const formatted = items.map((item) => ({
      productName: item.productName,
      size: item.size || "M",
      color: item.color || "Atelier Choice",
      quantity: item.quantity || 1,
    }));
    const result = await InventoryService.validateStock(formatted);
    if (!result.success) {
      return { success: false, message: result.errors.join(" | ") };
    }

    if (isSupabaseConfigured && supabase && sessionId) {
      // Perform atomic reservations for all items
      const products = await this.getProducts();
      for (const item of formatted) {
        const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
        if (product) {
          const { data, error } = await supabase.rpc("reserve_variant_inventory_atomic", {
            p_product_id: product.id,
            p_size: item.size,
            p_color: item.color,
            p_quantity: item.quantity,
            p_expires_mins: 15,
            p_session: sessionId,
          });
          if (error || (data && !data.success)) {
            // Rollback any reservations already made for this session
            await supabase.from("inventory_reservations").delete().eq("session_id", sessionId);
            return { success: false, message: data?.error || `Failed to reserve stock for ${item.productName}` };
          }
        }
      }
    }

    return { success: true };
  },

  async deductStock(items: any[], sessionId?: string): Promise<void> {
    const products = await this.getProducts();
    for (const item of items) {
      const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
      if (product) {
        const size = (item.size || "M") as "S" | "M" | "L" | "XL" | "XXL";
        const color = item.color || "Atelier Choice";
        const qty = item.quantity || 1;
        await InventoryService.deductStockAtomic(product.id, size, color, qty);
      }
    }
    if (isSupabaseConfigured && supabase && sessionId) {
      await supabase.from("inventory_reservations").update({ status: 'fulfilled' }).eq("session_id", sessionId);
    }
  },

  async restoreStock(items: any[], sessionId?: string): Promise<void> {
    const products = await this.getProducts();
    for (const item of items) {
      const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
      if (product) {
        const size = (item.size || "M") as "S" | "M" | "L" | "XL" | "XXL";
        const color = item.color || "Atelier Choice";
        const qty = item.quantity || 1;
        await InventoryService.restoreStockAtomic(product.id, size, color, qty);
      }
    }
    if (isSupabaseConfigured && supabase && sessionId) {
      await supabase.from("inventory_reservations").update({ status: 'cancelled' }).eq("session_id", sessionId);
    }
  },

  async resetPrototype(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return RegistryManager.resetPrototype();
    }
    // Truncate tables for database reset
    await supabase.from("orders").delete().neq("id", "");
    await supabase.from("wallet_transactions").delete().neq("id", "");
    await supabase.from("loyalty_transactions").delete().neq("id", "");
    await supabase.from("order_status_history").delete().neq("id", "");
    await supabase.from("account_balances").upsert({ key: "wallet_balance", value: 2500 });
    await supabase.from("account_balances").upsert({ key: "loyalty_points", value: 2000 });
    console.log("[Supabase DB Reset Completed]");
  },

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
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
      id: "OSH-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
      order_id: orderId,
      status,
      updated_by: updatedBy || "system",
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from("order_status_history").insert(entry);
    if (error) {
      console.error("Error inserting order status history:", error);
      throw error;
    }
    return {
      id: entry.id,
      order_id: entry.order_id,
      status: entry.status,
      updated_by: entry.updated_by,
      metadata: entry.metadata,
      created_at: entry.created_at
    };
  },

  async getCustomers(): Promise<any[]> {
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
        wallet_balance: Number(p.wallet_balance || 0),
        loyalty_points: Number(p.loyalty_points || 0),
        ltv,
        order_count: userOrders.length,
        id: p.id
      };
    });
  },

  async adjustCustomerBalance(email: string, type: "wallet" | "loyalty", amount: number, description: string): Promise<boolean> {
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
};
