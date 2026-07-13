import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { z } from "zod";
import { razorpay } from "@/lib/razorpay";
import { sendGA4Purchase, sendMetaPurchase } from "@/lib/server-analytics";

const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  // @deprecated — accepted for client backward-compat but never used for side effects
  checkoutState: z.any()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid verification payload" }, { status: 400 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = parsed.data;

    // Fetch authoritative order from DB using the Razorpay order ID supplied by
    // the payment gateway. All side effects below use only this row — never
    // client-supplied checkoutState — to prevent forged payload attacks.
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
    }

    const { data: dbOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (orderFetchError || !dbOrder) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Defense in depth: assert the row we loaded is the one we asked for.
    if (dbOrder.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json({ success: false, error: "Order ID mismatch" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "";

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await supabase.from("payment_logs").insert({
        payment_id: null,
        previous_status: "Payment Pending",
        new_status: "FAILED_SIGNATURE",
        metadata: { razorpay_payment_id, razorpay_order_id }
      });

      await supabase.from("orders").update({
        payment_status: "FAILED",
        status: "FAILED"
      }).eq("id", dbOrder.id);

      await db.saveOrder({ id: dbOrder.id, status: "FAILED" });
      await db.releaseReservation(dbOrder.idempotency_key);
      await db.createOrderEvent(dbOrder.id, "Payment Failed");

      return NextResponse.json({ success: false, error: "Payment verification failed: Invalid signature" }, { status: 400 });
    }

    // Verify paid amount matches expected amount
    const expectedAmount = Math.round(
      (dbOrder.gateway_paid ?? dbOrder.total) * 100
    ); // Razorpay uses paise

    let paymentEntity;
    try {
      paymentEntity = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (e) {
      console.error("[verify] failed to fetch payment details from razorpay:", e);
    }

    if (paymentEntity?.amount && 
        expectedAmount &&
        Number(paymentEntity.amount) < expectedAmount) {
      
      console.error(
        '[FRAUD ALERT] Payment amount mismatch:',
        `paid=${paymentEntity.amount}`,
        `expected=${expectedAmount}`,
        `orderId=${dbOrder.id}`
      );
      
      // Capture to Sentry immediately
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureEvent({
        message: 'FRAUD: Payment amount mismatch',
        level: 'error',
        extra: {
          paid: paymentEntity.amount,
          expected: expectedAmount,
          orderId: dbOrder.id
        }
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment amount verification failed.' 
        },
        { status: 400 }
      );
    }

    if (paymentEntity?.amount && Number(paymentEntity.amount) > expectedAmount) {
      console.warn(
        `[Overpayment] Payment amount greater than expected:`,
        `paid=${paymentEntity.amount}`,
        `expected=${expectedAmount}`,
        `orderId=${dbOrder.id}`
      );
    }

    // Idempotency: if this order was already processed, verify all side effects completed.
    // If the previous run crashed midway, the order status is 'Paid' but the inventory reservation
    // remains unfulfilled. In that case, we proceed to run the missed side effects.
    let isRecoveryMode = false;
    if (dbOrder.status === "Paid") {
      const { data: resData } = await supabase
        .from("inventory_reservations")
        .select("status")
        .eq("session_id", dbOrder.idempotency_key)
        .maybeSingle();

      if (resData && resData.status !== "fulfilled") {
        console.warn(`[verify] Order ${dbOrder.id} is Paid but reservation status is ${resData.status}. Recovering missing side-effects...`);
        isRecoveryMode = true;
      } else {
        return NextResponse.json({ success: true, message: "Order already processed" });
      }
    }

    if (dbOrder.status === "FAILED") {
      return NextResponse.json({ success: false, error: "Order in failed state, cannot reprocess" }, { status: 400 });
    }

    // Compute earned points using net total (original_total minus coupon_discount),
    // excluding shipping — matches the earn rule: ₹100 net spend = 5 points.
    const earnBase = Math.max(0, (dbOrder.original_total || 0) - (dbOrder.coupon_discount || 0));
    const earned = Math.floor(earnBase / 100) * 5; // Business rule: ₹100 spent = 5 points

    let claimed = null;
    if (isRecoveryMode) {
      claimed = { id: dbOrder.id };
    } else {
      // Atomic compare-and-set: only one process (verify or webhook) wins this UPDATE.
      // The WHERE status='PAYMENT_PENDING' predicate means only the first caller
      // transitions the row; subsequent callers see claimed=null and return early.
      const { data: claimedRow, error: claimErr } = await supabase
        .from("orders")
        .update({
          status: "Paid",
          payment_status: "Paid",
          points_earned: earned,
          razorpay_payment_id,   // ← store on orders row — required for refunds
        })
        .eq("id", dbOrder.id)
        .eq("status", "Payment Pending")
        .select("id")
        .maybeSingle();

      if (claimErr) {
        console.error("[verify] claim error:", claimErr);
        return NextResponse.json({ success: false, error: "Failed to claim order" }, { status: 500 });
      }
      claimed = claimedRow;
    }

    if (!claimed) {
      return NextResponse.json({ success: true, message: "Order already processed" });
    }

    // We won the race. Run side effects in order.
    // Failures here are logged but do NOT roll back PAID status — the customer's
    // payment is captured and reverting to PAYMENT_PENDING risks a second charge.
    // Inventory and ledger discrepancies are reconciled by ops.

    // a. Deduct inventory stock
    let deductSuccess = false;
    try {
      const { data: currentRes } = await supabase
        .from("inventory_reservations")
        .select("status")
        .eq("session_id", dbOrder.idempotency_key)
        .maybeSingle();

      if (currentRes?.status === "fulfilled") {
        deductSuccess = true;
      } else {
        deductSuccess = await db.deductStock(dbOrder.cart_items || [], dbOrder.idempotency_key);
      }
    } catch (e) {
      console.error("[verify] deductStock failed:", e);
    }

    if (!deductSuccess) {
      console.error(`[verify] DEDUCT FAILED post-payment for ${dbOrder.id}`);
      // Mark as DEDUCTION_FAILED
      await supabase.from("orders").update({
        status: "DEDUCTION_FAILED",
        payment_status: "FAILED"
      }).eq("id", dbOrder.id);

      console.warn(`[ADMIN ALERT] Inventory deduction failed for order ${dbOrder.id}. Auto-refunding...`);

      // Auto-refund the customer
      try {
        await razorpay.payments.refund(razorpay_payment_id, {
          amount: dbOrder.total * 100,
          notes: { reason: "Inventory unavailable after payment" },
        });
        // Mark order
        await supabase.from("orders").update({
          status: "Refunded (Out of Stock)",
          refund_status: "initiated",
          refund_reason: "Inventory deduction failed post-payment",
        }).eq("id", dbOrder.id);
      } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
        console.error(`[verify] AUTO-REFUND FAILED, MANUAL INTERVENTION:`, message);
        // Send alert
        console.warn(`[ADMIN ALERT] Razorpay auto-refund failed for order ${dbOrder.id}: ${message}`);
      }

      return NextResponse.json({ success: false, error: "Inventory deduction failed" }, { status: 400 });
    }

    // b. Increment coupon usage
    if (dbOrder.coupon_code && !isRecoveryMode) {
      try {
        await db.incrementCouponUsage(dbOrder.coupon_code);
      } catch (e) {
        console.error("[verify] incrementCouponUsage failed:", e);
      }
    }

    // c. Debit wallet
    if (dbOrder.wallet_paid > 0) {
      try {
        await db.applyWalletDebit(dbOrder.wallet_paid, dbOrder.id, dbOrder.user_id);
      } catch (e) {
        console.error("[verify] applyWalletDebit failed:", e);
      }
    }

    // d. Debit loyalty points
    if (dbOrder.points_redeemed > 0) {
      try {
        await db.applyLoyaltyDebit(dbOrder.points_redeemed, dbOrder.id, dbOrder.user_id);
      } catch (e) {
        console.error("[verify] applyLoyaltyDebit failed:", e);
      }
    }

    // e. Award loyalty points — use earnBase (net spend, no shipping)
    try {
      await db.awardLoyaltyPoints(earnBase, dbOrder.id, dbOrder.user_id);
    } catch (e) {
      console.error("[verify] awardLoyaltyPoints failed:", e);
    }

    // f. Update payments record
    try {
      const { data: payment } = await supabase
        .from("payments")
        .select("id")
        .eq("order_id", dbOrder.id)
        .single();

      if (payment) {
        await supabase.from("payments").update({
          razorpay_payment_id,
          status: "CAPTURED"
        }).eq("id", payment.id);

        await supabase.from("payment_logs").insert({
          payment_id: payment.id,
          previous_status: "CREATED",
          new_status: "CAPTURED",
          metadata: { razorpay_payment_id, razorpay_signature }
        });
      }
    } catch (e) {
      console.error("[verify] payments update failed:", e);
    }

    // g. Payment audit log
    try {
      await db.createPaymentAuditLog(dbOrder.id, "Payment Pending", "Paid", "verify_route");
    } catch (e) {
      console.error("[verify] createPaymentAuditLog failed:", e);
    }

    // h. Order event
    try {
      await db.createOrderEvent(dbOrder.id, "Payment Successful");
    } catch (e) {
      console.error("[verify] createOrderEvent failed:", e);
    }

    // i. Dispatch fulfillment
    try {
      await db.dispatchFulfillment(dbOrder.id);
    } catch (e) {
      console.error("[verify] dispatchFulfillment failed:", e);
    }

    // j. Send Order Confirmation Email
    try {
      let customerEmail = dbOrder.address_snapshot?.email || "";
      if (!customerEmail && dbOrder.user_id && supabase) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", dbOrder.user_id)
          .maybeSingle();
        if (profile?.email) {
          customerEmail = profile.email;
        }
      }

      if (customerEmail) {
        const { sendOrderConfirmationEmail } = await import("@/lib/email");
        
        // Group cart items to compute quantities for duplicates
        const rawItems = dbOrder.cart_items || [];
        const groupedMap = new Map<string, { productName: string; size: string; quantity: number; price: number }>();
        for (const item of rawItems) {
          const key = `${item.productName || item.title || "Product"}-${item.size || "Free Size"}`;
          if (groupedMap.has(key)) {
            groupedMap.get(key)!.quantity += 1;
          } else {
            groupedMap.set(key, {
              productName: item.productName || item.title || "Product",
              size: item.size || "Free Size",
              quantity: 1,
              price: Number(item.price || 0),
            });
          }
        }
        const groupedItems = Array.from(groupedMap.values());

        const addr = dbOrder.address_snapshot;
        const addressStr = addr
          ? [addr.name, addr.phone, addr.address_line_1, addr.address_line_2, `${addr.city} - ${addr.postal_code}`, addr.state, addr.country]
              .filter(Boolean)
              .join(", ")
          : "No address details available";

        sendOrderConfirmationEmail({
          id: dbOrder.id,
          customerName: dbOrder.customer || "Valued Customer",
          customerEmail,
          items: groupedItems,
          total: Number(dbOrder.total || 0),
          address: addressStr
        }).catch((emailError) => {
          console.error("[Email] Order confirmation email failed:", emailError);
        });
      } else {
        console.warn(`[Email] Could not resolve customer email for order #${dbOrder.id}. Email sending skipped.`);
      }
    } catch (e) {
      console.error("[Email] Preparation for order confirmation email failed:", e);
    }

    // Run server-side tracking in parallel (non-blocking)
    Promise.all([
      sendGA4Purchase({
        orderId: dbOrder.id,
        total: dbOrder.total,
        items: dbOrder.cart_items || [],
        couponCode: dbOrder.coupon_code,
        clientId: req.headers.get("x-ga-client-id") || dbOrder.id,
      }),
      sendMetaPurchase({
        orderId: dbOrder.id,
        total: dbOrder.total,
        items: dbOrder.cart_items || [],
        customerEmail: dbOrder.address_snapshot?.email || undefined,
        customerPhone: dbOrder.address_snapshot?.phone || undefined,
        customerName: dbOrder.customer,
      }),
    ]).catch((err) => {
      console.error("[Server Analytics]:", err);
    });

    return NextResponse.json({ success: true, message: "Payment verified successfully", orderId: dbOrder.id });

  } catch (error: unknown) {
    console.error("[Payment Error]:", error);
    Sentry.captureException(error, { tags: { area: "payment", route: "verify" } });
    return NextResponse.json(
      { success: false, error: "Payment processing failed. Please try again." },
      { status: 500 }
    );
  }
}
