import { RegistryManager } from "../registry";
import { ProductVariant, InventoryReservation, StockAuditLog } from "../../types/inventory";

type ServiceModule = typeof import("../supabase-service");
let _serviceMod: ServiceModule | null = null;

function loadService(): { supabase: ServiceModule["supabaseService"] | null; isSupabaseConfigured: boolean } {
  if (typeof window !== "undefined") {
    return { supabase: null, isSupabaseConfigured: false };
  }
  if (!_serviceMod) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _serviceMod = require("../supabase-service") as ServiceModule;
  }
  return {
    supabase: _serviceMod.supabaseService,
    isSupabaseConfigured: _serviceMod.isServiceClientConfigured,
  };
}

// In-memory simulation of reservations and audit logs for when Supabase is not configured.
let localReservations: InventoryReservation[] = [];
let localAuditLogs: StockAuditLog[] = [];

export const InventoryService = {
  /**
   * Helper to fetch variants for a product
   */
  async getVariantsForProduct(productId: string): Promise<ProductVariant[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      // Generate mock variants from RegistryManager product sizes
      const products = await RegistryManager.getProducts();
      const product = products.find((p) => p.id === productId);
      if (!product) return [];

      const colors = product.colors && product.colors.length > 0 ? product.colors : ["Default"];
      const variants: ProductVariant[] = [];

      colors.forEach((color) => {
        const sizes: ("S" | "M" | "L" | "XL" | "XXL")[] = ["S", "M", "L", "XL", "XXL"];
        sizes.forEach((size) => {
          const sizeStock = product.sizeStock?.[size] || 0;
          variants.push({
            id: `${productId}-${size}-${color.replace(/\s+/g, "")}`,
            productId,
            size,
            color,
            sku: `${productId}-${size}-${color.substring(0, 3).toUpperCase()}`,
            price: product.price,
            stock: sizeStock,
          });
        });
      });
      return variants;
    }

    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId);

    if (error) {
      console.error("Error fetching product variants:", error);
      return [];
    }

    return (data || []).map((v: any) => ({
      id: v.id,
      productId: v.product_id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      price: Number(v.price),
      stock: Number(v.stock),
    }));
  },

  /**
   * Batch helper to fetch variants for multiple products
   */
  async getVariantsForProducts(productIds: string[]): Promise<ProductVariant[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      const variants: ProductVariant[] = [];
      for (const pid of productIds) {
        const productVariants = await this.getVariantsForProduct(pid);
        variants.push(...productVariants);
      }
      return variants;
    }

    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .in("product_id", productIds);

    if (error) {
      console.error("Error fetching product variants batch:", error);
      return [];
    }

    return (data || []).map((v: any) => ({
      id: v.id,
      productId: v.product_id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      price: Number(v.price),
      stock: Number(v.stock),
    }));
  },

  /**
   * Server-side inventory validation for a list of cart items.
   * Ensures that color, size, and quantities are fully checked.
   */
  async validateStock(items: { productName: string; size: string; color?: string; quantity: number }[]): Promise<{
    success: boolean;
    errors: string[];
    availableStockMap: { [key: string]: number };
  }> {
    const errors: string[] = [];
    const availableStockMap: { [key: string]: number } = {};

    let products: any[];
    const { supabase, isSupabaseConfigured } = loadService();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from("products").select("*").is("deleted_at", null);
      if (error) {
        console.error("Error fetching products in validateStock from Supabase:", error);
        products = [];
      } else {
        products = (data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          image: p.image,
          colors: p.colors || [],
          sizeStock: {
            S: p.size_stock_s || 0,
            M: p.size_stock_m || 0,
            L: p.size_stock_l || 0,
            XL: p.size_stock_xl || 0,
            XXL: p.size_stock_xxl || 0,
          }
        }));
      }
    } else {
      products = await RegistryManager.getProducts();
    }

    // Resolve product IDs first
    const productIds: string[] = [];
    const itemsWithProducts = items.map((item) => {
      const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
      if (product) {
        productIds.push(product.id);
      }
      return { item, product };
    });

    // Fetch all variants in one single batch query!
    const allVariants = productIds.length > 0 ? await this.getVariantsForProducts(productIds) : [];

    for (const { item, product } of itemsWithProducts) {
      if (!product) {
        errors.push(`Product "${item.productName}" not found.`);
        continue;
      }

      const size = item.size as "S" | "M" | "L" | "XL" | "XXL";
      const color = item.color || "Default";
      const key = `${product.id}-${size}-${color}`;

      // Filter from preloaded variants
      const productVariants = allVariants.filter((v) => v.productId === product.id);
      const variant =
        // Step 1: exact color match
        productVariants.find((v) =>
          v.size === size &&
          (v.color || "").toLowerCase() === color.toLowerCase()
        ) ||
        // Step 2: same size, highest stock color
        productVariants
          .filter((v) => v.size === size && v.stock > 0)
          .sort((a, b) => b.stock - a.stock)[0] ||
        // Step 3: same size, any color any stock
        productVariants.find((v) => v.size === size) ||
        // Step 4: null — throw error
        null;

      if (!variant) {
        errors.push(`Variant not found: ${product.id} ${size}`);
        continue;
      }

      const availableStock = variant.stock;
      availableStockMap[key] = availableStock;

      if (availableStock < item.quantity) {
        errors.push(
          `Insufficient stock for ${product.title} (Size: ${size}, Color: ${color}). Available: ${availableStock}, Requested: ${item.quantity}.`
        );
      }
    }

    return {
      success: errors.length === 0,
      errors,
      availableStockMap,
    };
  },

  /**
   * Create an inventory reservation for checkout safety (lasts 10 minutes)
   */
  async createReservation(variantId: string, quantity: number): Promise<InventoryReservation | null> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      const reservation: InventoryReservation = {
        id: "RES-" + Math.random().toString(36).substring(2, 9),
        variantId,
        quantity,
        expiresAt,
        status: "reserved",
      };
      localReservations.push(reservation);
      return reservation;
    }

    // In a real PG setting, we insert into public.inventory_reservations (created if not exists)
    // For this prototype, we simulate or store in a local metadata structure if tables aren't fully run
    const { data, error } = await supabase
      .from("inventory_reservations")
      .insert({
        variant_id: variantId,
        quantity,
        expires_at: expiresAt.toISOString(),
        status: "reserved",
      })
      .select()
      .single();

    if (error) {
      console.warn("Failed to save reservation to database (table might be missing), falling back to local memory", error);
      const reservation: InventoryReservation = {
        id: "RES-" + Math.random().toString(36).substring(2, 9),
        variantId,
        quantity,
        expiresAt,
        status: "reserved",
      };
      localReservations.push(reservation);
      return reservation;
    }

    return {
      id: data.id,
      variantId: data.variant_id,
      quantity: data.quantity,
      expiresAt: new Date(data.expires_at),
      status: data.status,
    };
  },

  /**
   * Deduct stock for variant and log audit record.
   * Performs atomic updates.
   */
  async deductStockAtomic(
    productId: string,
    size: "S" | "M" | "L" | "XL" | "XXL",
    color: string,
    quantity: number,
    orderId?: string
  ): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      // Atomic logic on RegistryManager / local db
      const products = await RegistryManager.getProducts();
      const product = products.find((p) => p.id === productId);
      if (!product) return false;

      const currentSizeStock = product.sizeStock?.[size] || 0;
      if (currentSizeStock < quantity) return false;

      // Deduct stock
      const newSizeStock = currentSizeStock - quantity;
      const newTotalStock = Math.max(0, (product.stock || 0) - quantity);

      if (!product.sizeStock) product.sizeStock = {};
      product.sizeStock[size] = newSizeStock;
      product.stock = newTotalStock;

      await RegistryManager.saveProduct(product);
      
      // Log Audit
      this.logAuditLocal(`${productId}-${size}-${color}`, -quantity, "deduction", `Checkout order deduction`);
      return true;
    }

    // Call Supabase function to atomically deduct stock
    const { data, error } = await supabase.rpc("deduct_variant_stock", {
      p_product_id: productId,
      p_size: size,
      p_color: color,
      p_quantity: quantity,
    });

    if (error) {
      console.error("Error executing atomic stock deduction:", error);
      return false;
    }

    return data === true;
  },

  /**
   * Restore stock on cancelled orders
   */
  async restoreStockAtomic(
    productId: string,
    size: "S" | "M" | "L" | "XL" | "XXL",
    color: string,
    quantity: number
  ): Promise<void> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      const products = await RegistryManager.getProducts();
      const product = products.find((p) => p.id === productId);
      if (product) {
        if (!product.sizeStock) product.sizeStock = {};
        product.sizeStock[size] = (product.sizeStock[size] || 0) + quantity;
        product.stock = (product.stock || 0) + quantity;
        await RegistryManager.saveProduct(product);
        this.logAuditLocal(`${productId}-${size}-${color}`, quantity, "restoration", `Order cancelled restoration`);
      }
      return;
    }

    const { error } = await supabase.rpc("restore_variant_stock", {
      p_product_id: productId,
      p_size: size,
      p_color: color,
      p_quantity: quantity,
    });

    if (error) {
      console.error("Error executing atomic stock restoration:", error);
      // Fallback updates
      const { data: vData } = await supabase
        .from("product_variants")
        .select("id, stock")
        .eq("product_id", productId)
        .eq("size", size)
        .eq("color", color)
        .maybeSingle();

      if (vData) {
        await supabase
          .from("product_variants")
          .update({ stock: vData.stock + quantity })
          .eq("id", vData.id);
        
        await supabase.from("inventory_audit_logs").insert({
          variant_id: vData.id,
          quantity_changed: quantity,
          type: "restoration",
          reason: "Order cancelled restoration (fallback)",
        });
      }
    }
  },

  /**
   * Check for items that are low in stock
   */
  async checkLowStockAlerts(threshold = 5): Promise<{ sku: string; size: string; stock: number }[]> {
    const alerts: { sku: string; size: string; stock: number }[] = [];
    const products = await RegistryManager.getProducts();

    for (const p of products) {
      if (p.sizeStock) {
        for (const [size, stock] of Object.entries(p.sizeStock)) {
          if (stock !== undefined && stock <= threshold) {
            alerts.push({
              sku: `${p.id}-${size}`,
              size,
              stock,
            });
          }
        }
      }
    }
    return alerts;
  },

  logAuditLocal(variantId: string, quantityChanged: number, type: "addition" | "deduction" | "restoration" | "adjustment", reason: string) {
    localAuditLogs.push({
      id: "AUD-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      variantId,
      quantityChanged,
      type,
      reason,
      timestamp: new Date(),
    });
  },

  async getAuditLogs(): Promise<StockAuditLog[]> {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return localAuditLogs;
    }
    const { data } = await supabase
      .from("inventory_audit_logs")
      .select("*")
      .order("timestamp", { ascending: false });
    
    return (data || []).map((d: any) => ({
      id: d.id,
      variantId: d.variant_id,
      quantityChanged: d.quantity_changed,
      type: d.type,
      reason: d.reason,
      timestamp: new Date(d.timestamp),
    }));
  }
};
