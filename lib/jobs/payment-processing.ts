import { Queue } from "bullmq";
import { db } from "@/lib/db";
import { supabaseService as supabase } from "@/lib/supabase-service";
import * as Sentry from "@sentry/nextjs";
import { paymentDebugLog } from "../payment-debug";
import { getSharedProducerConnection } from "./connection";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = getSharedProducerConnection();

export const paymentProcessingQueue = new Queue("payment-processing", {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  }
});

export async function paymentProcessingProcessor(job: any) {
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

    // Financial and inventory operations (Stock deduction, coupon, wallet, loyalty debits)
    // are now processed atomically within the SQL transaction immediately after verification.
    // The worker is responsible only for asynchronous tasks (e.g. email notification).
    paymentDebugLog({
      traceId,
      functionName: "paymentProcessingWorker",
      orderId,
      razorpayPaymentId,
      reason: "Skipping transactional financial/inventory steps (delegated to atomic transactional RPC)."
    });

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
}


