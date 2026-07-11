import { Worker } from "bullmq";
import { supabaseService as supabase } from "../../lib/supabase-service";
import IORedis from "ioredis";
import * as Sentry from "@sentry/nextjs";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

/**
 * Loyalty Points Expiry Worker
 * Runs daily to sweep expired credit transactions and deduct them from user balances.
 * Points expire 12 months from the date they are earned.
 *
 * Safety rules:
 * - Only deducts min(expiredPoints, storedBalance) to avoid negative balances
 * - Marks each processed row with expired_processed timestamp (idempotent)
 * - Processes in batches of 200 users to avoid long-running transactions
 */
export const loyaltyExpiryWorker = new Worker(
  "loyalty-expiry",
  async (job) => {
    if (job.name !== "expire_loyalty_points") return;

    if (!supabase) {
      console.warn("[Loyalty Expiry Worker] Supabase not configured — skipping.");
      return;
    }

    console.log("[Loyalty Expiry Worker] Starting expiry sweep...");

    const now = new Date().toISOString();

    // Fetch expired credit transactions that haven't been processed yet
    const { data: expiredRows, error: fetchErr } = await supabase
      .from("loyalty_transactions")
      .select("id, user_id, points, expires_at")
      .eq("type", "credit")
      .lt("expires_at", now)
      .is("expired_processed", null)
      .limit(500);

    if (fetchErr) {
      console.error("[Loyalty Expiry Worker] Fetch error:", fetchErr);
      Sentry.captureException(fetchErr, { tags: { queue: "loyalty-expiry" } });
      return;
    }

    if (!expiredRows || expiredRows.length === 0) {
      console.log("[Loyalty Expiry Worker] No expired points found.");
      return;
    }

    // Aggregate expired points per user
    const userExpiredMap = new Map<string, number>();
    const txIds: string[] = [];

    for (const row of expiredRows) {
      txIds.push(row.id);
      const current = userExpiredMap.get(row.user_id) || 0;
      userExpiredMap.set(row.user_id, current + Number(row.points));
    }

    console.log(`[Loyalty Expiry Worker] Found ${expiredRows.length} expired rows for ${userExpiredMap.size} users.`);

    // Process each user
    for (const [userId, expiredPoints] of userExpiredMap) {
      try {
        // Get current stored balance
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("loyalty_points")
          .eq("id", userId)
          .maybeSingle();

        if (profileErr || !profile) {
          console.warn(`[Loyalty Expiry Worker] Could not fetch profile for ${userId}`);
          continue;
        }

        const storedBalance = Number(profile.loyalty_points);
        // Only deduct what's actually in the balance (safety guard against negative)
        const deduction = Math.min(expiredPoints, storedBalance);

        if (deduction <= 0) {
          console.log(`[Loyalty Expiry Worker] No deduction needed for ${userId} (balance=${storedBalance})`);
        } else {
          const newBalance = storedBalance - deduction;
          const { error: updateErr } = await supabase
            .from("profiles")
            .update({ loyalty_points: newBalance })
            .eq("id", userId);

          if (updateErr) {
            console.error(`[Loyalty Expiry Worker] Balance update failed for ${userId}:`, updateErr);
            continue;
          }

          // Log expiry as a debit transaction for user-facing history
          await supabase.from("loyalty_transactions").insert({
            id: `LTX-EXP-${userId.slice(0, 8)}-${Date.now()}`,
            user_id: userId,
            date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
            points: deduction,
            type: "debit",
            description: `${deduction} points expired (12-month validity)`,
          });

          console.log(`[Loyalty Expiry Worker] Deducted ${deduction} expired pts for user ${userId} (balance: ${storedBalance} → ${newBalance})`);
        }
      } catch (err) {
        console.error(`[Loyalty Expiry Worker] Error processing user ${userId}:`, err);
        Sentry.captureException(err, {
          tags: { queue: "loyalty-expiry" },
          extra: { userId, expiredPoints },
        });
      }
    }

    // Mark all processed rows as expired_processed (idempotent sweep)
    const sweepTime = new Date().toISOString();
    const { error: markErr } = await supabase
      .from("loyalty_transactions")
      .update({ expired_processed: sweepTime })
      .in("id", txIds);

    if (markErr) {
      console.error("[Loyalty Expiry Worker] Failed to mark rows as processed:", markErr);
    } else {
      console.log(`[Loyalty Expiry Worker] Marked ${txIds.length} rows as expired_processed.`);
    }

    console.log("[Loyalty Expiry Worker] Expiry sweep complete.");
  },
  { connection: connection as any }
);

loyaltyExpiryWorker.on("completed", (job) => {
  console.log(`[Loyalty Expiry Worker] Job ${job.id} completed successfully`);
});

loyaltyExpiryWorker.on("failed", (job, err) => {
  console.error(`[Loyalty Expiry Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "loyalty-expiry" },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
    },
  });
});
