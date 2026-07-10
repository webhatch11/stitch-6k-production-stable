import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { razorpay } from "@/lib/razorpay";
import { db } from "@/lib/db";
import { verifyAndPrepareGatewayCheckoutAction } from "@/app/actions/checkout";
import { z } from "zod";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { getServerUser } from "@/lib/supabase-server";
import { CacheService } from "@/lib/cache";

const createOrderSchema = z.object({
  cart: z.array(z.any()).min(1),
  couponCode: z.string().default(""),
  walletDeduction: z.number().default(0),
  pointsRedeemed: z.number().default(0),
  loyaltyDiscount: z.number().default(0),
  baseTotal: z.number().min(0),
  netTotal: z.number().min(0),
  customerName: z.string().min(1),
  idempotencyKey: z.string().min(1),
  addressId: z.string().optional(),
  userId: z.string().optional(),
  guestAddress: z.any().optional(),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    const user_id = user ? user.id : null;
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload parameters", details: parsed.error }, { status: 400 });
    }

    const { idempotencyKey } = parsed.data;
    console.debug('[Create Order] idempotencyKey:', idempotencyKey ? (idempotencyKey.slice(0, 8) + '...') : 'undefined');

    // Never trust a client-supplied userId — bind the payload to the session user if logged in.
    const payload = { ...parsed.data, userId: user_id || undefined };

    // Rate limit coupon checking if a coupon is provided
    if (payload.couponCode) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      const limitKey = user_id ? `user:${user_id}:coupon` : `ip:${ip}:coupon`;
      const isAllowed = await CacheService.checkRateLimit(limitKey, 5, 60);
      if (!isAllowed) {
        return NextResponse.json({ success: false, error: "Too many coupon attempts. Please try again in a minute." }, { status: 429 });
      }
    }

    // 0. Check if the session user is blocked (only if logged in)
    if (supabase && user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_blocked")
        .eq("id", user_id)
        .maybeSingle();
      if (profile?.is_blocked) {
        return NextResponse.json(
          { success: false, error: "Account is blocked. Contact support." },
          { status: 403 }
        );
      }
    }

    // 1. Verify totals, apply discounts, check stock, and get strict checkoutState
    const verification = await verifyAndPrepareGatewayCheckoutAction(payload);
    
    if (!verification.success || !verification.checkoutState) {
      return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
    }


    const { checkoutState } = verification;

    // 2. Check if order with this idempotencyKey already exists
    if (supabase) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, razorpay_order_id, total")
        .eq("idempotency_key", payload.idempotencyKey)
        .maybeSingle();

      if (existingOrder) {
        return NextResponse.json({
          success: true,
          orderId: existingOrder.id,
          razorpayOrderId: existingOrder.razorpay_order_id,
          amount: Math.round(existingOrder.total * 100),
          currency: "INR",
          checkoutState: { ...checkoutState, orderId: existingOrder.id }
        });
      }
    }

    if (checkoutState.finalPayable <= 0) {
      return NextResponse.json({ success: false, error: "Total must be greater than 0 for Razorpay." }, { status: 400 });
    }

    // 3. Generate sequential order number from DB sequence
    const sequentialOrderId = await db.getNextOrderNumber();

    // 4. Create Razorpay Order with sequential order number as receipt
    const options = {
      amount: Math.round(checkoutState.finalPayable * 100), // amount in paise
      currency: "INR",
      receipt: sequentialOrderId,
      notes: { internal_order_id: sequentialOrderId },
      // 14 minutes from now (in seconds, Unix timestamp)
      // Reservation expires at 15min; Razorpay timeout 1 min earlier
      expire_by: Math.floor(Date.now() / 1000) + (14 * 60),
    };

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create(options);
    } catch (e: any) {
      const errStr = JSON.stringify(e) || "";
      const errDesc = e?.error?.description || "";
      if (errStr.includes("expire_by") || errDesc.includes("expire_by")) {
        console.warn("[Razorpay] expire_by rejected by Razorpay gateway API. Retrying without expire_by...");
        const fallbackOptions = { ...options };
        delete (fallbackOptions as any).expire_by;
        rzpOrder = await razorpay.orders.create(fallbackOptions);
      } else {
        console.error("Razorpay order creation error:", e);
        throw e;
      }
    }

    if (!rzpOrder || !rzpOrder.id) {
      return NextResponse.json({ success: false, error: "Failed to generate Razorpay order." }, { status: 500 });
    }

    // 5. Save initial order as PAYMENT_PENDING in the DB (stock is already reserved via verifyStock)
    const orderData = {
      id: sequentialOrderId,
      customer: checkoutState.customer,
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      total: checkoutState.total ?? (checkoutState.netTotal + (checkoutState.shippingAmount || 0)),
      originalTotal: checkoutState.originalTotal,
      couponDiscount: checkoutState.couponDiscount,
      couponCode: checkoutState.couponCode,
      walletPaid: checkoutState.walletDeduction,
      gatewayPaid: checkoutState.finalPayable,
      pointsRedeemed: checkoutState.pointsRedeemed,
      pointsDiscount: checkoutState.pointsDiscount,
      pointsEarned: 0, // Earned later on success
      status: "Payment Pending",
      items: checkoutState.items,
      idempotencyKey: payload.idempotencyKey,
      cartItems: checkoutState.cartItems,
      paymentStatus: "Payment Pending",
      address_snapshot: checkoutState.addressSnapshot ?? null,
      userId: user_id || undefined,
      user_id: user_id || undefined,
      utm_source: parsed.data.utm_source || undefined,
      utm_medium: parsed.data.utm_medium || undefined,
      utm_campaign: parsed.data.utm_campaign || undefined,
      shippingAmount: checkoutState.shippingAmount || 0,
      shipping_amount: checkoutState.shippingAmount || 0,
    };

    await db.saveOrder(orderData);

    // Create order events
    await db.createOrderEvent(sequentialOrderId, "Order Created");
    await db.createOrderEvent(sequentialOrderId, "Payment Pending");

    // Update with Razorpay fields
    if (supabase) {
      await supabase.from("orders").update({
        razorpay_order_id: rzpOrder.id,
        payment_status: "Payment Pending"
      }).eq("id", sequentialOrderId);

      await supabase.from("payments").insert({
        order_id: sequentialOrderId,
        razorpay_order_id: rzpOrder.id,
        amount: checkoutState.finalPayable,
        currency: "INR",
        status: "CREATED",
        method: "razorpay"
      });
    }

    // 6. Return to client
    return NextResponse.json({
      success: true,
      orderId: sequentialOrderId,
      razorpayOrderId: rzpOrder.id,
      amount: options.amount,
      currency: options.currency,
      checkoutState: { ...checkoutState, orderId: sequentialOrderId }
    });

  } catch (error: unknown) {
    console.error("[Payment Error]:", error);
    Sentry.captureException(error, { tags: { area: "order", route: "create-order" } });
    return NextResponse.json(
      { success: false, error: "Payment processing failed. Please try again." },
      { status: 500 }
    );
  }
}
