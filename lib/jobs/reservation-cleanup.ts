import { Worker } from "bullmq";
import { razorpay } from "../../lib/razorpay";
import { supabaseService as supabase } from "../../lib/supabase-service";
import { db } from "../../lib/db";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const reservationCleanupWorker = new Worker(
  "reservation-cleanup",
  async (job) => {
    if (job.name === "cleanup_expired_reservations") {
      console.log("[Reservation Cleanup Worker] Scanning for expired payment-pending orders...");
      
      if (!supabase) return;

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { data: pendingOrders, error: fetchError } = await supabase
        .from("orders")
        .select("id, razorpay_order_id, status, wallet_paid, points_redeemed, idempotency_key")
        .eq("status", "PAYMENT_PENDING")
        .lt("created_at", fifteenMinutesAgo);

      if (fetchError) {
        console.error("[Reservation Cleanup Worker] Error fetching pending orders:", fetchError);
        return;
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

            console.log(`[Reservation Cleanup Worker] Order ${order.id} is abandoned. Marking EXPIRED and releasing reservation.`);

            await db.saveOrder({
              id: order.id,
              status: "EXPIRED"
            });

            await db.createPaymentAuditLog(order.id, "PAYMENT_PENDING", "EXPIRED", "cleanup_worker");
            await db.createOrderEvent(order.id, "Order Expired");

            await supabase
              .from("orders")
              .update({ payment_status: "EXPIRED", status: "EXPIRED" })
              .eq("id", order.id);

            if (order.idempotency_key) {
              await supabase
                .from("inventory_reservations")
                .update({ status: "EXPIRED" })
                .eq("session_id", order.idempotency_key);
            }

            if (order.wallet_paid > 0) {
              try {
                await db.applyWalletCredit(order.wallet_paid, `Recovery Rollback for ${order.id}`, order.id);
              } catch (walletErr) {
                console.warn("[Reservation Cleanup Worker] Failed to credit wallet:", walletErr);
              }
            }
            if (order.points_redeemed > 0) {
              try {
                await db.applyLoyaltyCredit(order.points_redeemed, `Recovery Rollback for ${order.id}`, order.id);
              } catch (loyaltyErr) {
                console.warn("[Reservation Cleanup Worker] Failed to credit loyalty:", loyaltyErr);
              }
            }

          } catch (err) {
            console.error(`[Reservation Cleanup Worker] Failed to cleanup order ${order.id}:`, err);
          }
        }
      }
    }
  },
  { connection }
);

reservationCleanupWorker.on("completed", (job) => {
  console.log(`[Reservation Cleanup Worker] Job ${job.id} completed successfully`);
});
reservationCleanupWorker.on("failed", (job, err) => {
  console.error(`[Reservation Cleanup Worker] Job ${job?.id} failed:`, err);
});
