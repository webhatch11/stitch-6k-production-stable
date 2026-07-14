"use server";

import { db } from "@/lib/db";
import { Product } from "@/lib/types";
import { getServerUser } from "@/lib/supabase-server";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { calculateShipping } from "@/lib/shipping";
import { headers } from "next/headers";
import { CacheService } from "@/lib/cache";

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
      error: "Cart is empty. Add items before checkout." 
    };
  }

  const loyaltyConfig = await db.getLoyaltyConfig();
  const RUPEES_PER_POINT = loyaltyConfig.rupeesPerPoint;
  const POINTS_PER_100 = loyaltyConfig.pointsPer100;

  if (!addressId) {
    return { success: false, error: "Delivery address is required" };
  }

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

  // B. Recalculate totals server-side to prevent tampering
  const productIds = cart.map(item => item.productId).filter(Boolean) as string[];
  const products = await db.getProductsByIds(productIds);
  let verifiedSubtotal = 0;
  for (const item of cart) {
    const dbProduct = products.find(p => p.title.toLowerCase() === item.productName.toLowerCase());
    if (!dbProduct) {
      return { success: false, error: `Product "${item.productName}" not found.` };
    }
    verifiedSubtotal += dbProduct.price;
  }

  // Guard 2: Verified subtotal must be > 0
  if (verifiedSubtotal <= 0) {
    return {
      success: false,
      error: "Order total must be greater than ₹0."
    };
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

  // C. Check Idempotency Key (prevent duplicate orders)
  const existingOrder = await db.getOrderByIdempotencyKey(idempotencyKey);
  if (existingOrder) {
    return { 
      success: true, 
      orderId: existingOrder.id, 
      order: existingOrder,
      alreadyExists: true,
      message: "Order already processed."
    };
  }

  // D. Deduct inventory stock server-side
  const stockOk = await db.deductStock(cart, idempotencyKey);
  if (!stockOk) {
    return { success: false, error: "Deduct stock failed. One or more items in your cart became unavailable. Please reload the page." };
  }

  // E. Debit balances server-side with rollback support
  if (walletDeduction > 0) {
    const res = await db.applyWalletDebit(walletDeduction, idempotencyKey, userId);
    if (!res.success) {
      await db.restoreStock(cart, idempotencyKey);
      return { success: false, error: res.error || "Failed to deduct wallet balance." };
    }
  }

  if (pointsRedeemed > 0) {
    const res = await db.applyLoyaltyDebit(pointsRedeemed, idempotencyKey, userId);
    if (!res.success) {
      if (walletDeduction > 0) {
        await db.applyWalletCredit(walletDeduction, `Rollback for failed checkout #${idempotencyKey}`, idempotencyKey, userId);
      }
      await db.restoreStock(cart, idempotencyKey);
      return { success: false, error: res.error || "Failed to redeem loyalty points." };
    }
  }

  // Increment coupon usage
  if (couponCode) {
    const ok = await db.incrementCouponUsage(couponCode);
    if (!ok) {
      if (pointsRedeemed > 0) {
        await db.applyLoyaltyCredit(pointsRedeemed, `Rollback for failed checkout #${idempotencyKey}`, idempotencyKey, userId);
      }
      if (walletDeduction > 0) {
        await db.applyWalletCredit(walletDeduction, `Rollback for failed checkout #${idempotencyKey}`, idempotencyKey, userId);
      }
      await db.restoreStock(cart, idempotencyKey);
      return { success: false, error: "Failed to apply coupon usage count." };
    }
  }

  // Schedule loyalty points for credit 7 days from now
  const creditAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.saveOrder({
    id: idempotencyKey,
    pointsCreditStatus: 'pending',
    pointsCreditScheduledAt: creditAt
  });

  // F. Save Order server-side
  const orderData = {
    id: idempotencyKey,
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
    status: "Paid via Wallet",
    paymentStatus: "Paid",
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
  };

  let savedOrder;
  try {
    savedOrder = await db.saveOrder(orderData);
  } catch (err) {
    console.error('[checkout.ts]:', err);
    if (couponCode) {
      await db.decrementCouponUsage(couponCode);
    }
    if (pointsRedeemed > 0) {
      await db.applyLoyaltyCredit(pointsRedeemed, `Rollback for failed order save #${idempotencyKey}`, idempotencyKey, userId);
    }
    if (walletDeduction > 0) {
      await db.applyWalletCredit(walletDeduction, `Rollback for failed order save #${idempotencyKey}`, idempotencyKey, userId);
    }
    await db.restoreStock(cart, idempotencyKey);
    return { success: false, error: "Failed to record checkout order in database." };
  }

  // BUG FIX 1 & 4 — Dispatch fulfillment, create events, and send confirmation email
  try {
    await db.createOrderEvent(savedOrder.id, "Order Placed");
    await db.createOrderEvent(savedOrder.id, "Order placed via wallet");
  } catch (eventErr) {
    console.error('[processWalletPointsCheckoutAction] Order event creation failed:', eventErr);
  }

  try {
    await db.dispatchFulfillment(savedOrder.id);
  } catch (dispatchError) {
    console.error(
      '[processWalletPointsCheckoutAction] ' +
      'Shiprocket dispatch failed:', dispatchError
    );
  }

  try {
    const { sendOrderConfirmationEmail } = await import('@/lib/email');
    const customerEmail = user.email || "";
    const addressStr = addressSnapshot
      ? [addressSnapshot.name, addressSnapshot.phone, addressSnapshot.address_line_1, addressSnapshot.address_line_2, `${addressSnapshot.city} - ${addressSnapshot.postal_code}`, addressSnapshot.state, addressSnapshot.country]
          .filter(Boolean)
          .join(", ")
      : "No address details available";

    await sendOrderConfirmationEmail({
      id: savedOrder.id,
      customerName: addressSnapshot?.name || user.email || 'Customer',
      customerEmail: customerEmail,
      items: cart.map(item => ({
        productName: item.productName,
        size: item.size || "Free Size",
        quantity: (item as any).quantity || 1,
        price: Number(item.price || 0)
      })),
      total: Number(verifiedNetTotal + shippingAmount),
      address: addressStr,
      couponCode: couponCode || null,
      couponDiscount: Number(verifiedCouponDiscount || 0)
    });
  } catch (emailError) {
    console.error(
      '[processWalletPointsCheckoutAction] ' +
      'Confirmation email failed:', emailError
    );
  }

  return {
    success: true,
    orderId: savedOrder.id,
    order: savedOrder,
    walletBalance: dbWalletBalance - walletDeduction,
    loyaltyPoints: dbLoyaltyPoints - pointsRedeemed + Math.floor(verifiedNetTotal / 100) * POINTS_PER_100,
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
  } = payload;

  // Identity comes from the server session only. Checkout requires login.
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized: login required for checkout." };
  }
  if (payload.userId && payload.userId !== user.id) {
    return { success: false, error: "Security Alert: session/user mismatch." };
  }
  const userId = user.id;

  const loyaltyConfig = await db.getLoyaltyConfig();
  const RUPEES_PER_POINT = loyaltyConfig.rupeesPerPoint;
  const POINTS_PER_100 = loyaltyConfig.pointsPer100;

  const finalWalletDeduction = walletDeduction;
  const finalPointsRedeemed = pointsRedeemed;

  // 0. Resolve and snapshot delivery address (must be one of the user's saved addresses)
  if (!addressId) {
    return { success: false, error: "Delivery address details are required for checkout." };
  }
  let addressSnapshot: any = null;
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

  // A. Verify stock first
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // B. Recalculate totals
  const productIds = cart.map(item => item.productId).filter(Boolean) as string[];
  const products = await db.getProductsByIds(productIds);
  let verifiedSubtotal = 0;
  for (const item of cart) {
    const dbProduct = products.find(p => p.title.toLowerCase() === item.productName.toLowerCase());
    if (!dbProduct) {
      return { success: false, error: `Product "${item.productName}" not found.` };
    }
    verifiedSubtotal += dbProduct.price;
  }

  let verifiedCouponDiscount = 0;
  if (couponCode) {
    const couponRes = await db.validateCoupon(couponCode, verifiedSubtotal, userId, cart);
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
    return { success: false, error: "Security Alert: Wallet deduction exceeds available balance." };
  }
  if (finalPointsRedeemed > dbLoyaltyPoints) {
    return { success: false, error: "Security Alert: Loyalty points redeemed exceed available points." };
  }

  const verifiedPointsDiscount = finalPointsRedeemed * RUPEES_PER_POINT; // 1 point = ₹0.50 discount
  const shippingRules = await db.getShippingRules();
  const shippingAmount = calculateShipping(verifiedNetTotal, shippingRules);
  const totalWithShipping = verifiedNetTotal + shippingAmount;
  const verifiedFinalPayable = Math.max(0, totalWithShipping - verifiedPointsDiscount - finalWalletDeduction);

  if (verifiedFinalPayable > 0 && verifiedFinalPayable < 1) {
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

// 3. Process Cash on Delivery Checkout Action
export async function processCodCheckoutAction(payload: {
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
  pincode: string;
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
    pincode,
    utm_source,
    utm_medium,
    utm_campaign,
  } = payload;

  // Identity from server session only. Checkout requires login.
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Unauthorized: login required for checkout." };
  }
  if (payload.userId && payload.userId !== user.id) {
    return { success: false, error: "Security Alert: session/user mismatch." };
  }
  const userId = user.id;
  const user_id = user.id;

  const loyaltyConfig = await db.getLoyaltyConfig();
  const RUPEES_PER_POINT = loyaltyConfig.rupeesPerPoint;
  const POINTS_PER_100 = loyaltyConfig.pointsPer100;

  const finalWalletDeduction = walletDeduction;
  const finalPointsRedeemed = pointsRedeemed;

  // 0. Resolve and snapshot delivery address (must be one of the user's saved addresses)
  if (!addressId) {
    return { success: false, error: "Delivery address details are required for checkout." };
  }
  let addressSnapshot: any = null;
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

  // A. Verify COD eligibility rules server-side
  const finalPayable = Math.max(0, netTotal - (finalPointsRedeemed * RUPEES_PER_POINT) - finalWalletDeduction); // 1 point = ₹0.50
  
  // B. Verify stock first server-side
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // C. Recalculate totals server-side to prevent tampering
  const productIds = cart.map(item => item.productId).filter(Boolean) as string[];
  const products = await db.getProductsByIds(productIds);
  let verifiedSubtotal = 0;
  for (const item of cart) {
    const dbProduct = products.find(p => p.title.toLowerCase() === item.productName.toLowerCase());
    if (!dbProduct) {
      return { success: false, error: `Product "${item.productName}" not found.` };
    }
    verifiedSubtotal += dbProduct.price;
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

  // Check wallet and loyalty points balances (only if logged in)
  const dbWalletBalance = user ? await db.getWalletBalance(userId!) : 0;
  const dbLoyaltyPoints = user ? await db.getLoyaltyPoints(userId!) : 0;

  // Validate that deductions don't exceed actual balances
  if (finalWalletDeduction > dbWalletBalance) {
    return { success: false, error: "Security Alert: Wallet deduction exceeds available balance." };
  }
  if (finalPointsRedeemed > dbLoyaltyPoints) {
    return { success: false, error: "Security Alert: Loyalty points redeemed exceed available points." };
  }

  const shippingRules = await db.getShippingRules();
  const shippingAmount = calculateShipping(verifiedNetTotal, shippingRules);
  const totalWithShipping = verifiedNetTotal + shippingAmount;
  const verifiedPointsDiscount = finalPointsRedeemed * RUPEES_PER_POINT; // 1 point = ₹0.50 discount
  const verifiedFinalPayable = Math.max(0, totalWithShipping - verifiedPointsDiscount - finalWalletDeduction);

  const { evaluateCodRules } = await import("@/lib/codRules");
  const codCheck = evaluateCodRules({
    pincode,
    orderTotal: verifiedFinalPayable,
    customerEmail: user ? user.email || userId : "guest@6kthebrand.com",
  });

  if (!codCheck.allowed) {
    return { success: false, error: codCheck.reason || "COD is not allowed." };
  }

  // Check Idempotency Key (prevent duplicate orders)
  const existingOrder = await db.getOrderByIdempotencyKey(idempotencyKey);
  if (existingOrder) {
    return { 
      success: true, 
      orderId: existingOrder.id, 
      order: existingOrder,
      alreadyExists: true,
      message: "Order already processed."
    };
  }

  // D. Deduct inventory stock server-side
  const stockOk = await db.deductStock(cart, idempotencyKey);
  if (!stockOk) {
    return { success: false, error: "Deduct stock failed. One or more items in your cart became unavailable. Please reload the page." };
  }

  // E. Debit balances server-side with rollback support (only if logged in)
  if (user && finalWalletDeduction > 0) {
    const res = await db.applyWalletDebit(finalWalletDeduction, idempotencyKey, userId!);
    if (!res.success) {
      await db.restoreStock(cart, idempotencyKey);
      return { success: false, error: res.error || "Failed to deduct wallet balance." };
    }
  }

  if (user && finalPointsRedeemed > 0) {
    const res = await db.applyLoyaltyDebit(finalPointsRedeemed, idempotencyKey, userId!);
    if (!res.success) {
      if (finalWalletDeduction > 0) {
        await db.applyWalletCredit(finalWalletDeduction, `Rollback for failed checkout #${idempotencyKey}`, idempotencyKey, userId!);
      }
      await db.restoreStock(cart, idempotencyKey);
      return { success: false, error: res.error || "Failed to redeem loyalty points." };
    }
  }

  // Increment coupon usage
  if (couponCode) {
    const ok = await db.incrementCouponUsage(couponCode);
    if (!ok) {
      if (user && finalPointsRedeemed > 0) {
        await db.applyLoyaltyCredit(finalPointsRedeemed, `Rollback for failed checkout #${idempotencyKey}`, idempotencyKey, userId!);
      }
      if (user && finalWalletDeduction > 0) {
        await db.applyWalletCredit(finalWalletDeduction, `Rollback for failed checkout #${idempotencyKey}`, idempotencyKey, userId!);
      }
      await db.restoreStock(cart, idempotencyKey);
      return { success: false, error: "Failed to apply coupon usage count." };
    }
  }

  // Award new loyalty points (only if logged in)
  if (user) {
    const creditAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.saveOrder({
      id: idempotencyKey,
      pointsCreditStatus: 'pending',
      pointsCreditScheduledAt: creditAt
    });
  }

  // F. Save Order server-side
  const orderData = {
    id: idempotencyKey,
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
    walletPaid: finalWalletDeduction,
    gatewayPaid: 0,
    pointsRedeemed: finalPointsRedeemed,
    pointsDiscount: verifiedPointsDiscount,
    pointsEarned: user ? Math.floor(verifiedNetTotal / 100) * POINTS_PER_100 : 0, // Business rule: ₹100 spent = 5 points
    status: "Order Placed",
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
  };

  let savedOrder;
  try {
    savedOrder = await db.saveOrder(orderData);

    // Add status history entry
    await db.addOrderStatusHistory(idempotencyKey, "Order Placed", "COD Checkout System", {
      payment_method: "COD",
      amount_to_collect: verifiedFinalPayable
    });
  } catch (err) {
    console.error('[checkout.ts]:', err);
    if (couponCode) {
      await db.decrementCouponUsage(couponCode);
    }
    if (user && finalPointsRedeemed > 0) {
      await db.applyLoyaltyCredit(finalPointsRedeemed, `Rollback for failed order save #${idempotencyKey}`, idempotencyKey, userId!);
    }
    if (user && finalWalletDeduction > 0) {
      await db.applyWalletCredit(finalWalletDeduction, `Rollback for failed order save #${idempotencyKey}`, idempotencyKey, userId!);
    }
    await db.restoreStock(cart, idempotencyKey);
    return { success: false, error: "Failed to record checkout order in database." };
  }

  const updatedWallet = await db.getWalletBalance(userId);
  const updatedLoyalty = await db.getLoyaltyPoints(userId);

  return {
    success: true,
    orderId: savedOrder.id,
    order: savedOrder,
    walletBalance: updatedWallet,
    loyaltyPoints: updatedLoyalty,
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

