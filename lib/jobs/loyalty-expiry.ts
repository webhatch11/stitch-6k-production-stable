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
 * Each user is processed by the loyalty_atomic_expire_user() Postgres function,
 * which — in a single locked transaction — claims that user's expired/unswept
 * credit rows (idempotent), decrements the balance without a read-modify-write
 * race, and writes the expiry debit ledger row. The worker only enumerates
 * users and drains the full backlog across iterations.
 */
const USER_BATCH = 200;      // users processed per iteration
const MAX_ITERATIONS = 100;  // hard cap: up to 20k users/run, prevents spinning

// Shape of the loyalty_atomic_expire_user() RPC result.
type ExpireResult = { success: boolean; deducted?: number; new_balance?: number; error?: string };

export async function loyaltyExpiryProcessor(job: any) {
    if (job.name !== "expire_loyalty_points") return;

    if (!supabase) {
      console.warn("[Loyalty Expiry Worker] Supabase not configured — skipping.");
      return;
    }

    console.log("[Loyalty Expiry Worker] Starting expiry sweep...");

    // Fixed cutoff for this run; rows that expire mid-run are handled next run.
    const cutoff = new Date().toISOString();
    const failedUsers = new Set<string>();
    let totalUsers = 0;
    let totalDeducted = 0;
    let iterations = 0;

    while (iterations++ < MAX_ITERATIONS) {
      // Find users that still have expired, unswept credit rows.
      const { data: rows, error: fetchErr } = await supabase
        .from("loyalty_transactions")
        .select("user_id")
        .eq("type", "credit")
        .lt("expires_at", cutoff)
        .is("expired_processed", null)
        .limit(2000);

      if (fetchErr) {
        console.error("[Loyalty Expiry Worker] Fetch error:", fetchErr);
        Sentry.captureException(fetchErr, { tags: { queue: "loyalty-expiry" } });
        break;
      }

      if (!rows || rows.length === 0) break; // backlog drained

      // Distinct users not already known to fail this run.
      const userIds = Array.from(new Set(rows.map((r) => r.user_id as string)))
        .filter((u) => !failedUsers.has(u))
        .slice(0, USER_BATCH);

      if (userIds.length === 0) break; // only previously-failed users remain

      let progressed = false;
      for (const userId of userIds) {
        const { data, error: rpcErr } = await supabase.rpc(
          "loyalty_atomic_expire_user",
          { p_user_id: userId }
        );
        const res = data as ExpireResult | null;

        if (rpcErr || !res || res.success !== true) {
          failedUsers.add(userId);
          console.error(`[Loyalty Expiry Worker] RPC failed for ${userId}:`, rpcErr || res);
          Sentry.captureException(rpcErr || new Error("loyalty_atomic_expire_user returned failure"), {
            tags: { queue: "loyalty-expiry" },
            extra: { userId, result: res },
          });
          continue;
        }

        progressed = true;
        totalUsers++;
        totalDeducted += Number(res.deducted || 0);
      }

      // If a whole batch made no progress (e.g. all RPCs failing), stop rather
      // than re-fetching the same rows forever.
      if (!progressed) break;
    }

    console.log(
      `[Loyalty Expiry Worker] Sweep complete. Users processed: ${totalUsers}, points expired: ${totalDeducted}, failed users: ${failedUsers.size}.`
    );
    if (failedUsers.size > 0) {
      console.warn(`[Loyalty Expiry Worker] ${failedUsers.size} users failed and will retry next run.`);
    }
}

export let loyaltyExpiryWorker: Worker | null = null;
if (process.env.IS_WORKER === "true" && !process.env.IS_ISOLATED_RUNNER) {
  loyaltyExpiryWorker = new Worker(
    "loyalty-expiry",
    loyaltyExpiryProcessor,
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
}
