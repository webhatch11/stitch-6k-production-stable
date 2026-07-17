import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const paymentProcessingQueue = new Queue("payment-processing", {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  }
});

export const paymentProcessingWorker = new Worker(
  "payment-processing",
  async (job) => {
    const { orderId, razorpayPaymentId } = job.data;
    console.log(`[Payment Processing Worker] Processing side effects for order ${orderId}`);

    if (!supabase) throw new Error("Supabase not configured");

    const order = await db.getOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    let processingState = order.paymentProcessingState || {};

    // Step 1: Inventory Deduction
    if (!processingState.inventory) {
      console.log(`[Payment Processing Worker] Deducting inventory for ${orderId}`);
      const deductSuccess = await db.deductStock(order.cartItems || [], order.idempotencyKey || orderId);
      if (!deductSuccess) {
        throw new Error("Inventory deduction failed");
      }
      processingState.inventory = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    }

    // Step 2: Coupon Usage
    if (!processingState.coupon && order.couponCode) {
      console.log(`[Payment Processing Worker] Incrementing coupon usage for ${orderId}`);
      await db.incrementCouponUsage(order.couponCode);
      processingState.coupon = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    }

    // Step 3: Wallet Debit
    if (!processingState.wallet && order.walletPaid > 0) {
      console.log(`[Payment Processing Worker] Debiting wallet for ${orderId}`);
      const walletRes = await db.applyWalletDebit(order.walletPaid, order.id, order.userId || order.user_id!);
      if (!walletRes.success) throw new Error(`Wallet debit failed: ${walletRes.error}`);
      processingState.wallet = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    }

    // Step 4: Loyalty Points Debit
    if (!processingState.loyalty && order.pointsRedeemed > 0) {
      console.log(`[Payment Processing Worker] Debiting loyalty points for ${orderId}`);
      const loyaltyRes = await db.applyLoyaltyDebit(order.pointsRedeemed, order.id, order.userId || order.user_id!);
      if (!loyaltyRes.success) throw new Error(`Loyalty debit failed: ${loyaltyRes.error}`);
      processingState.loyalty = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    }

    // Step 5: Email Notification
    if (!processingState.email) {
      console.log(`[Payment Processing Worker] Sending confirmation email for ${orderId}`);
      
      let customerEmail = order.address_snapshot?.email || "";
      if (!customerEmail && (order.userId || order.user_id)) {
        const { data: profile } = await supabase.from("profiles").select("email").eq("id", order.userId || order.user_id).maybeSingle();
        if (profile?.email) customerEmail = profile.email;
      }

      if (customerEmail) {
        const { sendOrderConfirmationEmail } = await import("@/lib/email");
        
        const rawItems = order.cartItems || [];
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
        
        const addr = order.address_snapshot;
        const addressStr = addr ? [addr.name, addr.phone, addr.address_line_1, addr.address_line_2, `${addr.city} - ${addr.postal_code}`, addr.state, addr.country].filter(Boolean).join(", ") : "No address available";

        await sendOrderConfirmationEmail({
          id: order.id,
          customerName: order.customer || "Valued Customer",
          customerEmail,
          items: groupedItems,
          total: Number(order.total || 0),
          address: addressStr,
          couponCode: order.couponCode || null,
          couponDiscount: Number(order.couponDiscount || 0)
        });
      }
      
      processingState.email = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    }
    
    console.log(`[Payment Processing Worker] Successfully completed all side effects for ${orderId}`);
  },
  { connection: connection as any }
);

paymentProcessingWorker.on("completed", (job) => {
  console.log(`[Payment Processing Worker] Job ${job.id} completed successfully`);
});

paymentProcessingWorker.on("failed", (job, err) => {
  console.error(`[Payment Processing Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "payment-processing" },
    extra: { jobId: job?.id, jobData: job?.data },
  });
});
