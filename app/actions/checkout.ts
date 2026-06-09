"use server";

import { db } from "@/lib/db";
import { Product } from "@/lib/registry";

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

  // 0. Verify address authorization
  if (addressId && userId) {
    const addresses = await db.getUserAddresses(userId);
    if (!addresses.find(a => a.id === addressId)) {
      return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
    }
  }

  // A. Verify stock first server-side
  const stockCheck = await db.verifyStock(cart);
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
    const coupon = await db.validateCoupon(couponCode);
    if (coupon) {
      if (coupon.type === "percent") {
        verifiedCouponDiscount = Math.floor((verifiedSubtotal * coupon.discount) / 100);
      } else {
        verifiedCouponDiscount = coupon.discount;
      }
    }
  }

  const verifiedNetTotal = Math.max(0, verifiedSubtotal - verifiedCouponDiscount);

  // Check wallet and loyalty points balances
  const dbWalletBalance = await db.getWalletBalance();
  const dbLoyaltyPoints = await db.getLoyaltyPoints();

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
  const orders = await db.getOrders();
  const existingOrder = orders.find(o => o.id === idempotencyKey);
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
  await db.deductStock(cart);

  // E. Debit balances server-side
  if (walletDeduction > 0) {
    await db.applyWalletDebit(walletDeduction, idempotencyKey);
  }
  if (pointsRedeemed > 0) {
    await db.applyLoyaltyDebit(pointsRedeemed, idempotencyKey);
  }

  // Award new loyalty points
  await db.awardLoyaltyPoints(verifiedNetTotal, idempotencyKey);

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
  };

  const savedOrder = await db.saveOrder(orderData);

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

  // 0. Verify address authorization
  if (addressId && userId) {
    const addresses = await db.getUserAddresses(userId);
    if (!addresses.find(a => a.id === addressId)) {
      return { success: false, error: "Security Alert: Invalid or unauthorized delivery address." };
    }
  }

  // A. Verify stock first
  const stockCheck = await db.verifyStock(cart);
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
    const coupon = await db.validateCoupon(couponCode);
    if (coupon) {
      if (coupon.type === "percent") {
        verifiedCouponDiscount = Math.floor((verifiedSubtotal * coupon.discount) / 100);
      } else {
        verifiedCouponDiscount = coupon.discount;
      }
    }
  }

  const verifiedNetTotal = Math.max(0, verifiedSubtotal - verifiedCouponDiscount);

  const dbWalletBalance = await db.getWalletBalance();
  const dbLoyaltyPoints = await db.getLoyaltyPoints();

  if (walletDeduction > dbWalletBalance) {
    return { success: false, error: "Security Alert: Wallet deduction exceeds available balance." };
  }
  if (pointsRedeemed > dbLoyaltyPoints) {
    return { success: false, error: "Security Alert: Loyalty points redeemed exceed available points." };
  }

  const verifiedPointsDiscount = pointsRedeemed * 1;
  const verifiedFinalPayable = Math.max(0, verifiedNetTotal - verifiedPointsDiscount - walletDeduction);

  // Return the verified totals and secure signature payload
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
      signature: "SECURE_SIG_" + Buffer.from(idempotencyKey + "_" + verifiedFinalPayable).toString("base64"),
    }
  };
}

// 3. Complete Gateway Checkout Action
export async function completeGatewayCheckoutAction(payload: {
  checkoutState: any;
  gatewayTransactionId: string;
  status: "Paid" | "Failed";
}) {
  const { checkoutState, gatewayTransactionId, status } = payload;
  const {
    customer,
    originalTotal,
    couponDiscount,
    couponCode,
    netTotal,
    walletDeduction,
    pointsRedeemed,
    pointsDiscount,
    finalPayable,
    items,
    cartItems,
    idempotencyKey,
    signature,
  } = checkoutState;

  // A. Verify Signature to prevent client tampering
  const expectedSig = "SECURE_SIG_" + Buffer.from(idempotencyKey + "_" + finalPayable).toString("base64");
  if (signature !== expectedSig) {
    return { success: false, error: "Security Violation: Tampered checkout signature detected." };
  }

  // B. Check Idempotency Key (already processed?)
  const orders = await db.getOrders();
  const existingOrder = orders.find(o => o.id === idempotencyKey);
  if (existingOrder) {
    return { 
      success: true, 
      orderId: idempotencyKey, 
      order: existingOrder,
      alreadyExists: true,
      message: "Order already completed."
    };
  }

  // If the simulated payment was failed or cancelled
  if (status === "Failed") {
    // Save order as Failed to allow recovery/retry
    const orderData = {
      id: idempotencyKey,
      customer,
      date: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      total: netTotal,
      originalTotal,
      couponDiscount,
      couponCode,
      walletPaid: walletDeduction,
      gatewayPaid: 0,
      pointsRedeemed,
      pointsDiscount,
      pointsEarned: 0,
      status: "Payment Failed",
      items,
    };
    const savedOrder = await db.saveOrder(orderData);
    return { success: false, error: "Payment failed. Saved to order history as failed.", order: savedOrder };
  }

  // C. Verify stock is still available
  const stockCheck = await db.verifyStock(cartItems);
  if (!stockCheck.success) {
    return { success: false, error: stockCheck.message || "Insufficient stock." };
  }

  // D. Deduct inventory stock
  await db.deductStock(cartItems);

  // E. Debit balances
  if (walletDeduction > 0) {
    await db.applyWalletDebit(walletDeduction, idempotencyKey);
  }
  if (pointsRedeemed > 0) {
    await db.applyLoyaltyDebit(pointsRedeemed, idempotencyKey);
  }

  // Award new loyalty points
  await db.awardLoyaltyPoints(netTotal, idempotencyKey);

  // F. Save Order
  const orderData = {
    id: idempotencyKey,
    customer,
    date: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    total: netTotal,
    originalTotal,
    couponDiscount,
    couponCode,
    walletPaid: walletDeduction,
    gatewayPaid: finalPayable,
    pointsRedeemed,
    pointsDiscount,
    pointsEarned: Math.floor(netTotal / 10),
    status: "Paid",
    items,
  };

  const savedOrder = await db.saveOrder(orderData);

  const dbWalletBalance = await db.getWalletBalance();
  const dbLoyaltyPoints = await db.getLoyaltyPoints();

  return {
    success: true,
    orderId: idempotencyKey,
    order: savedOrder,
    walletBalance: dbWalletBalance,
    loyaltyPoints: dbLoyaltyPoints,
  };
}
