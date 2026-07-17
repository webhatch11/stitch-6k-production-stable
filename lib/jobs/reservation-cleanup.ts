import { Worker } from "bullmq";
import { razorpay } from "../../lib/razorpay";
import { supabaseService as supabase } from "../../lib/supabase-service";
import { db } from "../../lib/db";
import IORedis from "ioredis";
import * as Sentry from "@sentry/nextjs";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const reservationCleanupWorker = new Worker(
  "reservation-cleanup",
  async (job) => {
    if (job.name === "cleanup_expired_reservations") {
      console.log("[Reservation Cleanup Worker] Scanning for expired payment-pending orders...");
      
      try {
        if (!supabase) return;

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        const { data: pendingOrders, error: fetchError } = await supabase
          .from("orders")
          .select("id, razorpay_order_id, status, wallet_paid, points_redeemed, idempotency_key, user_id")
          .eq("status", "Payment Pending")
          .lt("created_at", fifteenMinutesAgo);

        if (fetchError) {
          throw fetchError;
        }

        if (pendingOrders && pendingOrders.length > 0) {
          for (const order of pendingOrders) {
            try {
              if (order.razorpay_order_id) {
                const rzpOrder = await razorpay.orders.fetch(order.razorpay_order_id);
                if (rzpOrder.status === "paid") {
                  console.log(`[Reservation Cleanup Worker] Order ${order.id} is paid on Razorpay. Skipping cleanup.`);
                  continue;
                }
              }

              // CAS Claim Guard: Atomically claim order cancellation to prevent races
              const { data: claimedRow, error: claimErr } = await supabase
                .from("orders")
                .update({ status: "Cancelled", payment_status: "EXPIRED" })
                .eq("id", order.id)
                .eq("status", "Payment Pending")
                .select("id");

              if (claimErr || !claimedRow || claimedRow.length === 0) {
                console.log(`[Reservation Cleanup Worker] Order ${order.id} already claimed or processed by another worker.`);
                continue;
              }

              console.log(`[Reservation Cleanup Worker] Order ${order.id} is abandoned. Marking Cancelled and releasing reservation.`);

              await db.createPaymentAuditLog(order.id, "Payment Pending", "Cancelled", "cleanup_worker");
              await db.createOrderEvent(order.id, "Order Cancelled");

              if (order.idempotency_key) {
                await supabase
                  .from("inventory_reservations")
                  .update({ status: "EXPIRED" })
                  .eq("session_id", order.idempotency_key);
              }

              const targetUserId = order.user_id;
              if (order.wallet_paid > 0 && targetUserId) {
                try {
                  await db.applyWalletCredit(order.wallet_paid, `Recovery Rollback for ${order.id}`, order.id, targetUserId);
                } catch (walletErr) {
                  console.warn("[Reservation Cleanup Worker] Failed to credit wallet:", walletErr);
                }
              }
              if (order.points_redeemed > 0 && targetUserId) {
                try {
                  await db.applyLoyaltyCredit(order.points_redeemed, `Recovery Rollback for ${order.id}`, order.id, targetUserId);
                } catch (loyaltyErr) {
                  console.warn("[Reservation Cleanup Worker] Failed to credit loyalty:", loyaltyErr);
                }
              }

            } catch (err) {
              console.error(`[Reservation Cleanup Worker] Failed to cleanup order ${order.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(
          '[reservation-cleanup] Fatal error:', err
        );
        Sentry.captureException(err, {
          tags: { worker: 'reservation-cleanup' }
        });
        throw err;
      }
    }
  },
  { connection: connection as any }
);

reservationCleanupWorker.on("completed", (job) => {
  console.log(`[Reservation Cleanup Worker] Job ${job.id} completed successfully`);
});
reservationCleanupWorker.on("failed", (job, err) => {
  console.error(`[Reservation Cleanup Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "reservation-cleanup" },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
    },
  });
});
