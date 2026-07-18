import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import * as Sentry from "@sentry/nextjs";
import { paymentDebugLog } from "../payment-debug";

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
    const traceId = (processingState as any).traceId || "worker-no-trace";

    paymentDebugLog({
      traceId,
      functionName: "paymentProcessingWorker",
      orderId,
      razorpayPaymentId,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      reason: `BullMQ worker picked up job. Current state: ${JSON.stringify(processingState)}`
    });

    // Step 1: Inventory Deduction
    if (!processingState.inventory) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Executing stock deduction for items"
      });
      const deductSuccess = await db.deductStock(order.cartItems || [], order.idempotencyKey || orderId);
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: `db.deductStock outcome: ${deductSuccess ? "success" : "failed"}`,
        rpc: "deduct_variant_stock",
        rpcResult: deductSuccess ? "success" : "failed"
      });
      if (!deductSuccess) {
        throw new Error("Inventory deduction failed");
      }
      processingState.inventory = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    } else {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Inventory step already completed. Skipping."
      });
    }

    // Step 2: Coupon Usage
    if (!processingState.coupon && order.couponCode) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: `Incrementing coupon usage for: ${order.couponCode}`
      });
      await db.incrementCouponUsage(order.couponCode);
      processingState.coupon = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    } else if (order.couponCode) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Coupon step already completed. Skipping."
      });
    }

    // Step 3: Wallet Debit
    if (!processingState.wallet && order.walletPaid > 0) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: `Debiting user wallet: ${order.walletPaid}`
      });
      const walletRes = await db.applyWalletDebit(order.walletPaid, order.id, order.userId || order.user_id!);
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: `applyWalletDebit outcome: ${walletRes.success ? "success" : "failed"}`,
        metadata: walletRes
      });
      if (!walletRes.success) throw new Error(`Wallet debit failed: ${walletRes.error}`);
      processingState.wallet = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    } else if (order.walletPaid > 0) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Wallet debit step already completed. Skipping."
      });
    }

    // Step 4: Loyalty Points Debit
    if (!processingState.loyalty && order.pointsRedeemed > 0) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: `Debiting user loyalty points: ${order.pointsRedeemed}`
      });
      const loyaltyRes = await db.applyLoyaltyDebit(order.pointsRedeemed, order.id, order.userId || order.user_id!);
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: `applyLoyaltyDebit outcome: ${loyaltyRes.success ? "success" : "failed"}`,
        metadata: loyaltyRes
      });
      if (!loyaltyRes.success) throw new Error(`Loyalty debit failed: ${loyaltyRes.error}`);
      processingState.loyalty = true;
      await supabase.from("orders").update({ payment_processing_state: processingState }).eq("id", orderId);
    } else if (order.pointsRedeemed > 0) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Loyalty points step already completed. Skipping."
      });
    }

    // Step 5: Email Notification
    if (!processingState.email) {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Resolving customer email and sending confirmation"
      });
      
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
    } else {
      paymentDebugLog({
        traceId,
        functionName: "paymentProcessingWorker",
        orderId,
        razorpayPaymentId,
        reason: "Email step already completed. Skipping."
      });
    }
    
    paymentDebugLog({
      traceId,
      functionName: "paymentProcessingWorker",
      orderId,
      razorpayPaymentId,
      reason: "Successfully finished all side-effects for order"
    });
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
