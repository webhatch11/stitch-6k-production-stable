"use server";

import { db } from "@/lib/db";
import { Product } from "@/lib/registry";
import { getServerUser } from "@/lib/supabase-server";
import { supabaseService as supabase } from "@/lib/supabase-service";

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
    userId,
  } = payload;

  // 0. Resolve and snapshot delivery address
  let addressSnapshot: any = null;
  if (addressId && userId) {
    const addr = await db.getAddressById(addressId, userId);
    if (!addr) {
      return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
    }
    let email = "";
    if (supabase) {
      const authResult = await supabase.auth.admin.getUserById(userId);
      email = authResult.data?.user?.email || "";
    }
    addressSnapshot = { ...addr, email };
  }

  // A. Verify stock first server-side
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // B. Recalculate totals server-side to prevent tampering
  const products = await db.getProducts();
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
    const couponRes = await db.validateCoupon(couponCode, verifiedSubtotal);
    if (!couponRes.valid || !couponRes.coupon) {
      return { success: false, error: couponRes.error || "Invalid coupon code." };
    }
    const coupon = couponRes.coupon;
    if (coupon.type === "percent") {
      verifiedCouponDiscount = Math.floor((verifiedSubtotal * coupon.discount) / 100);
    } else {
      verifiedCouponDiscount = coupon.discount;
    }
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
  const verifiedPointsDiscount = pointsRedeemed * 1; // 1 point = 1 INR discount
  const verifiedFinalPayable = Math.max(0, verifiedNetTotal - verifiedPointsDiscount - walletDeduction);

  if (verifiedFinalPayable !== 0) {
    return { success: false, error: "Security Alert: Final payable is not zero for wallet checkout." };
  }

  // C. Check Idempotency Key (prevent duplicate orders)
  const existingOrder = await db.getOrderById(idempotencyKey);
  if (existingOrder) {
    return { 
      success: true, 
      orderId: idempotencyKey, 
      order: existingOrder,
      alreadyExists: true,
      message: "Order already processed."
    };
  }

  // D. Deduct inventory stock server-side
  await db.deductStock(cart, idempotencyKey);

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

  // Award new loyalty points
  await db.awardLoyaltyPoints(verifiedNetTotal, idempotencyKey, userId);

  // F. Save Order server-side
  const orderData = {
    id: idempotencyKey,
    customer: customerName,
    date: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    total: verifiedNetTotal,
    originalTotal: verifiedSubtotal,
    couponDiscount: verifiedCouponDiscount,
    couponCode: couponCode,
    walletPaid: walletDeduction,
    gatewayPaid: 0,
    pointsRedeemed: pointsRedeemed,
    pointsDiscount: verifiedPointsDiscount,
    pointsEarned: Math.floor(verifiedNetTotal / 10),
    status: "Paid via Wallet",
    items: cart.map((item) => item.productName),
    address_snapshot: addressSnapshot,
  };

  let savedOrder;
  try {
    savedOrder = await db.saveOrder(orderData);
  } catch (err) {
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

  return {
    success: true,
    orderId: idempotencyKey,
    order: savedOrder,
    walletBalance: dbWalletBalance - walletDeduction,
    loyaltyPoints: dbLoyaltyPoints - pointsRedeemed + Math.floor(verifiedNetTotal / 10),
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
    userId,
  } = payload;

  // 0. Resolve and snapshot delivery address
  let addressSnapshot: any = null;
  if (addressId && userId) {
    const addr = await db.getAddressById(addressId, userId);
    if (!addr) {
      return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
    }
    let email = "";
    if (supabase) {
      const authResult = await supabase.auth.admin.getUserById(userId);
      email = authResult.data?.user?.email || "";
    }
    addressSnapshot = { ...addr, email };
  }

  // A. Verify stock first
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // B. Recalculate totals
  const products = await db.getProducts();
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
    const couponRes = await db.validateCoupon(couponCode, verifiedSubtotal);
    if (!couponRes.valid || !couponRes.coupon) {
      return { success: false, error: couponRes.error || "Invalid coupon code." };
    }
    const coupon = couponRes.coupon;
    if (coupon.type === "percent") {
      verifiedCouponDiscount = Math.floor((verifiedSubtotal * coupon.discount) / 100);
    } else {
      verifiedCouponDiscount = coupon.discount;
    }
  }

  const verifiedNetTotal = Math.max(0, verifiedSubtotal - verifiedCouponDiscount);

  const dbWalletBalance = await db.getWalletBalance(userId);
  const dbLoyaltyPoints = await db.getLoyaltyPoints(userId);

  if (walletDeduction > dbWalletBalance) {
    return { success: false, error: "Security Alert: Wallet deduction exceeds available balance." };
  }
  if (pointsRedeemed > dbLoyaltyPoints) {
    return { success: false, error: "Security Alert: Loyalty points redeemed exceed available points." };
  }

  const verifiedPointsDiscount = pointsRedeemed * 1;
  const verifiedFinalPayable = Math.max(0, verifiedNetTotal - verifiedPointsDiscount - walletDeduction);

  return {
    success: true,
    checkoutState: {
      customer: customerName,
      originalTotal: verifiedSubtotal,
      couponDiscount: verifiedCouponDiscount,
      couponCode: couponCode,
      netTotal: verifiedNetTotal,
      walletDeduction: walletDeduction,
      pointsRedeemed: pointsRedeemed,
      pointsDiscount: verifiedPointsDiscount,
      finalPayable: verifiedFinalPayable,
      items: cart.map((item) => item.productName),
      cartItems: cart,
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
    userId,
    pincode,
  } = payload;

  // 0. Resolve and snapshot delivery address
  let addressSnapshot: any = null;
  if (addressId && userId) {
    const addr = await db.getAddressById(addressId, userId);
    if (!addr) {
      return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
    }
    let email = "";
    if (supabase) {
      const authResult = await supabase.auth.admin.getUserById(userId);
      email = authResult.data?.user?.email || "";
    }
    addressSnapshot = { ...addr, email };
  }

  // A. Verify COD eligibility rules server-side
  const finalPayable = Math.max(0, netTotal - (pointsRedeemed * 1) - walletDeduction);
  
  const { evaluateCodRules } = await import("@/lib/codRules");
  const codCheck = evaluateCodRules({
    pincode,
    orderTotal: finalPayable,
    customerEmail: userId,
  });

  if (!codCheck.allowed) {
    return { success: false, error: codCheck.reason || "COD is not allowed." };
  }

  // B. Verify stock first server-side
  const stockCheck = await db.verifyStock(cart, idempotencyKey);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // C. Recalculate totals server-side to prevent tampering
  const products = await db.getProducts();
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
    const couponRes = await db.validateCoupon(couponCode, verifiedSubtotal);
    if (!couponRes.valid || !couponRes.coupon) {
      return { success: false, error: couponRes.error || "Invalid coupon code." };
    }
    const coupon = couponRes.coupon;
    if (coupon.type === "percent") {
      verifiedCouponDiscount = Math.floor((verifiedSubtotal * coupon.discount) / 100);
    } else {
      verifiedCouponDiscount = coupon.discount;
    }
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

  // Check Idempotency Key (prevent duplicate orders)
  const existingOrder = await db.getOrderById(idempotencyKey);
  if (existingOrder) {
    return { 
      success: true, 
      orderId: idempotencyKey, 
      order: existingOrder,
      alreadyExists: true,
      message: "Order already processed."
    };
  }

  // D. Deduct inventory stock server-side
  await db.deductStock(cart, idempotencyKey);

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

  // Award new loyalty points
  await db.awardLoyaltyPoints(verifiedNetTotal, idempotencyKey, userId);

  // F. Save Order server-side
  const orderData = {
    id: idempotencyKey,
    customer: customerName,
    date: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    total: verifiedNetTotal,
    originalTotal: verifiedSubtotal,
    couponDiscount: verifiedCouponDiscount,
    couponCode: couponCode,
    walletPaid: walletDeduction,
    gatewayPaid: 0,
    pointsRedeemed: pointsRedeemed,
    pointsDiscount: pointsRedeemed * 1,
    pointsEarned: Math.floor(verifiedNetTotal / 10),
    status: "Order Placed",
    items: cart.map((item) => item.productName),
    address_snapshot: addressSnapshot,
  };

  let savedOrder;
  try {
    savedOrder = await db.saveOrder(orderData);

    // Add status history entry
    await db.addOrderStatusHistory(idempotencyKey, "Order Placed", "COD Checkout System", {
      payment_method: "COD",
      amount_to_collect: finalPayable
    });
  } catch (err) {
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

  const updatedWallet = await db.getWalletBalance(userId);
  const updatedLoyalty = await db.getLoyaltyPoints(userId);

  return {
    success: true,
    orderId: idempotencyKey,
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

export async function validateCouponAction(code: string, baseTotal: number) {
  try {
    const res = await db.validateCoupon(code, baseTotal);
    return { success: true, res };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to validate coupon" };
  }
}

export async function verifyStockAction(cart: any[]) {
  try {
    const res = await db.verifyStock(cart);
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to verify stock" };
  }
}

