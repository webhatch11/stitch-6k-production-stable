import { Worker } from "bullmq";
import { razorpay } from "@/lib/razorpay";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { db } from "@/lib/db";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const paymentRecoveryWorker = new Worker(
  "payment-recovery",
  async (job) => {
    if (job.name === "sweep_pending_payments") {
      console.log("[Payment Recovery Worker] Scanning for abandoned payments...");
      
      if (!supabase) return;

      // 1. Find orders PAYMENT_PENDING older than 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id, razorpay_order_id, cart_items, wallet_paid, points_redeemed, idempotency_key")
        .eq("payment_status", "PAYMENT_PENDING")
        .lt("created_at", fifteenMinutesAgo);

      if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          try {
            // Check Razorpay API
            if (order.razorpay_order_id) {
              const rzpOrder = await razorpay.orders.fetch(order.razorpay_order_id);
              
              if (rzpOrder.status === "paid") {
                // Should not happen if webhook/client fired, but if it did:
                await supabase.from("orders").update({ payment_status: "Paid", status: "Paid" }).eq("id", order.id);
                continue;
              }
            }

            // Order is truly abandoned or failed.
            console.log(`[Payment Recovery] Marking order ${order.id} as Cancelled and restoring inventory.`);
            
            // Mark Cancelled
            await supabase.from("orders").update({ payment_status: "EXPIRED", status: "Cancelled" }).eq("id", order.id);
            await db.saveOrder({ id: order.id, status: "Cancelled" });

            // Restore Inventory
            if (Array.isArray(order.cart_items) && order.cart_items.length > 0) {
              await db.restoreStock(order.cart_items, order.idempotency_key);
            }

            // Rollback wallet & loyalty if they were deducted initially
            if (order.wallet_paid > 0) {
              await db.applyWalletCredit(order.wallet_paid, `Recovery Rollback for ${order.id}`, order.id);
            }
            if (order.points_redeemed > 0) {
              await db.applyLoyaltyCredit(order.points_redeemed, `Recovery Rollback for ${order.id}`, order.id);
            }

            // Log recovery action
            const { data: payment } = await supabase.from("payments").select("id").eq("order_id", order.id).single();
            if (payment) {
              await supabase.from("payment_logs").insert({
                payment_id: payment.id,
                previous_status: "CREATED",
                new_status: "Cancelled",
                metadata: { source: "payment_recovery_worker" }
              });
              await supabase.from("payments").update({ status: "EXPIRED" }).eq("id", payment.id);
            }

          } catch (err) {
            console.error(`[Payment Recovery] Failed to recover order ${order.id}:`, err);
          }
        }
      }
    } else if (job.name === "cleanup_expired_orders") {
      console.log("[Payment Recovery Worker] Cleaning up old Cancelled orders...");
      if (!supabase) return;
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Cleanup
      await supabase
        .from("orders")
        .delete()
        .eq("status", "Cancelled")
        .lt("created_at", twentyFourHoursAgo);
    }
  },
  { connection: connection as any }
);

import * as Sentry from "@sentry/nextjs";

paymentRecoveryWorker.on("completed", (job) => {
  console.log(`[Payment Recovery Worker] Job ${job.id} completed successfully`);
});
paymentRecoveryWorker.on("failed", (job, err) => {
  console.error(`[Payment Recovery Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "payment-recovery" },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
    },
  });
});
