"use server";

import { db } from "@/lib/db";
import { Product } from "@/lib/types";
import { getServerUser } from "@/lib/supabase-server";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { calculateShipping } from "@/lib/shipping";
import { headers } from "next/headers";
import { CacheService } from "@/lib/cache";
import { paymentDebugLog } from "@/lib/payment-debug";
import { processOutbox } from "@/lib/jobs/outbox";

interface CartItem {
  productId?: string;
  productName: string;
  price: number;
  size: string;
  image: string;
  color?: string;
}

// 1. Process Wallet and Points Checkout Action (finalPayable === 0)
export async function processWalletPointsCheckoutAction(payload: {
  cart: CartItem[];
  couponCode: string;
  walletDeduction: number;
  pointsRedeemed: number;
  loyaltyDiscount: number;
  baseTotal: number;
  netTotal: number;
  customerName: string;
  idempotencyKey: string;
  addressId?: string;
  userId?: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}) {
  const {
    cart,
    couponCode,
    walletDeduction,
    pointsRedeemed,
    loyaltyDiscount,
    baseTotal,
    netTotal,
    customerName,
    idempotencyKey,
    addressId,
    utm_source,
    utm_medium,
    utm_campaign,
  } = payload;

  // Wallet/points checkout debits real balances — the identity MUST come from
  // the server session, never from the client payload.
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized: login required for checkout." };
  }
  if (payload.userId && payload.userId !== user.id) {
    return { success: false, error: "Security Alert: session/user mismatch." };
  }
  const userId = user.id;
  const user_id = user.id;


  // Guard 1: Cart must not be empty
  if (!payload.cart || payload.cart.length === 0) {
    return { 
      success: false, 
      error: 'Cart is empty. Add items before checkout.' 
    };
  }

  // Guard 2: Cart items have valid products
  const productIds = payload.cart.map((i: any) => i.productId).filter(Boolean) as string[];
  if (productIds.length === 0) {
    return {
      success: false,
      error: 'No valid products in cart'
    };
  }

  // Guard 3: Verify products exist in DB
  const products = await db.getProductsByIds(productIds);
  if (products.length === 0) {
    return {
      success: false,
      error: 'Products not found'
    };
  }

  // Guard 4: Calculate and verify total > 0
  let verifiedSubtotal = 0;
  for (const item of payload.cart) {
    const dbProduct = products.find(p => p.id === item.productId || p.title.toLowerCase() === item.productName.toLowerCase());
    if (dbProduct) {
      verifiedSubtotal += dbProduct.price * ((item as any).quantity || 1);
    } else {
      return { success: false, error: `Product "${item.productName}" not found.` };
    }
  }

  if (verifiedSubtotal <= 0) {
    return {
      success: false,
      error: 'Order total must be greater than ₹0.'
    };
  }



  const loyaltyConfig = await db.getLoyaltyConfig();
  const RUPEES_PER_POINT = loyaltyConfig.rupeesPerPoint;
  const POINTS_PER_100 = loyaltyConfig.pointsPer100;

  // 0. Resolve and snapshot delivery address
  let addressSnapshot: any = null;
  if (addressId && userId) {
    const addr = await db.getAddressById(addressId, userId);
    if (!addr) {
      return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
    }
    let email = user.email || "";
    if (supabase) {
      try {
        const authResult = await supabase.auth.admin.getUserById(userId);
        if (authResult.data?.user?.email) {
          email = authResult.data.user.email;
        }
      } catch (err) {
        console.error("[Checkout] admin getUserById error:", err);
      }
    }
    addressSnapshot = { ...addr, email };
  }

  // A. Verify stock first server-side
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // Validate coupon
  let verifiedCouponDiscount = 0;
  if (couponCode) {
    const couponRes = await db.validateCoupon(couponCode, verifiedSubtotal, userId, cart);
    if (!couponRes.valid || !couponRes.coupon) {
      return { success: false, error: couponRes.error || "Invalid coupon code." };
    }
    verifiedCouponDiscount = couponRes.discountAmount || 0;
  }

  const verifiedNetTotal = Math.max(0, verifiedSubtotal - verifiedCouponDiscount);

  // Check wallet and loyalty points balances
  const dbWalletBalance = await db.getWalletBalance(userId);
  const dbLoyaltyPoints = await db.getLoyaltyPoints(userId);

  // Validate that deductions don't exceed actual balances
  if (walletDeduction > dbWalletBalance) {
    return { success: false, error: "Security Alert: Wallet deduction exceeds available balance." };
  }
  if (pointsRedeemed > dbLoyaltyPoints) {
    return { success: false, error: "Security Alert: Loyalty points redeemed exceed available points." };
  }

  // Ensure finalPayable is zero
  const verifiedPointsDiscount = pointsRedeemed * RUPEES_PER_POINT; // 1 point = ₹0.50 discount
  const shippingRules = await db.getShippingRules();
  const shippingAmount = calculateShipping(verifiedNetTotal, shippingRules);
  const totalWithShipping = verifiedNetTotal + shippingAmount;
  const verifiedFinalPayable = Math.max(0, totalWithShipping - verifiedPointsDiscount - walletDeduction);

  if (verifiedFinalPayable !== 0) {
    return { success: false, error: "Security Alert: Final payable is not zero for wallet checkout." };
  }

  // C. Check Idempotency Key (reuse pending order or short-circuit if already paid)
  const existingOrder = await db.getOrderByIdempotencyKey(idempotencyKey);
  let targetOrderId: string;

  if (existingOrder) {
    const isAlreadyPaid = ["Paid", "Paid via Wallet", "paid via wallet", "Accepted", "Processing", "Packed", "Shipped", "Delivered"].includes(existingOrder.status);
    if (isAlreadyPaid) {
      return { 
        success: true, 
        orderId: existingOrder.id, 
        order: existingOrder,
        alreadyExists: true,
        message: "Order already processed."
      };
    }
    // Existing order is in 'Payment Pending' state (from previous Razorpay attempt)
    // Reuse existing order ID to complete payment via Wallet!
    targetOrderId = existingOrder.id;
  } else {
    // D. Generate sequential order ID and save pending order
    targetOrderId = await db.generateOrderId('wallet');

    const orderData = {
      id: targetOrderId,
      idempotencyKey: idempotencyKey,
      customer: customerName,
      date: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
      total: totalWithShipping,
      shippingAmount: shippingAmount,
      shipping_amount: shippingAmount,
      originalTotal: verifiedSubtotal,
      couponDiscount: verifiedCouponDiscount,
      couponCode: couponCode,
      walletPaid: walletDeduction,
      gatewayPaid: 0,
      pointsRedeemed: pointsRedeemed,
      pointsDiscount: verifiedPointsDiscount,
      pointsEarned: Math.floor(verifiedNetTotal / 100) * POINTS_PER_100, // Business rule: ₹100 spent = 5 points
      status: "Payment Pending",
      paymentStatus: "Payment Pending",
      items: cart.map((item) => item.productName),
      cartItems: cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        size: item.size,
        color: item.color,
        quantity: (item as any).quantity || 1,
        image: item.image || (item as any).images?.[0] || ''
      })),
      address_snapshot: addressSnapshot,
      userId: user_id,
      user_id: user_id,
      utm_source: utm_source || undefined,
      utm_medium: utm_medium || undefined,
      utm_campaign: utm_campaign || undefined,
      pointsCreditStatus: 'pending' as const,
      pointsCreditScheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      await db.saveOrder(orderData);
    } catch (err) {
      console.error('[checkout.ts] Failed to save pending order:', err);
      return { success: false, error: "Failed to record checkout order in database." };
    }
  }

  // E. Execute Transactional Payment RPC on targetOrderId
  const earnedPoints = Math.floor(verifiedNetTotal / 100) * POINTS_PER_100;
  const transactionRes = await db.confirmOrderAndProcessPaymentsAtomic({
    orderId: targetOrderId,
    paymentId: "wallet-" + targetOrderId,
    walletDeduction: walletDeduction,
    pointsRedeemed: pointsRedeemed,
    couponCode: couponCode || "",
    earnedPoints: earnedPoints,
    method: "wallet"
  });

  if (!transactionRes.success) {
    console.error('[checkout.ts] Wallet transaction failed:', transactionRes.error);
    if (supabase) {
      await supabase.from("orders").update({
        status: "FAILED",
        payment_status: "FAILED"
      }).eq("id", targetOrderId);
    }
    return { success: false, error: transactionRes.error || "Payment transaction failed." };
  }

  // F. Trigger Async Outbox fast path
  processOutbox().catch(err => {
    console.error("[checkout.ts] Failed to process outbox in fast-path:", err);
  });

  // Fetch updated order record for client response
  const finalOrder = await db.getOrderById(targetOrderId);

  return {
    success: true,
    orderId: targetOrderId,
    order: finalOrder || { id: targetOrderId },
    walletBalance: dbWalletBalance - walletDeduction,
    loyaltyPoints: dbLoyaltyPoints - pointsRedeemed + earnedPoints,
  };
}

// 2. Verify and Prepare Gateway Checkout Action (finalPayable > 0)
export async function verifyAndPrepareGatewayCheckoutAction(payload: {
  cart: CartItem[];
  couponCode: string;
  walletDeduction: number;
  pointsRedeemed: number;
  loyaltyDiscount: number;
  baseTotal: number;
  netTotal: number;
  customerName: string;
  idempotencyKey: string;
  addressId?: string;
  userId?: string;
  traceId?: string;
}) {
  const {
    cart,
    couponCode,
    walletDeduction,
    pointsRedeemed,
    loyaltyDiscount,
    baseTotal,
    netTotal,
    customerName,
    idempotencyKey,
    addressId,
    traceId = "N/A"
  } = payload;

  paymentDebugLog({
    traceId,
    functionName: "verifyAndPrepareGatewayCheckoutAction",
    reason: "Starting gateway checkout verification and validation"
  });

  // Identity comes from the server session only. Checkout requires login.
  const user = await getServerUser();
  if (!user) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "User not authenticated",
      error: "Unauthorized: login required for checkout."
    });
    return { success: false, error: "Unauthorized: login required for checkout." };
  }
  if (payload.userId && payload.userId !== user.id) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "Security Alert: session/user mismatch",
      error: `payload.userId=${payload.userId} vs user.id=${user.id}`
    });
    return { success: false, error: "Security Alert: session/user mismatch." };
  }
  const userId = user.id;

  const finalWalletDeduction = walletDeduction;
  const finalPointsRedeemed = pointsRedeemed;

  // Guard 1: Cart must not be empty
  if (!payload.cart || payload.cart.length === 0) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "Empty cart guard failed",
      error: "Cart is empty."
    });
    return { 
      success: false, 
      error: 'Cart is empty. Add items before checkout.' 
    };
  }

  // Guard 2: Cart items have valid products
  const productIds = payload.cart.map((i: any) => i.productId).filter(Boolean) as string[];
  if (productIds.length === 0) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "No valid product IDs in cart",
      error: "No valid products in cart"
    });
    return {
      success: false,
      error: 'No valid products in cart'
    };
  }

  // Guard 3: Verify products exist in DB
  const products = await db.getProductsByIds(productIds);
  if (products.length === 0) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "Products lookup in DB returned 0 records",
      error: "Products not found"
    });
    return {
      success: false,
      error: 'Products not found'
    };
  }

  // Guard 4: Calculate and verify total > 0
  let verifiedSubtotal = 0;
  for (const item of payload.cart) {
    const dbProduct = products.find(p => p.id === item.productId || p.title.toLowerCase() === item.productName.toLowerCase());
    if (dbProduct) {
      verifiedSubtotal += dbProduct.price * ((item as any).quantity || 1);
    } else {
      paymentDebugLog({
        traceId,
        functionName: "verifyAndPrepareGatewayCheckoutAction",
        reason: "Product lookup mismatch in DB",
        error: `Product "${item.productName}" not found.`
      });
      return { success: false, error: `Product "${item.productName}" not found.` };
    }
  }

  if (verifiedSubtotal <= 0) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "verifiedSubtotal is zero or negative",
      error: "Order total must be greater than ₹0."
    });
    return {
      success: false,
      error: 'Order total must be greater than ₹0.'
    };
  }

  const loyaltyConfig = await db.getLoyaltyConfig();
  const RUPEES_PER_POINT = loyaltyConfig.rupeesPerPoint;
  const POINTS_PER_100 = loyaltyConfig.pointsPer100;

  // 0. Resolve and snapshot delivery address (must be one of the user's saved addresses)
  if (!addressId) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "AddressId missing",
      error: "Delivery address details are required for checkout."
    });
    return { success: false, error: "Delivery address details are required for checkout." };
  }
  let addressSnapshot: any = null;
  const addr = await db.getAddressById(addressId, userId);
  if (!addr) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "Invalid or unauthorized addressId",
      error: "Security Alert: Invalid or unauthorized delivery address."
    });
    return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
  }
  let email = user.email || "";
  if (supabase) {
    try {
      const authResult = await supabase.auth.admin.getUserById(userId);
      if (authResult.data?.user?.email) {
        email = authResult.data.user.email;
      }
    } catch (err) {
      console.error("[Checkout] admin getUserById error:", err);
    }
  }
  addressSnapshot = { ...addr, email };

  // A. Verify stock first
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  paymentDebugLog({
    traceId,
    functionName: "verifyAndPrepareGatewayCheckoutAction",
    reason: "Executed db.verifyStock RPC",
    rpc: "reserve_variant_inventory_batch_atomic",
    rpcResult: stockCheck.success ? "success" : "failed",
    error: stockCheck.success ? undefined : stockCheck.message
  });
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  let verifiedCouponDiscount = 0;
  if (couponCode) {
    const couponRes = await db.validateCoupon(couponCode, verifiedSubtotal, userId, cart);
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: `Executed db.validateCoupon for code: ${couponCode}`,
      metadata: { valid: couponRes.valid, error: couponRes.error }
    });
    if (!couponRes.valid || !couponRes.coupon) {
      return { success: false, error: couponRes.error || "Invalid coupon code." };
    }
    verifiedCouponDiscount = couponRes.discountAmount || 0;
  }

  const verifiedNetTotal = Math.max(0, verifiedSubtotal - verifiedCouponDiscount);

  // Validate balances
  const dbWalletBalance = await db.getWalletBalance(userId);
  const dbLoyaltyPoints = await db.getLoyaltyPoints(userId);

  if (finalWalletDeduction > dbWalletBalance) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "Wallet deduction exceeds DB balance",
      error: `deduction=${finalWalletDeduction} vs balance=${dbWalletBalance}`
    });
    return { success: false, error: "Security Alert: Wallet deduction exceeds available balance." };
  }
  if (finalPointsRedeemed > dbLoyaltyPoints) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "Loyalty points redemption exceeds DB points balance",
      error: `redemption=${finalPointsRedeemed} vs balance=${dbLoyaltyPoints}`
    });
    return { success: false, error: "Security Alert: Loyalty points redeemed exceed available points." };
  }

  const verifiedPointsDiscount = finalPointsRedeemed * RUPEES_PER_POINT; // 1 point = ₹0.50 discount
  const shippingRules = await db.getShippingRules();
  const shippingAmount = calculateShipping(verifiedNetTotal, shippingRules);
  const totalWithShipping = verifiedNetTotal + shippingAmount;
  const verifiedFinalPayable = Math.max(0, totalWithShipping - verifiedPointsDiscount - finalWalletDeduction);

  if (verifiedFinalPayable > 0 && verifiedFinalPayable < 1) {
    paymentDebugLog({
      traceId,
      functionName: "verifyAndPrepareGatewayCheckoutAction",
      reason: "finalPayable is less than ₹1 but greater than 0",
      error: "Minimum payable amount is ₹1"
    });
    return {
      success: false,
      error: "Minimum payable amount via Razorpay is ₹1. Please reduce wallet or points usage or pay the full amount via payment gateway."
    };
  }

  return {
    success: true,
    checkoutState: {
      customer: customerName,
      originalTotal: verifiedSubtotal,
      couponDiscount: verifiedCouponDiscount,
      couponCode: couponCode,
      netTotal: verifiedNetTotal,
      shippingAmount: shippingAmount,
      shipping_amount: shippingAmount,
      total: totalWithShipping,
      walletDeduction: finalWalletDeduction,
      pointsRedeemed: finalPointsRedeemed,
      pointsDiscount: verifiedPointsDiscount,
      finalPayable: verifiedFinalPayable,
      items: cart.map((item) => item.productName),
      cartItems: cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        size: item.size,
        color: item.color,
        quantity: (item as any).quantity || 1,
        image: item.image || (item as any).images?.[0] || ''
      })),
      idempotencyKey,
      userId,
      addressSnapshot,
    }
  };
}



export async function getLoyaltyAndWalletAction() {
  const user = await getServerUser();
  const userId = user?.id;
  const loyaltyPoints = await db.getLoyaltyPoints(userId);
  const walletBalance = await db.getWalletBalance(userId);
  return { success: true, loyaltyPoints, walletBalance };
}

export async function validateCouponAction(code: string, baseTotal: number, cartItems?: any[]) {
  try {
    const user = await getServerUser();
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for") || headerList.get("x-real-ip") || "127.0.0.1";
    const limitKey = user?.id ? `user:${user.id}:coupon` : `ip:${ip}:coupon`;

    const isAllowed = await CacheService.checkRateLimit(limitKey, 5, 60);
    if (!isAllowed) {
      return { success: false, error: "Too many coupon attempts. Please try again in a minute." };
    }

    let items = cartItems;
    if (!items && user?.id) {
      items = await db.getUserCart(user.id);
    }
    const res = await db.validateCoupon(code, baseTotal, user?.id, items);
    return { success: true, res };
  } catch (err: any) {
    console.error('[checkout.ts]:', err);
    return { success: false, error: err.message || "Failed to validate coupon" };
  }
}

export async function verifyStockAction(cart: any[]) {
  try {
    const res = await db.verifyStock(cart);
    return res;
  } catch (err: any) {
    console.error('[checkout.ts]:', err);
    return { success: false, message: err.message || "Failed to verify stock" };
  }
}

export async function devTestApplyWalletCreditAction(amount: number, desc: string, orderId: string, userId: string) {
  const isDev = process.env.NODE_ENV === 'development' 
    && process.env.ENABLE_DEV_TEST_ACTIONS === 'true';

  if (!isDev) {
    return { 
      success: false, 
      error: 'Dev test actions disabled' 
    };
  }
  await db.applyWalletCredit(amount, desc, orderId, userId);
  return { success: true };
}

export async function devTestApplyLoyaltyCreditAction(points: number, desc: string, orderId: string, userId: string) {
  const isDev = process.env.NODE_ENV === 'development' 
    && process.env.ENABLE_DEV_TEST_ACTIONS === 'true';

  if (!isDev) {
    return { 
      success: false, 
      error: 'Dev test actions disabled' 
    };
  }
  await db.applyLoyaltyCredit(points, desc, orderId, userId);
  return { success: true };
}

