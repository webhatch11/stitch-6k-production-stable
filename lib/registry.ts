"use client";

export interface Product {
  id: string;
  title: string;
  price: number;
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
}

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: "percent" | "flat";
  active: boolean;
}

export interface WalletTransaction {
  id: string;
  date: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
}

export interface LoyaltyTransaction {
  id: string;
  date: string;
  points: number;
  type: "credit" | "debit";
  description: string;
}

const PRODUCTS_KEY = "registry_products";
const ORDERS_KEY = "registry_orders";
const COUPONS_KEY = "registry_coupons";
const VERSION_KEY = "registry_version";
const WALLET_BALANCE_KEY = "registry_wallet_balance";
const WALLET_TX_KEY = "registry_wallet_transactions";
const LOYALTY_POINTS_KEY = "registry_loyalty_points";
const LOYALTY_TX_KEY = "registry_loyalty_transactions";
const CURRENT_VERSION = "3.0_ten_shirts";

const isBrowser = () => typeof window !== "undefined";

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
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }

    if (!localStorage.getItem(PRODUCTS_KEY)) {
      const seedProducts: Product[] = [
        {
          id: "seed-1",
          title: "Classic White Oxford",
          price: 1299,
          category: "Cotton",
          image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800"],
          isNew: true,
          stock: 45,
          description: "Immaculate tailoring in a standard weave.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 }
        },
        {
          id: "seed-2",
          title: "Midnight Blue Poplin",
          price: 1450,
          category: "Cotton",
          image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800"],
          isNew: true,
          stock: 30,
          description: "Comfortable organic poplin shirts in navy colorings.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 }
        },
        {
          id: "seed-3",
          title: "Sage Green Heritage",
          price: 1699,
          category: "Linen",
          image: "https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800"],
          isNew: true,
          stock: 15,
          description: "Traditional dyed green linen weave shirts.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 }
        },
        {
          id: "seed-4",
          title: "Charcoal Linen Series",
          price: 1850,
          category: "Linen",
          image: "https://images.unsplash.com/photo-1610652396593-60526715f3ac?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1610652396593-60526715f3ac?auto=format&fit=crop&q=80&w=800"],
          isNew: false,
          stock: 22,
          description: "Deep ash grey textured linen shirts.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 }
        },
        {
          id: "seed-5",
          title: "Burnt Ochre Twill",
          price: 1550,
          category: "Cotton",
          image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800"],
          isNew: false,
          stock: 50,
          description: "Vibrant cotton twill with a warm sunset coloring.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 }
        },
        {
          id: "seed-6",
          title: "Indigo Denim Shirt",
          price: 1999,
          category: "Denim",
          image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&q=80&w=800"],
          isNew: true,
          stock: 25,
          description: "Rugged blue denim tailored for casual comfort.",
          sizeStock: { S: 10, M: 12, L: 15, XL: 8, XXL: 5 }
        },
        {
          id: "seed-7",
          title: "Signature Noir Silk",
          price: 8999,
          category: "Silk",
          image: "/assets/noir_hero_bg.png",
          images: ["/assets/noir_hero_bg.png"],
          isNew: true,
          stock: 12,
          description: "Handcrafted in small batches from high-quality black silk-linen fabric.",
          isAtelierExclusive: true,
          sizeStock: { S: 2, M: 4, L: 4, XL: 2, XXL: 0 },
          specFabric: "Silk-Linen Blend",
          specFit: "Atelier Bespoke Fit",
          specCollar: "Italian Wide Spread",
          specSleeve: "Mitred Dual Cuffs",
          specCare: "Professional Dry Clean Only"
        },
        {
          id: "seed-8",
          title: "Crimson Chambray",
          price: 1750,
          category: "Cotton",
          image: "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=800"],
          isNew: true,
          stock: 20,
          description: "Vibrant crimson washed cotton chambray with premium stitching details.",
          sizeStock: { S: 5, M: 5, L: 5, XL: 3, XXL: 2 }
        },
        {
          id: "seed-9",
          title: "Belgian Flax Sand",
          price: 2100,
          category: "Linen",
          image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&q=80&w=800"],
          isNew: false,
          stock: 18,
          description: "Breathable sand beige natural flax linen tailored for standard luxury comfort.",
          sizeStock: { S: 4, M: 4, L: 4, XL: 4, XXL: 2 }
        },
        {
          id: "seed-10",
          title: "Royal Silk Weave",
          price: 7500,
          category: "Silk",
          image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800",
          images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800"],
          isNew: true,
          stock: 10,
          description: "Exclusive double-twisted silk blend shirt with a natural gold sheen and hand-finished seams.",
          isAtelierExclusive: true,
          sizeStock: { S: 2, M: 3, L: 3, XL: 2, XXL: 0 }
        }
      ];
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(seedProducts));
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
        { id: "CPN-1", code: "HERITAGE10", discount: 10, type: "percent", active: true },
        { id: "CPN-2", code: "LAUNCH500", discount: 500, type: "flat", active: true },
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
    if (!isBrowser()) return [];
    this.init();
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]");
  },

  saveProduct(product: Partial<Product>) {
    if (!isBrowser()) return;
    const products = this.getProducts();
    const images = product.images || [product.image || ""];
    const newProduct: Product = {
      id: product.id || "ART-" + Date.now(),
      title: product.title || "Untitled Product",
      price: product.price || 0,
      category: product.category || "Cotton",
      image: images[0],
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
    if (!isBrowser()) return { totalOrders: 0, totalRevenue: 0, inventoryCount: 0, walletLiability: 0, conversion: "4.2%" };
    const orders = this.getOrders();
    const activeOrders = orders.filter((o) => o.status !== "Returned");
    const products = this.getProducts();
    const revenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const walletLiability = this.getWalletBalance();

    return {
      totalOrders: activeOrders.length,
      totalRevenue: revenue,
      inventoryCount: products.length,
      walletLiability: walletLiability,
      conversion: "4.2%",
    };
  },

  saveOrder(order: Partial<Order>): Order {
    if (!isBrowser()) throw new Error("Browser only");
    const orders = this.getOrders();
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
    };
    orders.unshift(newOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    localStorage.setItem("cartCount", "0");
    localStorage.removeItem("cart_items");
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
    coupons.unshift({
      id: "CPN-" + Date.now(),
      code: (coupon.code || "CODE").toUpperCase(),
      discount: coupon.discount || 10,
      type: coupon.type || "percent",
      active: true,
    });
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
  },

  deleteCoupon(id: string) {
    if (!isBrowser()) return;
    const coupons = this.getCoupons().filter((c) => c.id !== id);
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
  },

  validateCoupon(code: string): Coupon | undefined {
    if (!isBrowser()) return undefined;
    const coupons = this.getCoupons();
    return coupons.find((c) => c.code.toUpperCase() === code.toUpperCase() && c.active);
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

  applyWalletDebit(amount: number, orderId: string) {
    if (!isBrowser()) return;
    let balance = this.getWalletBalance();
    balance -= amount;
    localStorage.setItem(WALLET_BALANCE_KEY, balance.toString());

    const txs = this.getWalletTransactions();
    txs.unshift({
      id: "WTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      amount: amount,
      type: "debit",
      description: `Payment for Order #${orderId}`,
    });
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(txs));
  },

  applyWalletCredit(amount: number, description: string, orderId: string) {
    if (!isBrowser()) return;
    let balance = this.getWalletBalance();
    balance += amount;
    localStorage.setItem(WALLET_BALANCE_KEY, balance.toString());

    const txs = this.getWalletTransactions();
    txs.unshift({
      id: "WTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      amount: amount,
      type: "credit",
      description: description || `Refund for Order #${orderId}`,
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

  applyLoyaltyDebit(points: number, orderId: string) {
    if (!isBrowser()) return;
    let balance = this.getLoyaltyPoints();
    balance = Math.max(0, balance - points);
    localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

    const txs = this.getLoyaltyTransactions();
    txs.unshift({
      id: "LTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      points: points,
      type: "debit",
      description: `Redeemed on Order #${orderId}`,
    });
    localStorage.setItem(LOYALTY_TX_KEY, JSON.stringify(txs));
  },

  awardLoyaltyPoints(total: number, orderId: string) {
    if (!isBrowser()) return;
    const points = Math.floor(total / 10);
    if (points <= 0) return;
    let balance = this.getLoyaltyPoints();
    balance += points;
    localStorage.setItem(LOYALTY_POINTS_KEY, balance.toString());

    const txs = this.getLoyaltyTransactions();
    txs.unshift({
      id: "LTX-" + Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      points: points,
      type: "credit",
      description: `Earned on Order #${orderId}`,
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

  resetPrototype() {
    if (!isBrowser()) return;
    localStorage.removeItem(PRODUCTS_KEY);
    localStorage.removeItem(ORDERS_KEY);
    localStorage.removeItem(COUPONS_KEY);
    localStorage.setItem("cartCount", "0");
    localStorage.removeItem("cart_items");
    localStorage.removeItem(WALLET_BALANCE_KEY);
    localStorage.removeItem(WALLET_TX_KEY);
    localStorage.removeItem(LOYALTY_POINTS_KEY);
    localStorage.removeItem(LOYALTY_TX_KEY);
    window.location.reload();
  },
};
