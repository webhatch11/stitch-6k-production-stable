export interface ProductVariant {
  id: string;
  productId: string;
  size: "S" | "M" | "L" | "XL" | "XXL";
  color: string;
  sku: string;
  price: number;
  stock: number;
}

export interface InventoryReservation {
  id: string;
  variantId: string;
  quantity: number;
  expiresAt: Date;
  status: "reserved" | "completed" | "expired";
}

export interface StockAuditLog {
  id: string;
  variantId: string;
  quantityChanged: number;
  type: "addition" | "deduction" | "restoration" | "adjustment";
  reason: string;
  timestamp: Date;
}
