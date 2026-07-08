import { Queue } from "bullmq";
import IORedis from "ioredis";

export async function initJobs() {
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
        repeat: {
          every: 30 * 60 * 1000, // 30 mins
        },
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

    // Add cleanup job every 5 minutes
    await cleanupQueue.add(
      "cleanup_expired_reservations",
      {},
      {
        repeat: {
          every: 5 * 60 * 1000, // 5 mins
        },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log("[Jobs Init] ✓ Scheduled repeatable reservation-cleanup sweep job (every 5m)");

    // Close temporary connection
    await connection.quit();

  } catch (err: any) {
    console.warn("[Jobs Init] Failed to schedule background jobs due to Redis connection issue:", err.message);
  }
}
