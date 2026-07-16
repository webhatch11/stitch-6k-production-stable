import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const razorpay_payment_id = formData.get("razorpay_payment_id")?.toString();
    const razorpay_order_id = formData.get("razorpay_order_id")?.toString();
    const razorpay_signature = formData.get("razorpay_signature")?.toString();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.redirect(
        new URL("/payment-failed?error=Missing+payment+credentials", req.url),
        303
      );
    }

    if (!supabase) {
      return NextResponse.redirect(
        new URL("/payment-failed?error=Database+unavailable", req.url),
        303
      );
    }

    const { data: dbOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (orderFetchError || !dbOrder) {
      return NextResponse.redirect(
        new URL("/payment-failed?error=Order+not+found", req.url),
        303
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Mark order as failed (only if not already paid)
      if (dbOrder.status !== "Paid") {
        await supabase.from("orders").update({
          payment_status: "FAILED",
          status: "FAILED"
        }).eq("id", dbOrder.id);
        await db.releaseReservation(dbOrder.idempotency_key);
        await db.createOrderEvent(dbOrder.id, "Payment Failed");
      }

      return NextResponse.redirect(
        new URL("/payment-failed?error=Invalid+payment+signature", req.url),
        303
      );
    }

    // If order is not already marked as Paid, run side-effects.
    if (dbOrder.status !== "Paid") {
      const claimSuccess = await db.runPostPaymentSideEffects(dbOrder.id, razorpay_payment_id);
      if (!claimSuccess) {
        return NextResponse.redirect(
          new URL("/payment-failed?error=Deduction+failed", req.url),
          303
        );
      }
    }

    // Success! Redirect to confirmation page with the correct database order UUID
    return NextResponse.redirect(
      new URL(`/orderconfirmed?orderId=${dbOrder.id}`, req.url),
      303
    );

  } catch (error: any) {
    console.error("[Razorpay Callback Error]:", error);
    return NextResponse.redirect(
      new URL(`/payment-failed?error=${encodeURIComponent(error.message || "Payment processing failed")}`, req.url),
      303
    );
  }
}
