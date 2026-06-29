import { NextRequest, NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { db } from "@/lib/db";
import { verifyAndPrepareGatewayCheckoutAction } from "@/app/actions/checkout";
import { z } from "zod";
import { supabaseService as supabase } from "@/lib/supabase-service";

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
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload parameters", details: parsed.error }, { status: 400 });
    }

    const payload = parsed.data;

    // 0. Check if user is blocked
    if (payload.userId && supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_blocked")
        .eq("id", payload.userId)
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

    const rzpOrder = await razorpay.orders.create(options);

    if (!rzpOrder || !rzpOrder.id) {
      return NextResponse.json({ success: false, error: "Failed to generate Razorpay order." }, { status: 500 });
    }

    // 5. Save initial order as PAYMENT_PENDING in the DB (stock is already reserved via verifyStock)
    const orderData = {
      id: sequentialOrderId,
      customer: checkoutState.customer,
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      total: checkoutState.netTotal,
      originalTotal: checkoutState.originalTotal,
      couponDiscount: checkoutState.couponDiscount,
      couponCode: checkoutState.couponCode,
      walletPaid: checkoutState.walletDeduction,
      gatewayPaid: checkoutState.finalPayable,
      pointsRedeemed: checkoutState.pointsRedeemed,
      pointsDiscount: checkoutState.pointsDiscount,
      pointsEarned: 0, // Earned later on success
      status: "PAYMENT_PENDING",
      items: checkoutState.items,
      idempotencyKey: payload.idempotencyKey,
      cartItems: checkoutState.cartItems,
      paymentStatus: "PAYMENT_PENDING",
      address_snapshot: checkoutState.addressSnapshot ?? null,
    };

    await db.saveOrder(orderData);

    // Create order events
    await db.createOrderEvent(sequentialOrderId, "Order Created");
    await db.createOrderEvent(sequentialOrderId, "Payment Pending");

    // Update with Razorpay fields
    if (supabase) {
      await supabase.from("orders").update({
        razorpay_order_id: rzpOrder.id,
        payment_status: "PAYMENT_PENDING"
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

  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
