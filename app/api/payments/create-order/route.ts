import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { razorpay } from "@/lib/razorpay";
import { db } from "@/lib/db";
import { verifyAndPrepareGatewayCheckoutAction } from "@/app/actions/checkout";
import { z } from "zod";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { getServerUser } from "@/lib/supabase-server";
import { CacheService } from "@/lib/cache";
import crypto from "crypto";
import { paymentDebugLog } from "@/lib/payment-debug";

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
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let traceId = "create-order-unset";
  try {
    traceId = crypto.randomUUID();
    const user = await getServerUser();
    if (!user) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        reason: "Unauthorized access blocked",
        error: "Unauthorized: login required for checkout."
      });
      return NextResponse.json({ success: false, error: "Unauthorized: login required for checkout." }, { status: 401 });
    }
    const user_id = user.id;
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        reason: "Payload schema validation failed",
        error: parsed.error.message
      });
      return NextResponse.json({ success: false, error: "Invalid payload parameters", details: parsed.error }, { status: 400 });
    }

    const { idempotencyKey } = parsed.data;

    // Never trust a client-supplied userId — bind the payload to the session user if logged in.
    const payload = { ...parsed.data, userId: user_id || undefined };

    // Rate limit coupon checking if a coupon is provided
    if (payload.couponCode) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      const limitKey = user_id ? `user:${user_id}:coupon` : `ip:${ip}:coupon`;
      const isAllowed = await CacheService.checkRateLimit(limitKey, 5, 60);
      if (!isAllowed) {
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/create-order",
          reason: "Coupon verification rate limited",
          error: "Too many coupon attempts."
        });
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
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/create-order",
          reason: "User account is blocked",
          error: "Account blocked"
        });
        return NextResponse.json(
          { success: false, error: "Account is blocked. Contact support." },
          { status: 403 }
        );
      }
    }

    // 1. Verify totals, apply discounts, check stock, and get strict checkoutState
    const verification = await verifyAndPrepareGatewayCheckoutAction(payload);
    
    if (!verification.success || !verification.checkoutState) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        reason: "verifyAndPrepareGatewayCheckoutAction returned failure",
        error: verification.error
      });
      return NextResponse.json({ success: false, error: verification.error }, { status: 400 });
    }

    const { checkoutState } = verification;

    // 2. Check if order with this idempotencyKey already exists
    if (supabase) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, razorpay_order_id, total, payment_processing_state")
        .eq("idempotency_key", payload.idempotencyKey)
        .maybeSingle();

      if (existingOrder) {
        const orderTraceId = (existingOrder.payment_processing_state as any)?.traceId || traceId;

        // BUG 2 FIX: Validate the existing Razorpay order is still open (not expired).
        // If the user dismissed the popup and retried after >14 minutes, the Razorpay order
        // has expired. Returning its ID to the widget causes a silent failure.
        // In that case: create a fresh Razorpay order and update the pending DB record.
        let activeRazorpayOrderId = existingOrder.razorpay_order_id;
        let isRazorpayOrderValid = false;

        if (existingOrder.razorpay_order_id) {
          try {
            const rzpOrderCheck = await razorpay.orders.fetch(existingOrder.razorpay_order_id);
            isRazorpayOrderValid = rzpOrderCheck.status === "created";
          } catch (_e) {
            // Fetch failed — treat as expired
            isRazorpayOrderValid = false;
          }
        }

        if (!isRazorpayOrderValid) {
          // Create a replacement Razorpay order
          paymentDebugLog({
            traceId: orderTraceId,
            functionName: "POST /api/payments/create-order",
            orderId: existingOrder.id,
            razorpayOrderId: existingOrder.razorpay_order_id,
            reason: "Existing Razorpay order is expired or invalid. Creating a fresh Razorpay order for retry.",
          });
          const replacementOptions = {
            amount: Math.round(checkoutState.finalPayable * 100),
            currency: "INR",
            receipt: existingOrder.id,
            notes: { internal_order_id: existingOrder.id },
          };
          try {
            const freshRzpOrder = await razorpay.orders.create(replacementOptions);
            activeRazorpayOrderId = freshRzpOrder.id;
            // Update the DB so the order points to the fresh Razorpay order
            await supabase.from("orders").update({
              razorpay_order_id: freshRzpOrder.id,
            }).eq("id", existingOrder.id);
            paymentDebugLog({
              traceId: orderTraceId,
              functionName: "POST /api/payments/create-order",
              orderId: existingOrder.id,
              razorpayOrderId: freshRzpOrder.id,
              reason: "Fresh Razorpay order created for retry. DB record updated.",
            });
          } catch (freshOrderErr: any) {
            paymentDebugLog({
              traceId: orderTraceId,
              functionName: "POST /api/payments/create-order",
              orderId: existingOrder.id,
              reason: "Failed to create fresh Razorpay order for retry.",
              error: freshOrderErr.message,
            });
            // Fall back to returning the existing (expired) order — the widget will error gracefully
          }
        } else {
          paymentDebugLog({
            traceId: orderTraceId,
            functionName: "POST /api/payments/create-order",
            orderId: existingOrder.id,
            razorpayOrderId: existingOrder.razorpay_order_id,
            reason: "Existing Razorpay order is still valid. Returning for retry.",
          });
        }

        return NextResponse.json({
          success: true,
          orderId: existingOrder.id,
          razorpayOrderId: activeRazorpayOrderId,
          amount: Math.round(existingOrder.total * 100),
          currency: "INR",
          traceId: orderTraceId,
          checkoutState: { ...checkoutState, orderId: existingOrder.id }
        });
      }
    }

    if (checkoutState.finalPayable <= 0) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        reason: "finalPayable is zero or negative",
        error: "Total must be greater than 0 for Razorpay."
      });
      return NextResponse.json({ success: false, error: "Total must be greater than 0 for Razorpay." }, { status: 400 });
    }

    if (checkoutState.finalPayable < 1) {
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        reason: "finalPayable is less than ₹1",
        error: "Minimum payable amount is ₹1"
      });
      return NextResponse.json({ 
        success: false, 
        error: "Minimum payable amount is ₹1. Please adjust your wallet or points usage." 
      }, { status: 400 });
    }

    // 3. Generate sequential order number from DB sequence
    const sequentialOrderId = await db.getNextOrderNumber();
    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/create-order",
      orderId: sequentialOrderId,
      reason: "Generated sequential order number from sequence"
    });

    // 4. Create Razorpay Order with sequential order number as receipt
    const options = {
      amount: Math.round(checkoutState.finalPayable * 100), // amount in paise
      currency: "INR",
      receipt: sequentialOrderId,
      notes: { internal_order_id: sequentialOrderId },
      expire_by: Math.floor(Date.now() / 1000) + (14 * 60),
    };

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create(options);
      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        orderId: sequentialOrderId,
        razorpayOrderId: rzpOrder.id,
        reason: "Razorpay order successfully created",
        rpc: "razorpay.orders.create",
        rpcResult: "success"
      });
    } catch (e: any) {
      const errStr = JSON.stringify(e) || "";
      const errDesc = e?.error?.description || "";
      if (errStr.includes("expire_by") || errDesc.includes("expire_by")) {
        console.warn("[Razorpay] expire_by rejected by Razorpay gateway API. Retrying without expire_by...");
        const fallbackOptions = { ...options };
        delete (fallbackOptions as any).expire_by;
        rzpOrder = await razorpay.orders.create(fallbackOptions);
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/create-order",
          orderId: sequentialOrderId,
          razorpayOrderId: rzpOrder.id,
          reason: "Razorpay order successfully created on retry (without expire_by)",
          rpc: "razorpay.orders.create",
          rpcResult: "success"
        });
      } else {
        paymentDebugLog({
          traceId,
          functionName: "POST /api/payments/create-order",
          orderId: sequentialOrderId,
          reason: "Razorpay order creation failed",
          rpc: "razorpay.orders.create",
          rpcResult: "failed",
          error: e.message || errStr
        });
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
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
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

    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/create-order",
      orderId: sequentialOrderId,
      razorpayOrderId: rzpOrder.id,
      oldStatus: "N/A",
      newStatus: "Payment Pending",
      reason: "Attempting to save initial pending order record"
    });

    await db.saveOrder(orderData);

    // Create order events
    await db.createOrderEvent(sequentialOrderId, "Order Created");
    await db.createOrderEvent(sequentialOrderId, "Payment Pending");

    // Update with Razorpay fields & store traceId in payment_processing_state
    if (supabase) {
      await supabase.from("orders").update({
        razorpay_order_id: rzpOrder.id,
        payment_status: "Payment Pending",
        payment_processing_state: { traceId }
      }).eq("id", sequentialOrderId);

      await supabase.from("payments").insert({
        order_id: sequentialOrderId,
        razorpay_order_id: rzpOrder.id,
        amount: checkoutState.finalPayable,
        currency: "INR",
        status: "CREATED",
        method: "razorpay"
      });

      paymentDebugLog({
        traceId,
        functionName: "POST /api/payments/create-order",
        orderId: sequentialOrderId,
        razorpayOrderId: rzpOrder.id,
        reason: "Saved traceId in order payment_processing_state and created payment row"
      });
    }

    // 6. Return to client
    return NextResponse.json({
      success: true,
      orderId: sequentialOrderId,
      razorpayOrderId: rzpOrder.id,
      amount: options.amount,
      currency: options.currency,
      traceId,
      checkoutState: { ...checkoutState, orderId: sequentialOrderId }
    });

  } catch (error: any) {
    paymentDebugLog({
      traceId,
      functionName: "POST /api/payments/create-order",
      reason: "Unhandled exception in create-order endpoint",
      error: error.message || String(error)
    });
    console.error("[Payment Error]:", error);
    Sentry.captureException(error, { tags: { area: "order", route: "create-order" } });
    return NextResponse.json(
      { success: false, error: "Payment processing failed. Please try again." },
      { status: 500 }
    );
  }
}
