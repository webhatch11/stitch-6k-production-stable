
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
  variants?: ProductVariant[];
  display_sections?: string[];
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
  returnReason?: string;
  returnDetails?: string;
  returnImage?: string;
  refundOption?: string;
  returnRequestDate?: string;
  returnDate?: string;
  returnRejectReason?: string;
  qualityCheckPassed?: boolean;
  shiprocketId?: string;
  idempotencyKey?: string;
  cartItems?: any[];
  paymentStatus?: string;
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
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  metadata?: any;
  created_at: string;
  updated_by: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: "percent" | "flat" | "bogo_quantity" | "bogo_product" | "spend_discount";
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

const PRODUCTS_KEY = "fallback_products";
const ORDERS_KEY = "fallback_orders";
const COUPONS_KEY = "fallback_coupons";
const VERSION_KEY = "fallback_version";
const WALLET_BALANCE_KEY = "fallback_wallet_balance";
const WALLET_TX_KEY = "fallback_wallet_transactions";
const LOYALTY_POINTS_KEY = "fallback_loyalty_points";
const LOYALTY_TX_KEY = "fallback_loyalty_transactions";
const ADDRESSES_KEY = "fallback_addresses";
const ORDER_STATUS_HISTORY_KEY = "fallback_order_status_history";
const SHIPMENTS_KEY = "fallback_shipments";
const SHIPMENT_EVENTS_KEY = "fallback_shipment_events";
const TRACKING_LOGS_KEY = "fallback_tracking_logs";
const CURRENT_VERSION = "5.7_logistics";

const isBrowser = () => typeof window !== "undefined";

export const seedProducts: Product[] = [
        {
          id: "seed-feat-1",
          slug: "luxury-black-shirt",
          title: "Signature Black",
          price: 2499,
          comparePrice: 3499,
          basePrice: 2499,
          category: "Cotton",
          image: "/assets/model_black_shirt.png",
          images: [
            "/assets/model_black_shirt.png",
            "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 45,
          description: "Crafted from premium long-staple cotton in our formal atelier silhouette.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 },
          specFabric: "100% Giza Cotton",
          specFit: "Formal Atelier Silhouette",
          specCollar: "Semi-Spread Collar",
          specSleeve: "Full Sleeve with mitred cuffs",
          specCare: "Dry Clean or gentle hand wash",
          featured: true,
          bestseller: true,
          material: "Cotton",
          colors: ["Black"],
          ratings: 4.8,
          reviews: [
            { author: "Vikram R.", rating: 5, date: "22 May 2026", comment: "Absolutely incredible fit. The hand-finished seams are perfect." },
            { author: "Amit S.", rating: 4, date: "15 May 2026", comment: "The MOP buttons look premium in low light." }
          ]
        },
        {
          id: "seed-feat-2",
          slug: "belgian-linen-overshirt",
          title: "Desert Linen",
          price: 1899,
          comparePrice: 2699,
          basePrice: 1899,
          category: "Linen",
          image: "/assets/model_beige_shirt.png",
          images: [
            "/assets/model_beige_shirt.png",
            "https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 30,
          description: "Breathable organic sand beige linen tailored for standard luxury comfort.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 },
          specFabric: "100% Pure Belgian Linen",
          specFit: "Relaxed Overshirt Fit",
          specCollar: "Camp Collar",
          specSleeve: "Full Sleeve",
          specCare: "Cold wash, line dry in shade",
          featured: true,
          bestseller: false,
          material: "Linen",
          colors: ["Sand Beige"],
          ratings: 4.7,
          reviews: [
            { author: "Rohan D.", rating: 5, date: "29 May 2026", comment: "Super breathable! Perfect for hot summer days." }
          ]
        },
        {
          id: "seed-feat-3",
          slug: "the-altitude-shirt",
          title: "The Altitude Shirt",
          price: 2999,
          comparePrice: 3999,
          basePrice: 2999,
          category: "Cotton",
          image: "/assets/model_white_shirt.png",
          images: [
            "/assets/model_white_shirt.png",
            "/assets/folded_white_shirt.png",
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 35,
          description: "An exquisite high-altitude white weave cotton for the ultimate drape.",
          sizeStock: { S: 10, M: 10, L: 10, XL: 3, XXL: 2 },
          specFabric: "100% Sea Island Cotton",
          specFit: "Modern Tailored Fit",
          specCollar: "Cutaway Collar",
          specSleeve: "Full Sleeve",
          specCare: "Warm iron, machine wash inside out",
          featured: true,
          bestseller: true,
          material: "Cotton",
          colors: ["White"],
          ratings: 4.9,
          reviews: [
            { author: "Sanjay M.", rating: 5, date: "24 May 2026", comment: "Best white shirt I have ever owned. Truly exceptional." }
          ]
        },
        {
          id: "seed-feat-4",
          slug: "olive-heritage",
          title: "Olive Heritage",
          price: 2299,
          comparePrice: 2999,
          basePrice: 2299,
          category: "Cotton",
          image: "/assets/model_olive_shirt.png",
          images: [
            "/assets/model_olive_shirt.png",
            "/assets/folded_olive_shirt.png",
            "https://images.unsplash.com/photo-1598961008151-3a70ce8db30a?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: false,
          stock: 22,
          description: "Rugged yet refined olive cotton twill with hand-finished seams.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 },
          specFabric: "100% Organic Twill Cotton",
          specFit: "Regular Fit",
          specCollar: "Button-Down Collar",
          specSleeve: "Full Sleeve",
          specCare: "Machine wash cold with like colors",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Olive Green"],
          ratings: 4.5,
          reviews: []
        },
        {
          id: "seed-feat-5",
          slug: "navy-atelier",
          title: "Navy Atelier",
          price: 2799,
          comparePrice: 3599,
          basePrice: 2799,
          category: "Cotton",
          image: "/assets/model_navy_shirt.png",
          images: [
            "/assets/model_navy_shirt.png",
            "/assets/hanging_navy_shirt.png",
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: false,
          stock: 50,
          description: "Bespoke tailored navy poplin showcasing a rich double-needle profile.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 },
          specFabric: "100% Egyptian Cotton Poplin",
          specFit: "Slim Fit",
          specCollar: "Classic Spread Collar",
          specSleeve: "Full Sleeve",
          specCare: "Professional dry clean recommended",
          featured: false,
          bestseller: true,
          material: "Cotton",
          colors: ["Deep Navy"],
          ratings: 4.6,
          reviews: []
        },
        {
          id: "seed-feat-6",
          slug: "classic-white",
          title: "Classic White",
          price: 2199,
          comparePrice: 2799,
          basePrice: 2199,
          category: "Cotton",
          image: "/assets/model_white_shirt.png",
          images: [
            "/assets/model_white_shirt.png",
            "/assets/folded_white_shirt.png",
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 25,
          description: "Everyday essential classic white cotton shirt with mitred cuffs.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 },
          specFabric: "100% Long-Staple Cotton Oxford",
          specFit: "Standard Fit",
          specCollar: "Spread Collar",
          specSleeve: "Full Sleeve",
          specCare: "Machine wash warm, iron medium",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["White"],
          ratings: 4.4,
          reviews: []
        },
        {
          id: "seed-feat-7",
          slug: "safari-tan",
          title: "Safari Tan",
          price: 1799,
          comparePrice: 2499,
          basePrice: 1799,
          category: "Linen",
          image: "/assets/model_beige_shirt.png",
          images: [
            "/assets/model_beige_shirt.png",
            "https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 12,
          description: "Travel series linen shirt in a warm desert tan shade.",
          sizeStock: { S: 2, M: 4, L: 4, XL: 2, XXL: 0 },
          specFabric: "100% French Linen",
          specFit: "Safari Fit",
          specCollar: "Band Collar",
          specSleeve: "Full Sleeve (roll-up)",
          specCare: "Cold hand wash",
          featured: false,
          bestseller: false,
          material: "Linen",
          colors: ["Safari Tan"],
          ratings: 4.3,
          reviews: []
        },
        {
          id: "seed-feat-8",
          slug: "midnight-noir",
          title: "Midnight Noir",
          price: 2699,
          comparePrice: 3499,
          basePrice: 2699,
          category: "Cotton",
          image: "/assets/model_black_shirt.png",
          images: [
            "/assets/model_black_shirt.png",
            "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 20,
          description: "Perfect evening shirt crafted from rich black organic poplin.",
          sizeStock: { S: 5, M: 5, L: 5, XL: 3, XXL: 2 },
          specFabric: "100% Organic Pima Cotton",
          specFit: "Evening Slim Fit",
          specCollar: "Cutaway Collar",
          specSleeve: "Full Sleeve with French Cuffs",
          specCare: "Professional dry clean",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Midnight Black"],
          ratings: 4.7,
          reviews: []
        },
        {
          id: "seed-feat-9",
          slug: "forest-chambray",
          title: "Forest Chambray",
          price: 2099,
          comparePrice: 2799,
          basePrice: 2099,
          category: "Cotton",
          image: "/assets/model_olive_shirt.png",
          images: [
            "/assets/model_olive_shirt.png",
            "/assets/folded_olive_shirt.png",
            "https://images.unsplash.com/photo-1598961008151-3a70ce8db30a?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: false,
          stock: 18,
          description: "Premium casual chambray weave with a natural forest green drape.",
          sizeStock: { S: 4, M: 4, L: 4, XL: 4, XXL: 2 },
          specFabric: "100% Slub Cotton Chambray",
          specFit: "Casual Utility Fit",
          specCollar: "Spread Collar",
          specSleeve: "Full Sleeve",
          specCare: "Machine wash cold, iron low",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Forest Green"],
          ratings: 4.2,
          reviews: []
        },
        {
          id: "seed-feat-10",
          slug: "premium-gold-jacket",
          title: "Premium Gold Jacket",
          price: 2899,
          comparePrice: 3999,
          basePrice: 2899,
          category: "Silk Blend",
          image: "/assets/model_navy_shirt.png",
          images: [
            "/assets/model_navy_shirt.png",
            "/assets/hanging_navy_shirt.png",
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 10,
          description: "Luxurious gold silk blend jacket with hand-finished collar details.",
          sizeStock: { S: 2, M: 3, L: 3, XL: 2, XXL: 0 },
          specFabric: "60% Mulberry Silk, 40% Fine Wool",
          specFit: "Bespoke Structured Jacket Fit",
          specCollar: "Mandarin Collar",
          specSleeve: "Full Sleeve",
          specCare: "Dry Clean Only",
          featured: true,
          bestseller: false,
          material: "Silk Blend",
          colors: ["Gold", "Deep Navy Accent"],
          ratings: 5.0,
          reviews: [
            { author: "Karthik K.", rating: 5, date: "30 May 2026", comment: "Absolutely breathtaking craftsmanship. Well worth the price." }
          ]
        },
        {
          id: "seed-fav-1",
          slug: "crafted-comfort",
          title: "Crafted Comfort",
          price: 1999,
          comparePrice: 2799,
          basePrice: 1999,
          category: "Linen",
          image: "/assets/striped_resort_shirt.png",
          images: [
            "/assets/striped_resort_shirt.png",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 32,
          description: "Orange striped resort-style linen shirt for breezy summer ease.",
          sizeStock: { S: 5, M: 8, L: 10, XL: 6, XXL: 3 },
          specFabric: "100% Italian Linen",
          specFit: "Resort Relaxed Fit",
          specCollar: "Camp Collar",
          specSleeve: "Short Sleeve",
          specCare: "Gentle machine wash cold",
          featured: false,
          bestseller: false,
          material: "Linen",
          colors: ["Orange", "Ivory Striped"],
          ratings: 4.6,
          reviews: []
        },
        {
          id: "seed-fav-2",
          slug: "everyday-luxury",
          title: "Everyday Luxury",
          price: 2399,
          comparePrice: 3299,
          basePrice: 2399,
          category: "Cotton",
          image: "/assets/teal_crane_shirt.png",
          images: [
            "/assets/teal_crane_shirt.png",
            "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 15,
          description: "Atelier teal crane printed cotton showcasing heritage artisan patterns.",
          sizeStock: { S: 3, M: 4, L: 5, XL: 2, XXL: 1 },
          specFabric: "100% Pima Cotton Satin",
          specFit: "Modern Fit",
          specCollar: "Semi-Spread Collar",
          specSleeve: "Full Sleeve",
          specCare: "Machine wash warm, iron inside out",
          featured: false,
          bestseller: true,
          material: "Cotton",
          colors: ["Teal Crane Print"],
          ratings: 4.8,
          reviews: []
        },
        {
          id: "seed-fav-3",
          slug: "atelier-oxford",
          title: "Atelier Oxford",
          price: 1699,
          comparePrice: 2499,
          basePrice: 1699,
          category: "Linen",
          image: "/assets/floral_resort_shirt.png",
          images: [
            "/assets/floral_resort_shirt.png",
            "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: false,
          stock: 24,
          description: "Beautiful handwoven rose patterned linen comfort resort shirt.",
          sizeStock: { S: 6, M: 6, L: 6, XL: 4, XXL: 2 },
          specFabric: "100% Organic Irish Linen",
          specFit: "Breezy Relaxed Fit",
          specCollar: "Camp Collar",
          specSleeve: "Short Sleeve",
          specCare: "Hand wash cold, dry flat",
          featured: false,
          bestseller: false,
          material: "Linen",
          colors: ["Rose Floral Print"],
          ratings: 4.5,
          reviews: []
        },
        {
          id: "seed-fav-4",
          slug: "sustainable-art",
          title: "Sustainable Art",
          price: 1499,
          comparePrice: 2099,
          basePrice: 1499,
          category: "Cotton",
          image: "/assets/geometric_resort_shirt.png",
          images: [
            "/assets/geometric_resort_shirt.png",
            "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: false,
          stock: 40,
          description: "Abstract block print organic cotton poplin from sustainable yarns.",
          sizeStock: { S: 8, M: 12, L: 12, XL: 6, XXL: 2 },
          specFabric: "100% Certified Organic Cotton",
          specFit: "Modern Casual Fit",
          specCollar: "Camp Collar",
          specSleeve: "Short Sleeve",
          specCare: "Cold wash, wash inside out",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Monochrome Geometric"],
          ratings: 4.4,
          reviews: []
        },
        {
          id: "seed-fav-5",
          slug: "atelier-white",
          title: "Atelier White",
          price: 1799,
          comparePrice: 2499,
          basePrice: 1799,
          category: "Cotton",
          image: "/assets/folded_white_shirt.png",
          images: [
            "/assets/folded_white_shirt.png",
            "/assets/model_white_shirt.png",
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 35,
          description: "Premium heavy cotton oxford weave in classic ivory white.",
          sizeStock: { S: 8, M: 10, L: 10, XL: 5, XXL: 2 },
          specFabric: "100% Premium Heavy Oxford Cotton",
          specFit: "Regular Fit",
          specCollar: "Button-Down Collar",
          specSleeve: "Full Sleeve",
          specCare: "Machine wash warm, iron hot",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Ivory White"],
          ratings: 4.7,
          reviews: []
        },
        {
          id: "seed-fav-6",
          slug: "classic-navy",
          title: "Classic Navy",
          price: 1999,
          comparePrice: 2799,
          basePrice: 1999,
          category: "Cotton",
          image: "/assets/hanging_navy_shirt.png",
          images: [
            "/assets/hanging_navy_shirt.png",
            "/assets/model_navy_shirt.png",
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: false,
          stock: 28,
          description: "Royal herringbone weave cotton shirt in deep ocean navy.",
          sizeStock: { S: 5, M: 8, L: 8, XL: 4, XXL: 3 },
          specFabric: "100% Egyptian Cotton Herringbone",
          specFit: "Tailored Slim Fit",
          specCollar: "Semi-Spread Collar",
          specSleeve: "Full Sleeve",
          specCare: "Wash inside out, warm iron",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Ocean Navy"],
          ratings: 4.6,
          reviews: []
        },
        {
          id: "seed-fav-7",
          slug: "atelier-olive",
          title: "Atelier Olive",
          price: 1899,
          comparePrice: 2699,
          basePrice: 1899,
          category: "Cotton",
          image: "/assets/folded_olive_shirt.png",
          images: [
            "/assets/folded_olive_shirt.png",
            "/assets/model_olive_shirt.png",
            "https://images.unsplash.com/photo-1598961008151-3a70ce8db30a?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 19,
          description: "Organic olive cotton twill with an ultra-soft brushed finish.",
          sizeStock: { S: 4, M: 5, L: 6, XL: 3, XXL: 1 },
          specFabric: "100% Brushed Organic Cotton",
          specFit: "Relaxed Fit",
          specCollar: "Classic Collar",
          specSleeve: "Full Sleeve",
          specCare: "Cold wash with mild detergent",
          featured: false,
          bestseller: false,
          material: "Cotton",
          colors: ["Brushed Olive"],
          ratings: 4.5,
          reviews: []
        },
        {
          id: "seed-fav-8",
          slug: "royal-crimson",
          title: "Royal Crimson",
          price: 2999,
          comparePrice: 3999,
          basePrice: 2999,
          category: "Silk",
          image: "/assets/folded_crimson_shirt.png",
          images: [
            "/assets/folded_crimson_shirt.png",
            "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=1200"
          ],
          isNew: true,
          stock: 15,
          description: "Artisan crimson silk twill blend with natural luxury sheen.",
          sizeStock: { S: 3, M: 4, L: 4, XL: 2, XXL: 2 },
          specFabric: "70% Silk, 30% Egyptian Cotton Twill",
          specFit: "Atelier Custom Fit",
          specCollar: "Cutaway Collar",
          specSleeve: "Full Sleeve",
          specCare: "Dry Clean Only",
          featured: false,
          bestseller: false,
          material: "Silk Blend",
          colors: ["Crimson Red"],
          ratings: 4.9,
          reviews: []
        },
        {
          id: "seed-genz-1",
          slug: "oversized-atelier-black",
          title: "Boxy Streetwear Oversized",
          price: 2999,
          comparePrice: 3999,
          basePrice: 2999,
          category: "Oversized Shirts",
          image: "/assets/genz_oversized_black.png",
          images: [
            "/assets/genz_oversized_black.png"
          ],
          isNew: true,
          stock: 50,
          description: "Heavyweight drop-shoulder boxy fit with metal button detailing and distressed raw hem.",
          sizeStock: { S: 12, M: 15, L: 15, XL: 8 },
          specFabric: "100% Heavyweight Cotton (240 GSM)",
          specFit: "Oversized Boxy Fit",
          specCollar: "Spread Collar",
          specSleeve: "Drop-Shoulder Half Sleeve",
          specCare: "Cold wash inside out, do not tumble dry",
          isGenz: true,
          material: "Heavyweight Cotton",
          colors: ["Charcoal Black"],
          ratings: 4.9,
          reviews: []
        },
        {
          id: "seed-genz-2",
          slug: "streetwear-linen-coord-slate",
          title: "Street Linen Co-ord Set",
          price: 4999,
          comparePrice: 5999,
          basePrice: 4999,
          category: "Co-ord Sets",
          image: "/assets/genz_coord_slate.png",
          images: [
            "/assets/genz_coord_slate.png"
          ],
          isNew: true,
          stock: 35,
          description: "Relaxed urban co-ord set featuring a loose-fit camp collar shirt and matching drawstring shorts.",
          sizeStock: { S: 8, M: 12, L: 10, XL: 5 },
          specFabric: "100% Belgian Linen Twill",
          specFit: "Relaxed Street Fit",
          specCollar: "Camp Collar",
          specSleeve: "Short Sleeve",
          specCare: "Gentle machine wash cold",
          isGenz: true,
          material: "Linen",
          colors: ["Slate Gray"],
          ratings: 4.8,
          reviews: []
        },
        {
          id: "seed-genz-3",
          slug: "urban-utility-cargo-olive",
          title: "Utility Tactical Cargo",
          price: 3499,
          comparePrice: 4499,
          basePrice: 3499,
          category: "Urban Utility",
          image: "/assets/genz_utility_olive.png",
          images: [
            "/assets/genz_utility_olive.png"
          ],
          isNew: false,
          stock: 40,
          description: "Military-inspired utility shirt with dual cargo chest pockets, tactical straps, and metal hardware.",
          sizeStock: { S: 10, M: 12, L: 12, XL: 6 },
          specFabric: "100% Structured Cotton Ripstop",
          specFit: "Semi-Oversized Fit",
          specCollar: "Classic Point Collar",
          specSleeve: "Full Sleeve with adjustable tabs",
          specCare: "Machine wash cold, line dry in shade",
          isGenz: true,
          material: "Ripstop Cotton",
          colors: ["Tactical Olive"],
          ratings: 4.7,
          reviews: []
        },
        {
          id: "seed-genz-4",
          slug: "printed-luxury-silk-resort",
          title: "Gradient Twilight Silk",
          price: 3899,
          comparePrice: 4999,
          basePrice: 3899,
          category: "Printed Luxury",
          image: "/assets/geometric_resort_shirt.png",
          images: [
            "/assets/geometric_resort_shirt.png"
          ],
          isNew: true,
          stock: 25,
          description: "Moody twilight gradient print crafted from premium mulberry silk twill blend. Soft, fluid drape.",
          sizeStock: { S: 5, M: 8, L: 8, XL: 4 },
          specFabric: "60% Mulberry Silk, 40% Organic Rayon",
          specFit: "Relaxed Resort Fit",
          specCollar: "Camp Collar",
          specSleeve: "Short Sleeve",
          specCare: "Dry Clean Only",
          isGenz: true,
          material: "Silk Blend",
          colors: ["Twilight Purple"],
          ratings: 4.9,
          reviews: []
        },
        {
          id: "seed-genz-5",
          slug: "monochrome-washed-cotton-acid",
          title: "Acid Wash Heavyweight",
          price: 2799,
          comparePrice: 3799,
          basePrice: 2799,
          category: "Monochrome Collections",
          image: "/assets/teal_crane_shirt.png",
          images: [
            "/assets/teal_crane_shirt.png"
          ],
          isNew: false,
          stock: 45,
          description: "Acid washed luxury streetwear shirt with unique marble wash patterns. Custom high-density print on back.",
          sizeStock: { S: 10, M: 15, L: 15, XL: 5 },
          specFabric: "100% Ring-Spun Cotton (220 GSM)",
          specFit: "Oversized Fit",
          specCollar: "Standard Spread Collar",
          specSleeve: "Half Sleeve",
          specCare: "Cold wash inside out, iron on reverse",
          isGenz: true,
          material: "Cotton",
          colors: ["Acid Grey"],
          ratings: 4.8,
          reviews: []
        },
        {
          id: "seed-genz-6",
          slug: "relaxed-fit-slate-resort",
          title: "Slate Camp Collar Resort",
          price: 2499,
          comparePrice: 3499,
          basePrice: 2499,
          category: "Relaxed Fit Collections",
          image: "/assets/striped_resort_shirt.png",
          images: [
            "/assets/striped_resort_shirt.png"
          ],
          isNew: true,
          stock: 30,
          description: "Clean, minimalist slate resort shirt with open camp collar and custom vertical stripe weave.",
          sizeStock: { S: 8, M: 10, L: 10, XL: 2 },
          specFabric: "80% Rayon, 20% Cotton Linen",
          specFit: "Relaxed Resort Fit",
          specCollar: "Camp Collar",
          specSleeve: "Short Sleeve",
          specCare: "Cold hand wash, lay flat to dry",
          isGenz: true,
          material: "Cotton Blend",
          colors: ["Slate Stripe"],
          ratings: 4.6,
          reviews: []
        }
      ];


export const RegistryManager = {
  init() {
    if (!isBrowser()) return;

    const savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion !== CURRENT_VERSION) {
      localStorage.removeItem(PRODUCTS_KEY);
      localStorage.removeItem(ORDERS_KEY);
      localStorage.removeItem(COUPONS_KEY);
      localStorage.removeItem(WALLET_BALANCE_KEY);
      localStorage.removeItem(WALLET_TX_KEY);
      localStorage.removeItem(LOYALTY_POINTS_KEY);
      localStorage.removeItem(LOYALTY_TX_KEY);
      localStorage.removeItem(ADDRESSES_KEY);
      localStorage.removeItem(ORDER_STATUS_HISTORY_KEY);
      localStorage.removeItem(SHIPMENTS_KEY);
      localStorage.removeItem(SHIPMENT_EVENTS_KEY);
      localStorage.removeItem(TRACKING_LOGS_KEY);
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }

    if (!localStorage.getItem(PRODUCTS_KEY)) {
      localStorage.setItem('seed_init_flag', 'true');      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(seedProducts));

    }

    if (!localStorage.getItem(ORDERS_KEY)) {
      const seedOrders: Order[] = [
        {
          id: "ORD-101",
          customer: "Aditya Singhania",
          date: new Date().toLocaleDateString("en-IN"),
          total: 6400,
          status: "Delivered",
          items: ["Classic White Oxford"],
          originalTotal: 6400,
          couponDiscount: 0,
          couponCode: "",
          walletPaid: 0,
          gatewayPaid: 6400,
          pointsRedeemed: 0,
          pointsDiscount: 0,
          pointsEarned: 640,
        },
      ];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(seedOrders));
    }

    if (!localStorage.getItem(COUPONS_KEY)) {
      const seedCoupons: Coupon[] = [
        { id: "CPN-1", code: "HERITAGE10", discount: 10, type: "percent", active: true, minCartValue: 5000, maxUsage: 100, usageCount: 5, expiryDate: "2027-12-31" },
        { id: "CPN-2", code: "LAUNCH500", discount: 500, type: "flat", active: true, minCartValue: 2000, maxUsage: 50, usageCount: 12, expiryDate: "2027-12-31" },
        { id: "CPN-3", code: "FESTIVE24", discount: 10, type: "percent", active: false, minCartValue: 1000, maxUsage: 10, usageCount: 2, expiryDate: "2024-12-31" },
        { id: "CPN-4", code: "EXPIRED50", discount: 50, type: "percent", active: true, minCartValue: 100, maxUsage: 10, usageCount: 0, expiryDate: "2025-01-01" },
        { id: "CPN-5", code: "LIMITOUT", discount: 15, type: "percent", active: true, minCartValue: 100, maxUsage: 10, usageCount: 10, expiryDate: "2027-12-31" },
      ];
      localStorage.setItem(COUPONS_KEY, JSON.stringify(seedCoupons));
    }

    if (localStorage.getItem(WALLET_BALANCE_KEY) === null) {
      localStorage.setItem(WALLET_BALANCE_KEY, "2500");
      const welcomeWalletTx: WalletTransaction[] = [
        {
          id: "WTX-101",
          date: new Date().toLocaleDateString("en-IN"),
          amount: 2500,
          type: "credit",
          description: "Welcome Sign Up Bonus",
        },
      ];
      localStorage.setItem(WALLET_TX_KEY, JSON.stringify(welcomeWalletTx));
    }

    if (localStorage.getItem(LOYALTY_POINTS_KEY) === null) {
      localStorage.setItem(LOYALTY_POINTS_KEY, "2000");
      const welcomeLoyaltyTx: LoyaltyTransaction[] = [
        {
          id: "LTX-101",
          date: new Date().toLocaleDateString("en-IN"),
          points: 2000,
          type: "credit",
          description: "Account Registration Points",
        },
      ];
      localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(welcomeLoyaltyTx));
    }
  },

  getProducts(): Product[] {
    if (!isBrowser()) return seedProducts;
    this.init();
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || JSON.stringify(seedProducts));
  },

  getProductBySlug(slug: string): Product | undefined {
    if (!isBrowser()) return seedProducts.find(p => p.slug === slug);
    const products = this.getProducts();
    return products.find(p => p.slug === slug);
  },

  saveProduct(product: Partial<Product>) {
    if (!isBrowser()) return;
    const products = this.getProducts();
    let images = product.images && product.images.length > 0 ? product.images.filter(Boolean) : [];
    if (images.length === 0) {
      images = [product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=600"];
    }
    const primaryImage = images[0] || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=600";
    const generatedSlug = product.slug || (product.title ? product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") : "untitled-product");
    const newProduct: Product = {
      id: product.id || "ART-" + Date.now(),
      slug: generatedSlug,
      title: product.title || "Untitled Product",
      price: product.price || 0,
      comparePrice: product.comparePrice,
      category: product.category || "Cotton",
      image: primaryImage,
      images: images,
      isNew: product.isNew !== undefined ? product.isNew : true,
      stock: product.stock || 0,
      description: product.description || "",
      details: product.details || {},
      isAtelierExclusive: product.isAtelierExclusive || false,
      sizeStock: product.sizeStock || {},
      basePrice: product.basePrice,
      gstRate: product.gstRate,
      discountRate: product.discountRate,
      specFabric: product.specFabric,
      specFit: product.specFit,
      specCollar: product.specCollar,
      specSleeve: product.specSleeve,
      specCare: product.specCare,
      customBadge: product.customBadge,
      featured: product.featured || false,
      bestseller: product.bestseller || false,
      material: product.material || "",
      colors: product.colors || [],
      ratings: product.ratings || 5.0,
      reviews: product.reviews || [],
    };
    const existingIndex = products.findIndex(p => p.id === newProduct.id);
    if (existingIndex !== -1) {
      products[existingIndex] = newProduct;
    } else {
      products.unshift(newProduct);
    }
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  deleteProduct(id: string) {
    if (!isBrowser()) return;
    const products = this.getProducts().filter((p) => p.id !== id);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  getOrders(): Order[] {
    if (!isBrowser()) return [];
    this.init();
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  },

  getDashboardMetrics() {
    if (!isBrowser()) return { totalOrders: 0, totalRevenue: 0, cashRevenue: 0, creditRevenue: 0, inventoryCount: 0, totalStock: 0, walletLiability: 0, conversion: "4.2%" };
    const orders = this.getOrders();
    const activeOrders = orders.filter((o) => o.status !== "Returned");
    const products = this.getProducts();
    const revenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const cashRevenue = activeOrders.reduce((sum, o) => sum + (o.gatewayPaid || 0), 0);
    const creditRevenue = activeOrders.reduce((sum, o) => sum + (o.walletPaid || 0), 0);
    const walletLiability = this.getWalletBalance();
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


  saveOrder(order: Partial<Order>): Order {
    if (!isBrowser()) throw new Error("Browser only");
    const orders = this.getOrders();
    const existingIndex = orders.findIndex(o => o.id === order.id);
    const oldOrder = existingIndex !== -1 ? orders[existingIndex] : null;

    if (existingIndex === -1 && order.id && orders.some(o => o.id === order.id)) {
      throw new Error("duplicate key value violates unique constraint \"orders_pkey\"");
    }

    const newOrder: Order = {
      id: order.id || "ORD-" + Math.floor(Math.random() * 9000 + 1000),
      customer: order.customer || (oldOrder ? oldOrder.customer : "Guest Customer"),
      date: order.date || (oldOrder ? oldOrder.date : new Date().toLocaleDateString("en-IN")),
      total: order.total !== undefined ? order.total : (oldOrder ? oldOrder.total : 0),
      status: order.status || (oldOrder ? oldOrder.status : "Pending"),
      items: order.items || (oldOrder ? oldOrder.items : []),
      originalTotal: order.originalTotal !== undefined ? order.originalTotal : (oldOrder ? oldOrder.originalTotal : 0),
      couponDiscount: order.couponDiscount !== undefined ? order.couponDiscount : (oldOrder ? oldOrder.couponDiscount : 0),
      couponCode: order.couponCode !== undefined ? order.couponCode : (oldOrder ? oldOrder.couponCode : ""),
      walletPaid: order.walletPaid !== undefined ? order.walletPaid : (oldOrder ? oldOrder.walletPaid : 0),
      gatewayPaid: order.gatewayPaid !== undefined ? order.gatewayPaid : (oldOrder ? oldOrder.gatewayPaid : 0),
      pointsRedeemed: order.pointsRedeemed !== undefined ? order.pointsRedeemed : (oldOrder ? oldOrder.pointsRedeemed : 0),
      pointsDiscount: order.pointsDiscount !== undefined ? order.pointsDiscount : (oldOrder ? oldOrder.pointsDiscount : 0),
      pointsEarned: order.pointsEarned !== undefined ? order.pointsEarned : (oldOrder ? oldOrder.pointsEarned : 0),
      returnReason: order.returnReason !== undefined ? order.returnReason : (oldOrder ? oldOrder.returnReason : undefined),
      returnDetails: order.returnDetails !== undefined ? order.returnDetails : (oldOrder ? oldOrder.returnDetails : undefined),
      returnImage: order.returnImage !== undefined ? order.returnImage : (oldOrder ? oldOrder.returnImage : undefined),
      refundOption: order.refundOption !== undefined ? order.refundOption : (oldOrder ? oldOrder.refundOption : undefined),
      returnRequestDate: order.returnRequestDate !== undefined ? order.returnRequestDate : (oldOrder ? oldOrder.returnRequestDate : undefined),
      returnDate: order.returnDate !== undefined ? order.returnDate : (oldOrder ? oldOrder.returnDate : undefined),
      returnRejectReason: order.returnRejectReason !== undefined ? order.returnRejectReason : (oldOrder ? oldOrder.returnRejectReason : undefined),
      qualityCheckPassed: order.qualityCheckPassed !== undefined ? order.qualityCheckPassed : (oldOrder ? oldOrder.qualityCheckPassed : undefined),
      shiprocketId: order.shiprocketId !== undefined ? order.shiprocketId : (oldOrder ? oldOrder.shiprocketId : undefined),
      idempotencyKey: order.idempotencyKey || order.id,
      cartItems: order.cartItems !== undefined ? order.cartItems : (oldOrder ? oldOrder.cartItems : []),
      paymentStatus: order.paymentStatus !== undefined ? order.paymentStatus : (oldOrder ? oldOrder.paymentStatus : ""),
      userId: order.userId !== undefined ? order.userId : (oldOrder ? oldOrder.userId : undefined),
      address_snapshot: order.address_snapshot !== undefined ? order.address_snapshot : (oldOrder ? oldOrder.address_snapshot : null),
      refund_id: order.refund_id !== undefined ? order.refund_id : (oldOrder ? oldOrder.refund_id : undefined),
      refund_amount: order.refund_amount !== undefined ? order.refund_amount : (oldOrder ? oldOrder.refund_amount : undefined),
      refund_status: order.refund_status !== undefined ? order.refund_status : (oldOrder ? oldOrder.refund_status : undefined),
      refund_reason: order.refund_reason !== undefined ? order.refund_reason : (oldOrder ? oldOrder.refund_reason : undefined),
      refunded_at: order.refunded_at !== undefined ? order.refunded_at : (oldOrder ? oldOrder.refunded_at : undefined),
      razorpay_payment_id: order.razorpay_payment_id !== undefined ? order.razorpay_payment_id : (oldOrder ? oldOrder.razorpay_payment_id : undefined),
      created_at: order.created_at !== undefined ? order.created_at : (oldOrder ? oldOrder.created_at : new Date().toISOString()),
      createdAt: order.createdAt !== undefined ? order.createdAt : (oldOrder ? oldOrder.createdAt : new Date().toISOString()),
      delivered_at: order.delivered_at !== undefined ? order.delivered_at : (order.deliveredAt !== undefined ? order.deliveredAt : (oldOrder ? oldOrder.delivered_at : undefined)),
      deliveredAt: order.deliveredAt !== undefined ? order.deliveredAt : (order.delivered_at !== undefined ? order.delivered_at : (oldOrder ? oldOrder.deliveredAt : undefined)),
      return_awb: order.return_awb !== undefined ? order.return_awb : (order.returnAwb !== undefined ? order.returnAwb : (oldOrder ? oldOrder.return_awb : undefined)),
      returnAwb: order.returnAwb !== undefined ? order.returnAwb : (order.return_awb !== undefined ? order.return_awb : (oldOrder ? oldOrder.returnAwb : undefined)),
      return_pickup_scheduled: order.return_pickup_scheduled !== undefined ? order.return_pickup_scheduled : (order.returnPickupScheduled !== undefined ? order.returnPickupScheduled : (oldOrder ? oldOrder.return_pickup_scheduled : undefined)),
      returnPickupScheduled: order.returnPickupScheduled !== undefined ? order.returnPickupScheduled : (order.return_pickup_scheduled !== undefined ? order.return_pickup_scheduled : (oldOrder ? oldOrder.returnPickupScheduled : undefined)),
    };

    if (newOrder.status && newOrder.status.toLowerCase() === "delivered" && !newOrder.delivered_at) {
      newOrder.delivered_at = new Date().toISOString();
      newOrder.deliveredAt = newOrder.delivered_at;
    }

    if (existingIndex !== -1) {
      orders[existingIndex] = newOrder;
      if (oldOrder && oldOrder.status !== newOrder.status) {
        this.addOrderStatusHistory(newOrder.id, newOrder.status, "system", { previous_status: oldOrder.status });
      }
    } else {
      orders.unshift(newOrder);
      localStorage.setItem("cartCount", "0");
      localStorage.removeItem("cart_items");
      this.addOrderStatusHistory(newOrder.id, newOrder.status, "system", { info: "Order created" });
    }
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return newOrder;
  },

  getCoupons(): Coupon[] {
    if (!isBrowser()) return [];
    this.init();
    return JSON.parse(localStorage.getItem(COUPONS_KEY) || "[]");
  },

  saveCoupon(coupon: Partial<Coupon>) {
    if (!isBrowser()) return;
    const coupons = this.getCoupons();
    const existingIdx = coupon.id ? coupons.findIndex((c) => c.id === coupon.id) : -1;
    const payload: Coupon = {
      id: coupon.id || "CPN-" + Date.now(),
      code: (coupon.code || "CODE").toUpperCase(),
      discount: coupon.discount !== undefined ? coupon.discount : 0,
      type: coupon.type || "percent",
      active: coupon.active !== undefined ? coupon.active : true,
      expiryDate: coupon.expiryDate !== undefined ? coupon.expiryDate : null,
      minCartValue: coupon.minCartValue !== undefined ? coupon.minCartValue : 0,
      maxUsage: coupon.maxUsage !== undefined ? coupon.maxUsage : null,
      usageCount: coupon.usageCount !== undefined ? coupon.usageCount : 0,
      buyQuantity: coupon.buyQuantity !== undefined ? coupon.buyQuantity : null,
      getQuantity: coupon.getQuantity !== undefined ? coupon.getQuantity : null,
      getDiscountPercent: coupon.getDiscountPercent !== undefined ? coupon.getDiscountPercent : null,
      buyProductId: coupon.buyProductId !== undefined ? coupon.buyProductId : null,
      getProductId: coupon.getProductId !== undefined ? coupon.getProductId : null,
    };
    if (existingIdx > -1) {
      if (coupon.usageCount === undefined) {
        payload.usageCount = coupons[existingIdx].usageCount || 0;
      }
      coupons[existingIdx] = payload;
    } else {
      coupons.unshift(payload);
    }
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
  },

  deleteCoupon(id: string) {
    if (!isBrowser()) return;
    const coupons = this.getCoupons().filter((c) => c.id !== id);
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
  },

  validateCoupon(code: string, cartTotal: number, userId?: string, cartItems?: any[]): { valid: boolean; coupon?: Coupon; error?: string; discountAmount?: number; message?: string; freeItems?: any[] } {
    if (!isBrowser()) return { valid: false, error: "Validation not possible in SSR environment." };
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!coupon) {
      return { valid: false, error: "Coupon not found." };
    }
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
        const mockProds = this.getProducts();
        const p = mockProds.find(item => item.id === buyProductId);
        const buyProductName = p?.title || buyProductId || "";
        return {
          valid: false,
          error: `Buy "${buyProductName}" to unlock this coupon.`,
        };
      }
      const getProduct = cartItems.find(item => item.productId === getProductId);
      if (!getProduct) {
        const mockProds = this.getProducts();
        const p = mockProds.find(item => item.id === getProductId);
        const getProductName = p?.title || getProductId || "";
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

  incrementCouponUsage(code: string): boolean {
    if (!isBrowser()) return false;
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!coupon) return false;
    coupon.usageCount = (coupon.usageCount || 0) + 1;
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
    return true;
  },

  decrementCouponUsage(code: string): boolean {
    if (!isBrowser()) return false;
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!coupon) return false;
    coupon.usageCount = Math.max(0, (coupon.usageCount || 0) - 1);
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
    return true;
  },

  getWalletBalance(): number {
    if (!isBrowser()) return 0;
    this.init();
    return parseFloat(localStorage.getItem(WALLET_BALANCE_KEY) || "0");
  },

  getWalletTransactions(): WalletTransaction[] {
    if (!isBrowser()) return [];
    this.init();
    return JSON.parse(localStorage.getItem(WALLET_TX_KEY) || "[]");
  },

  getWalletData() {
    return {
      balance: this.getWalletBalance(),
      transactions: this.getWalletTransactions(),
    };
  },

  applyWalletDebit(amount: number, orderId: string): { success: boolean; error?: string } {
    if (!isBrowser()) return { success: false, error: "SSR Environment" };
    
    const txs = this.getWalletTransactions();
    if (txs.some(t => t.idempotencyKey === orderId)) {
      throw new Error("duplicate key value violates unique constraint \"wallet_transactions_idempotency_key_key\"");
    }

    let balance = this.getWalletBalance();
    if (amount > balance) {
      return { success: false, error: "Insufficient wallet balance." };
    }
    balance -= amount;
    localStorage.setItem(WALLET_BALANCE_KEY, balance.toString());

    txs.unshift({
      id: "WTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      amount: amount,
      type: "debit",
      description: `Payment for Order #${orderId}`,
      idempotencyKey: orderId,
    });
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(txs));
    return { success: true };
  },

  applyWalletCredit(amount: number, description: string, orderId: string) {
    if (!isBrowser()) return;
    
    const txs = this.getWalletTransactions();
    if (txs.some(t => t.idempotencyKey === `refund-${orderId}`)) {
      throw new Error("duplicate key value violates unique constraint \"wallet_transactions_idempotency_key_key\"");
    }

    let balance = this.getWalletBalance();
    balance += amount;
    localStorage.setItem(WALLET_BALANCE_KEY, balance.toString());

    txs.unshift({
      id: "WTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      amount: amount,
      type: "credit",
      description: description || `Refund for Order #${orderId}`,
      idempotencyKey: `refund-${orderId}`,
    });
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(txs));
  },

  getLoyaltyPoints(): number {
    if (!isBrowser()) return 0;
    this.init();
    return parseInt(localStorage.getItem(LOYALTY_POINTS_KEY) || "0");
  },

  getLoyaltyTransactions(): LoyaltyTransaction[] {
    if (!isBrowser()) return [];
    this.init();
    return JSON.parse(localStorage.getItem(LOYALTY_TX_KEY) || "[]");
  },

  getLoyaltyData() {
    return {
      points: this.getLoyaltyPoints(),
      transactions: this.getLoyaltyTransactions(),
    };
  },

  applyLoyaltyDebit(points: number, orderId: string): { success: boolean; error?: string } {
    if (!isBrowser()) return { success: false, error: "SSR Environment" };

    const txs = this.getLoyaltyTransactions();
    if (txs.some(t => t.idempotencyKey === orderId)) {
      throw new Error("duplicate key value violates unique constraint \"loyalty_transactions_idempotency_key_key\"");
    }

    let balance = this.getLoyaltyPoints();
    if (points > balance) {
      return { success: false, error: "Insufficient loyalty points balance." };
    }
    balance -= points;
    localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

    txs.unshift({
      id: "LTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      points: points,
      type: "debit",
      description: `Redeemed on Order #${orderId}`,
      idempotencyKey: orderId,
    });
    localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
    return { success: true };
  },

  awardLoyaltyPoints(total: number, orderId: string) {
    if (!isBrowser()) return;

    const txs = this.getLoyaltyTransactions();
    if (txs.some(t => t.idempotencyKey === `earn-${orderId}`)) {
      return; // Deduplicate earning
    }

    const points = Math.floor(total / 10);
    if (points <= 0) return;
    let balance = this.getLoyaltyPoints();
    balance += points;
    localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

    txs.unshift({
      id: "LTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      points: points,
      type: "credit",
      description: `Earned on Order #${orderId}`,
      idempotencyKey: `earn-${orderId}`,
    });
    localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
  },

  applyLoyaltyCredit(points: number, description: string, orderId: string) {
    if (!isBrowser()) return;

    const txs = this.getLoyaltyTransactions();
    if (txs.some(t => t.idempotencyKey === `refund-${orderId}`)) {
      throw new Error("duplicate key value violates unique constraint \"loyalty_transactions_idempotency_key_key\"");
    }

    let balance = this.getLoyaltyPoints();
    balance += points;
    localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

    txs.unshift({
      id: "LTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      points: points,
      type: "credit",
      description: description || `Refund for Order #${orderId}`,
      idempotencyKey: `refund-${orderId}`,
    });
    localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
  },

  requestManualReturn(orderId: string, payload: { reason: string; details: string; image: string; refundOption: string }) {
    if (!isBrowser()) return false;
    const orders = this.getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    if (order.status === "Returned" || order.status === "Return Requested") return false;

    order.status = "Return Requested";
    order.returnReason = payload.reason;
    order.returnDetails = payload.details;
    order.returnImage = payload.image;
    order.refundOption = payload.refundOption;
    order.returnRequestDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    orders[orderIndex] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  },

  approveReturnPickup(orderId: string) {
    if (!isBrowser()) return false;
    const orders = this.getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    order.status = "Return in Transit";
    orders[orderIndex] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  },

  processReturnRefund(orderId: string, qualityCheckPassed = true) {
    if (!isBrowser()) return false;
    const orders = this.getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    order.status = "Returned";
    order.returnDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    order.qualityCheckPassed = qualityCheckPassed;

    const products = this.getProducts();
    if (qualityCheckPassed && order.items && Array.isArray(order.items)) {
      order.items.forEach((itemName) => {
        const product = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase());
        if (product) {
          product.stock = (product.stock || 0) + 1;
        }
      });
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    }

    if (order.refundOption === "wallet") {
      const refundAmount = order.gatewayPaid !== undefined ? order.gatewayPaid + order.walletPaid : order.total;
      this.applyWalletCredit(refundAmount, `Manual Return Credit for Order #${orderId}`, orderId);
    } else {
      if (order.walletPaid && order.walletPaid > 0) {
        this.applyWalletCredit(order.walletPaid, `Refund of Wallet Portion for Order #${orderId}`, orderId);
      }
      const bankRefund = order.gatewayPaid !== undefined ? order.gatewayPaid : order.total - (order.walletPaid || 0);
      console.log(`[Refund simulation] Refunded ₹${bankRefund} to bank account for Order #${orderId}`);
    }

    const pointsEarned = order.pointsEarned !== undefined ? order.pointsEarned : Math.floor(order.total / 10);
    if (pointsEarned > 0) {
      let balance = this.getLoyaltyPoints();
      balance = Math.max(0, balance - pointsEarned);
      localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

      const txs = this.getLoyaltyTransactions();
      txs.unshift({
        id: "LTX-" + Date.now(),
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        points: pointsEarned,
        type: "debit",
        description: `Revoked for Returned Order #${orderId}`,
      });
      localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
    }

    if (order.pointsRedeemed && order.pointsRedeemed > 0) {
      let balance = this.getLoyaltyPoints();
      balance += order.pointsRedeemed;
      localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

      const txs = this.getLoyaltyTransactions();
      txs.unshift({
        id: "LTX-" + (Date.now() + 1),
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        points: order.pointsRedeemed,
        type: "credit",
        description: `Restored for Returned Order #${orderId}`,
      });
      localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
    }

    orders[orderIndex] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  },

  rejectReturn(orderId: string, rejectReason: string) {
    if (!isBrowser()) return false;
    const orders = this.getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    order.status = "Return Rejected";
    order.returnRejectReason = rejectReason;
    orders[orderIndex] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  },

  cancelOrderAndRefund(orderId: string) {
    if (!isBrowser()) return false;
    const orders = this.getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    if (order.status === "Cancelled") return false;

    order.status = "Cancelled";

    // 1. Restock items back into inventory
    const products = this.getProducts();
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((itemName) => {
        const product = products.find((p) => p.title.toLowerCase() === itemName.toLowerCase());
        if (product) {
          product.stock = (product.stock || 0) + 1;
        }
      });
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    }

    // 2. Process refund: Wallet Paid goes back to wallet. Gateway Paid goes back to bank (simulated)
    const walletPaid = Number(order.walletPaid || 0);
    const gatewayPaid = Number(order.gatewayPaid || 0);

    if (walletPaid > 0) {
      this.applyWalletCredit(walletPaid, `Refund of Wallet Portion for Cancelled Order #${orderId}`, orderId);
    }
    if (gatewayPaid > 0) {
      console.log(`[Refund simulation] Refunded ₹${gatewayPaid} to bank account for Cancelled Order #${orderId}`);
    }

    // 3. Revoke earned loyalty points
    const pointsEarned = Number(order.pointsEarned || 0);
    if (pointsEarned > 0) {
      let balance = this.getLoyaltyPoints();
      balance = Math.max(0, balance - pointsEarned);
      localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

      const txs = this.getLoyaltyTransactions();
      txs.unshift({
        id: "LTX-" + Date.now(),
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        points: pointsEarned,
        type: "debit",
        description: `Revoked for Cancelled Order #${orderId}`,
      });
      localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
    }

    // 4. Restore redeemed loyalty points
    const pointsRedeemed = Number(order.pointsRedeemed || 0);
    if (pointsRedeemed > 0) {
      let balance = this.getLoyaltyPoints();
      balance += pointsRedeemed;
      localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

      const txs = this.getLoyaltyTransactions();
      txs.unshift({
        id: "LTX-" + (Date.now() + 1),
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        points: pointsRedeemed,
        type: "credit",
        description: `Restored for Cancelled Order #${orderId}`,
      });
      localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
    }

    orders[orderIndex] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  },

  approvePendingOrder(orderId: string) {
    if (!isBrowser()) return false;
    const orders = this.getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = orders[orderIndex];
    if (order.status !== "Payment Pending") return false;

    order.status = "Paid";
    orders[orderIndex] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  },



  relatedProducts(slug: string): Product[] {
    const products = this.getProducts();
    const current = products.find((p) => p.slug === slug);
    if (!current) return products.slice(0, 4);
    const otherProducts = products.filter((p) => p.slug !== slug && !!p.isGenz === !!current.isGenz);
    const sameCategory = otherProducts.filter((p) => p.category === current.category);
    const diffCategory = otherProducts.filter((p) => p.category !== current.category);
    return [...sameCategory, ...diffCategory].slice(0, 4);
  },

  verifyStock(items: any[]): { success: boolean; message?: string } {
    const products = this.getProducts();
    const demand: { [key: string]: { [size: string]: number } } = {};
    
    items.forEach((item) => {
      const name = item.productName;
      const size = item.size || "M";
      if (!demand[name]) demand[name] = {};
      demand[name][size] = (demand[name][size] || 0) + 1;
    });

    for (const name in demand) {
      const product = products.find((p) => p.title.toLowerCase() === name.toLowerCase());
      if (!product) {
        return { success: false, message: `Product "${name}" not found in catalog.` };
      }
      for (const size in demand[name]) {
        const available = product.sizeStock?.[size as keyof typeof product.sizeStock] || 0;
        const requested = demand[name][size];
        if (available < requested) {
          return {
            success: false,
            message: `Insufficient stock for ${product.title} in size ${size}. Available: ${available}, Requested: ${requested}.`
          };
        }
      }
    }
    return { success: true };
  },

  deductStock(items: any[]) {
    const products = this.getProducts();
    items.forEach((item) => {
      const product = products.find((p) => p.title.toLowerCase() === item.productName.toLowerCase());
      if (product && product.sizeStock) {
        const size = item.size || "M";
        const currentSizeStock = product.sizeStock[size as keyof typeof product.sizeStock] || 0;
        product.sizeStock[size as keyof typeof product.sizeStock] = Math.max(0, currentSizeStock - 1);
        product.stock = Math.max(0, (product.stock || 0) - 1);
      }
    });
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  getAddresses(userId?: string): UserAddress[] {
    if (!isBrowser()) return [];
    this.init();
    const addresses = JSON.parse(localStorage.getItem(ADDRESSES_KEY) || "[]") as UserAddress[];
    if (userId) {
      return addresses.filter(a => a.user_id === userId);
    }
    return addresses;
  },

  saveAddress(address: Partial<UserAddress>): UserAddress {
    if (!isBrowser()) throw new Error("Browser only");
    const addresses = this.getAddresses();
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
      addresses.forEach(a => {
        if (a.user_id === newAddress.user_id) a.is_default = false;
      });
    } else if (addresses.filter(a => a.user_id === newAddress.user_id).length === 0) {
      newAddress.is_default = true;
    }

    const existingIndex = addresses.findIndex(a => a.id === newAddress.id);
    if (existingIndex !== -1) {
      addresses[existingIndex] = newAddress;
    } else {
      addresses.unshift(newAddress);
    }
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
    return newAddress;
  },

  deleteAddress(id: string) {
    if (!isBrowser()) return;
    const addresses = this.getAddresses().filter((a) => a.id !== id);
    // if deleted was default, make another one default
    const defaults = addresses.filter(a => a.is_default);
    if (defaults.length === 0 && addresses.length > 0) {
      addresses[0].is_default = true;
    }
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
  },

  setDefaultAddress(id: string, userId: string) {
    if (!isBrowser()) return;
    const addresses = this.getAddresses();
    addresses.forEach(a => {
      if (a.user_id === userId) {
        a.is_default = (a.id === id);
      }
    });
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
  },

  getOrderStatusHistory(orderId: string): OrderStatusHistory[] {
    if (!isBrowser()) return [];
    this.init();
    const history = JSON.parse(localStorage.getItem(ORDER_STATUS_HISTORY_KEY) || "[]") as OrderStatusHistory[];
    return history.filter(h => h.order_id === orderId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  addOrderStatusHistory(orderId: string, status: string, updatedBy?: string, metadata?: any): OrderStatusHistory {
    if (!isBrowser()) throw new Error("Browser only");
    this.init();
    const history = JSON.parse(localStorage.getItem(ORDER_STATUS_HISTORY_KEY) || "[]") as OrderStatusHistory[];
    const entry: OrderStatusHistory = {
      id: "OSH-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
      order_id: orderId,
      status,
      updated_by: updatedBy || "system",
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    history.push(entry);
    localStorage.setItem(ORDER_STATUS_HISTORY_KEY, JSON.stringify(history));
    return entry;
  },

  getShipments(): Shipment[] {
    if (!isBrowser()) return [];
    this.init();
    return JSON.parse(localStorage.getItem(SHIPMENTS_KEY) || "[]") as Shipment[];
  },

  getShipmentByOrderId(orderId: string): Shipment | null {
    const shipments = this.getShipments();
    return shipments.find(s => s.order_id === orderId) || null;
  },

  getShipmentEvents(shipmentId: string): ShipmentEvent[] {
    if (!isBrowser()) return [];
    this.init();
    const events = JSON.parse(localStorage.getItem(SHIPMENT_EVENTS_KEY) || "[]") as ShipmentEvent[];
    return events.filter(e => e.shipment_id === shipmentId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  saveShipment(shipment: Partial<Shipment>): Shipment {
    if (!isBrowser()) throw new Error("Browser only");
    this.init();
    const shipments = this.getShipments();
    const newShipment: Shipment = {
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

    const existingIndex = shipments.findIndex(s => s.id === newShipment.id || (newShipment.awb_code && s.awb_code === newShipment.awb_code) || (newShipment.order_id && s.order_id === newShipment.order_id));
    if (existingIndex !== -1) {
      shipments[existingIndex] = { ...shipments[existingIndex], ...newShipment, updated_at: new Date().toISOString() };
    } else {
      shipments.unshift(newShipment);
    }
    localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(shipments));
    return newShipment;
  },

  saveShipmentEvent(event: Partial<ShipmentEvent>): ShipmentEvent {
    if (!isBrowser()) throw new Error("Browser only");
    this.init();
    const events = JSON.parse(localStorage.getItem(SHIPMENT_EVENTS_KEY) || "[]") as ShipmentEvent[];
    const newEvent: ShipmentEvent = {
      id: event.id || "EVT-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      shipment_id: event.shipment_id || "",
      status: event.status || "",
      activity: event.activity || "",
      location: event.location || "",
      timestamp: event.timestamp || new Date().toISOString()
    };
    events.push(newEvent);
    localStorage.setItem(SHIPMENT_EVENTS_KEY, JSON.stringify(events));
    return newEvent;
  },

  saveTrackingLog(log: { shipment_id: string; raw_payload: any }): void {
    if (!isBrowser()) return;
    this.init();
    const logs = JSON.parse(localStorage.getItem(TRACKING_LOGS_KEY) || "[]") as TrackingLog[];
    logs.push({
      id: "LOG-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      shipment_id: log.shipment_id,
      raw_payload: log.raw_payload,
      created_at: new Date().toISOString()
    });
    localStorage.setItem(TRACKING_LOGS_KEY, JSON.stringify(logs));
  },

};
