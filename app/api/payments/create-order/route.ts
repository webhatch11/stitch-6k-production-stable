import { NextRequest, NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { db } from "@/lib/db";
import { verifyAndPrepareGatewayCheckoutAction } from "@/app/actions/checkout";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

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

    // 1. Verify totals, apply discounts, check stock, and get strict checkoutState
    const verification = await verifyAndPrepareGatewayCheckoutAction(payload);
    
    if (!verification.success || !verification.checkoutState) {
      return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
    }

    const { checkoutState } = verification;

    if (checkoutState.finalPayable <= 0) {
      return NextResponse.json({ success: false, error: "Total must be greater than 0 for Razorpay." }, { status: 400 });
    }

    // 2. Create Razorpay Order
    const options = {
      amount: Math.round(checkoutState.finalPayable * 100), // amount in paise
      currency: "INR",
      receipt: checkoutState.idempotencyKey,
    };

    const rzpOrder = await razorpay.orders.create(options);

    if (!rzpOrder || !rzpOrder.id) {
      return NextResponse.json({ success: false, error: "Failed to generate Razorpay order." }, { status: 500 });
    }

    // 3. Save initial order as PAYMENT_PENDING in the DB
    // First lock the inventory. `verifyAndPrepareGatewayCheckoutAction` verified it, now we formally lock it.
    await db.deductStock(checkoutState.cartItems, checkoutState.idempotencyKey);
    
    // Save order
    const orderData = {
      id: checkoutState.idempotencyKey,
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
    };

    await db.saveOrder(orderData);

    // Update with Razorpay fields
    if (supabase) {
      await supabase.from("orders").update({
        razorpay_order_id: rzpOrder.id,
        payment_status: "PAYMENT_PENDING"
      }).eq("id", checkoutState.idempotencyKey);

      await supabase.from("payments").insert({
        order_id: checkoutState.idempotencyKey,
        razorpay_order_id: rzpOrder.id,
        amount: checkoutState.finalPayable,
        currency: "INR",
        status: "CREATED",
        method: "razorpay"
      });
    }

    // 4. Return to client
    return NextResponse.json({
      success: true,
      orderId: checkoutState.idempotencyKey,
      razorpayOrderId: rzpOrder.id,
      amount: options.amount,
      currency: options.currency,
      checkoutState
    });

  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
