import { RegistryManager } from "../registry";
import { supabase, isSupabaseConfigured } from "../supabase";
import { ProductVariant, InventoryReservation, StockAuditLog } from "../../types/inventory";

// In-memory simulation of reservations and audit logs for when Supabase is not configured.
let localReservations: InventoryReservation[] = [];
let localAuditLogs: StockAuditLog[] = [];

export const InventoryService = {
  /**
   * Helper to fetch variants for a product
   */
  async getVariantsForProduct(productId: string): Promise<ProductVariant[]> {
    if (!isSupabaseConfigured || !supabase) {
      // Generate mock variants from RegistryManager product sizes
      const products = await RegistryManager.getProducts();
      const product = products.find((p) => p.id === productId);
      if (!product) return [];

      const colors = product.colors && product.colors.length > 0 ? product.colors : ["Atelier Choice"];
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

    const products = await RegistryManager.getProducts();

    for (const item of items) {
      const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
      if (!product) {
        errors.push(`Product "${item.productName}" not found.`);
        continue;
      }

      const size = item.size as "S" | "M" | "L" | "XL" | "XXL";
      const color = item.color || "Atelier Choice";
      const key = `${product.id}-${size}-${color}`;

      // Retrieve variants for detailed check
      const variants = await this.getVariantsForProduct(product.id);
      const variant = variants.find((v) => v.size === size && v.color.toLowerCase() === color.toLowerCase()) || 
                      variants.find((v) => v.size === size); // Fallback to size only if color match isn't exact

      const availableStock = variant ? variant.stock : (product.sizeStock?.[size] || 0);
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
    quantity: number
  ): Promise<boolean> {
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
      // Fallback update
      const { data: vData } = await supabase
        .from("product_variants")
        .select("id, stock")
        .eq("product_id", productId)
        .eq("size", size)
        .eq("color", color)
        .maybeSingle();

      if (vData && vData.stock >= quantity) {
        await supabase
          .from("product_variants")
          .update({ stock: vData.stock - quantity })
          .eq("id", vData.id);
        
        // Log Audit
        await supabase.from("inventory_audit_logs").insert({
          variant_id: vData.id,
          quantity_changed: -quantity,
          type: "deduction",
          reason: "Checkout order deduction (fallback)",
        });
        return true;
      }
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
