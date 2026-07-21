export interface ProductVariant {
  id?: string;
  productId?: string;
  size: string;
  color: string;
  sku: string;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  slug?: string;
  title: string;
  price: number;
  comparePrice?: number;
  category: string;
  image: string;
  images?: string[];
  isNew: boolean;
  stock?: number;
  description?: string;
  details?: {
    fabric?: string;
    fit?: string;
    collar?: string;
    sleeve?: string;
    care?: string;
  };
  isAtelierExclusive?: boolean;
  sizeStock?: {
    S?: number;
    M?: number;
    L?: number;
    XL?: number;
    XXL?: number;
  };
  basePrice?: number;
  gstRate?: number;
  discountRate?: number;
  specFabric?: string;
  specFit?: string;
  specCollar?: string;
  specSleeve?: string;
  specCare?: string;
  customBadge?: string;
  featured?: boolean;
  bestseller?: boolean;
  material?: string;
  colors?: string[];
  ratings?: number;
  reviews?: {
    author: string;
    rating: number;
    date: string;
    comment: string;
  }[];
  isGenz?: boolean;
  deleted_at?: string | null;
  deletedAt?: string | null;
  scheduledPermanentDeletionAt?: string | null;
  variants?: ProductVariant[];
  display_sections?: string[];
  compareAtPrice?: number | null;
  weightGrams?: number | null;
  productStatus?: 'active' | 'draft' | 'archived';
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  reorderPoint?: number | null;
}

export interface Order {
  id: string;
  customer: string;
  date: string;
  total: number;
  status: string;
  items: string[];
  originalTotal: number;
  couponDiscount: number;
  couponCode: string;
  walletPaid: number;
  gatewayPaid: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  pointsEarned: number;
  pointsCreditStatus?: string;
  pointsCreditScheduledAt?: string | null;
  returnReason?: string;
  returnDetails?: string;
  returnImage?: string;
  returnImageUrl?: string | null;
  return_image_url?: string | null;
  razorpayPaymentId?: string;
  refundOption?: string;
  returnRequestDate?: string;
  returnDate?: string;
  returnRejectReason?: string;
  qualityCheckPassed?: boolean;
  shiprocketId?: string;
  idempotencyKey?: string;
  cartItems?: any[];
  returnedItems?: any[];
  paymentStatus?: string;
  paymentProcessingState?: any;
  userId?: string;
  user_id?: string;
  address_snapshot?: any;
  refund_id?: string;
  refund_amount?: number;
  refund_status?: string;
  refund_reason?: string;
  refunded_at?: string;
  razorpay_payment_id?: string;
  created_at?: string;
  createdAt?: string;
  deliveredAt?: string;
  returnAwb?: string;
  returnPickupScheduled?: string;
  delivered_at?: string;
  return_awb?: string;
  return_pickup_scheduled?: string;
  awbCode?: string | null;
  courierName?: string | null;
  trackingUrl?: string | null;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  shippingAmount?: number;
  shipping_amount?: number;
  packedAt?: string | null;
  acceptedAt?: string | null;
  invoice_template_version?: number;
  invoiceTemplateVersion?: number;
  returnImages?: { name: string; url: string; public_id: string; }[];
  returnImagesDeletionScheduledAt?: string | null;
  returnImagesDeleted?: boolean;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  metadata?: any;
  created_at: string;
  updated_by: string;
  triggerSource?: string;
  reason?: string;
}

export interface OrderNote {
  id: string;
  orderId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  order_id?: string;
  orderId?: string;
  event: string;
  description?: string;
  created_at: string;
  createdAt?: string;
}


export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: "percent" | "flat" | "spend_discount";
  active: boolean;
  expiryDate?: string | null;
  minCartValue?: number | null;
  maxUsage?: number | null;
  usageCount?: number | null;
  usage_count?: number | null;
  max_usage?: number | null;
  min_cart_value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountPercent?: number | null;
  buyProductId?: string | null;
  getProductId?: string | null;
}

export interface WalletTransaction {
  id: string;
  date: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  idempotencyKey?: string;
}

export interface LoyaltyTransaction {
  id: string;
  date: string;
  points: number;
  type: "credit" | "debit";
  description: string;
  idempotencyKey?: string;
  expiresAt?: string | null;        // Set on credit rows: 12 months from earn date
  expiredProcessed?: string | null; // Set by nightly expiry sweep job when points are expired
}

export interface UserAddress {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export interface Shipment {
  id: string;
  order_id: string;
  shiprocket_order_id: string;
  shipment_id: string;
  awb_code: string;
  courier_name: string;
  status: string;
  etd?: string;
  weight?: number;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  label_url?: string | null;
  manifest_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: string;
  activity: string;
  location?: string;
  timestamp: string;
  created_at?: string;
}

export interface TrackingLog {
  id: string;
  shipment_id: string;
  raw_payload: any;
  created_at: string;
}
