import { Worker } from "bullmq";
import { supabaseService as supabase } from "../../lib/supabase-service";
import { db } from "../db";
import IORedis from "ioredis";
import * as Sentry from "@sentry/nextjs";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export async function pointsCreditProcessor(job: any) {
  if (job.name !== "credit_pending_points") return;

  if (!supabase) {
    console.warn("[Points Credit Worker] Supabase not configured — skipping.");
    return;
  }

  console.log("[Points Credit Worker] Starting points credit sweep...");

  const now = new Date().toISOString();

  // Query pending orders whose scheduled time has passed
  const { data: pendingOrders, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, original_total, coupon_discount, points_earned, user_id")
    .eq("points_credit_status", "pending")
    .not("points_credit_scheduled_at", "is", null)
    .lte("points_credit_scheduled_at", now)
    .gt("points_earned", 0)
    .not("status", "in", "(Cancelled,Return Requested,Return in Transit,Returned,Return Rejected,RTO Initiated,RTO Delivered,Failed)");

  if (fetchErr) {
    console.error("[Points Credit Worker] Error fetching pending orders:", fetchErr);
    Sentry.captureException(fetchErr, { tags: { queue: "points-credit" } });
    throw fetchErr;
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    console.log("[Points Credit Worker] No pending points to credit.");
    return;
  }

  console.log(`[Points Credit Worker] Found ${pendingOrders.length} order(s) pending credit.`);

  let successCount = 0;
  let failCount = 0;

  for (const order of pendingOrders) {
    try {
      const hasActiveReturn = ['Cancelled', 'Return Requested', 'Return in Transit', 'Returned', 'Return Rejected', 'RTO Initiated', 'RTO Delivered', 'Failed'].includes(order.status);
      
      if (hasActiveReturn) {
        console.log(`[Points Credit Worker] Order ${order.id} status is ${order.status}. Voiding points.`);
        await supabase
          .from("orders")
          .update({ points_credit_status: "cancelled" })
          .eq("id", order.id);
        successCount++;
        continue;
      }

      // Verify order status is Delivered / delivered before crediting
      const statusLower = (order.status || "").toLowerCase();
      if (statusLower !== "delivered") {
        console.log(`[Points Credit Worker] Order ${order.id} status is ${order.status} (not Delivered). Skipping points credit.`);
        continue;
      }

      const earned = order.points_earned || 0;

      if (earned <= 0) {
        // No points to credit, mark as credited
        await supabase
          .from('orders')
          .update({ points_credit_status: 'credited' })
          .eq('id', order.id);
        successCount++;
        continue;
      }

      console.log(`[Points Credit Worker] Crediting points for order ${order.id} (user: ${order.user_id})...`);
      
      // Credit the stored amount directly
      await db.applyLoyaltyCredit(
        earned,
        `Points earned for Order #${order.id}`,
        order.id,
        order.user_id
      );

      // Update status to credited
      await supabase
        .from("orders")
        .update({ points_credit_status: "credited" })
        .eq("id", order.id);

      successCount++;
    } catch (err: any) {
      failCount++;
      console.error(`[Points Credit Worker] Failed to credit points for order ${order.id}:`, err);
      Sentry.captureException(err, {
        tags: { queue: "points-credit" },
        extra: { orderId: order.id },
      });
    }
  }

  console.log(`[Points Credit Worker] Points credit sweep completed. Successfully processed: ${successCount}, Failed: ${failCount}`);

  if (failCount > 0) {
    throw new Error(`Points credit job completed with ${failCount} failures.`);
  }
}

export const pointsCreditWorker = new Worker(
  "points-credit",
  pointsCreditProcessor,
  { connection: connection as any }
);

export default pointsCreditProcessor;
