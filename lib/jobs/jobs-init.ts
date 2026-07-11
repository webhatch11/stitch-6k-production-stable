import { Queue } from "bullmq";
import IORedis from "ioredis";

export async function initJobs() {
  // ── Guard 1: Never run workers inside Vercel serverless functions ──────────
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    console.log(
      "[Jobs] Vercel serverless detected — " +
        "BullMQ workers disabled. " +
        "Run the separate worker process on VPS."
    );
    return;
  }

  // ── Guard 2: Only schedule/start workers when IS_WORKER=true ──────────────
  // This prevents Next.js from accidentally spawning worker threads during
  // page rendering or build. The dedicated worker process sets IS_WORKER=true.
  if (process.env.IS_WORKER !== "true") {
    console.log(
      "[Jobs] Skipping worker init — " +
        "run the worker process separately with IS_WORKER=true."
    );
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("⚠️ REDIS_URL not configured. Background jobs are disabled.");
    return;
  }

  console.log("[Jobs Init] ℹ️ Initializing BullMQ background jobs...");

  try {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    });

    connection.on("error", (err) => {
      console.warn("[Jobs Init] Redis connection warning:", err.message);
    });

    // 1. Initialize Shipment Sync repeatable job
    const shipmentQueue = new Queue("shipment-sync", { connection: connection as any });

    // Clear old repeatable jobs to avoid duplicates
    const repeatableJobs = await shipmentQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await shipmentQueue.removeRepeatableByKey(job.key);
    }

    // Add new repeatable sync job every 30 minutes
    await shipmentQueue.add(
      "sync_active_shipments",
      {},
      {
        repeat: { every: 30 * 60 * 1000 }, // 30 mins
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log("[Jobs Init] ✓ Scheduled repeatable shipment-sync job (every 30m)");

    // 2. Initialize Reservation Cleanup repeatable job
    const cleanupQueue = new Queue("reservation-cleanup", { connection: connection as any });
    const cleanupRepeatables = await cleanupQueue.getRepeatableJobs();
    for (const job of cleanupRepeatables) {
      await cleanupQueue.removeRepeatableByKey(job.key);
    }

    await cleanupQueue.add(
      "cleanup_expired_reservations",
      {},
      {
        repeat: { every: 5 * 60 * 1000 }, // 5 mins
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log("[Jobs Init] ✓ Scheduled repeatable reservation-cleanup sweep job (every 5m)");

    // 3. Initialize Payment Recovery repeatable jobs
    const recoveryQueue = new Queue("payment-recovery", { connection: connection as any });
    const recoveryRepeatables = await recoveryQueue.getRepeatableJobs();
    for (const job of recoveryRepeatables) {
      await recoveryQueue.removeRepeatableByKey(job.key);
    }

    await recoveryQueue.add(
      "sweep_pending_payments",
      {},
      {
        repeat: { every: 15 * 60 * 1000 }, // 15 mins
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await recoveryQueue.add(
      "cleanup_expired_orders",
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 }, // 24 hours
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log("[Jobs Init] ✓ Scheduled repeatable payment-recovery jobs (sweep every 15m, cleanup every 24h)");

    // 4. Loyalty Points Expiry — daily sweep to deduct expired points
    const loyaltyExpiryQueue = new Queue("loyalty-expiry", { connection: connection as any });
    const loyaltyRepeatables = await loyaltyExpiryQueue.getRepeatableJobs();
    for (const job of loyaltyRepeatables) {
      await loyaltyExpiryQueue.removeRepeatableByKey(job.key);
    }
    await loyaltyExpiryQueue.add(
      "expire_loyalty_points",
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 }, // Run once every 24 hours
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log("[Jobs Init] ✓ Scheduled loyalty-expiry sweep job (every 24h)");

    // Close the temporary scheduling connection (workers use their own connections)
    await connection.quit();

  } catch (err: any) {
    console.warn("[Jobs Init] Failed to schedule background jobs due to Redis connection issue:", err.message);
  }
}
