/**
 * BullMQ Standalone Worker Entry Point
 *
 * Run with:   IS_WORKER=true node --require dotenv/config -r ts-node/register lib/jobs/worker.ts
 * Or via npm: npm run worker
 *
 * This process runs separately from Next.js on the VPS.
 * It reads jobs from Redis queues and processes them.
 * Set IS_WORKER=true in its environment so jobs-init.ts
 * knows to start workers (not just schedule queues).
 */

import "./env";

import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[Worker] FATAL: REDIS_URL environment variable is not set.");
  process.exit(1);
}

// Shared Redis connection for the worker process.
// maxRetriesPerRequest: null is REQUIRED for BullMQ workers.
export const workerConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
  enableReadyCheck: false,
});

workerConnection.on("connect", () => {
  console.log("[Worker] Redis connected.");
});
workerConnection.on("error", (err) => {
  console.error("[Worker] Redis error:", err.message);
});

console.log("[Worker] Starting Stitch 6K background job workers...");

// Import all worker modules — each file registers its BullMQ Worker on import.
// Workers only start because IS_WORKER=true guards in jobs-init.ts apply here.
import "./payment-recovery";
import "./payment-processing";
import "./reservation-cleanup";
import "./shipment-retry";
import "./shipment-sync";
import "./loyalty-expiry";
import "./product-cleanup";
import "./points-credit";
import "./email-delivery";

// Schedule all repeatable jobs into their queues
import { initJobs } from "./jobs-init";
initJobs()
  .then(() => {
    console.log("[Worker] All repeatable jobs scheduled.");
  })
  .catch((err) => {
    console.error("[Worker] Failed to schedule repeatable jobs:", err);
  });

console.log("[Worker] All workers active and listening for jobs.");

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
  try {
    await workerConnection.quit();
    console.log("[Worker] Redis connection closed.");
  } catch (err) {
    console.error("[Worker] Error during shutdown:", err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
