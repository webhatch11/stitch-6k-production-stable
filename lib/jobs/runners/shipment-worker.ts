process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { shipmentSyncProcessor } from "../shipment-sync";
import { shipmentRetryProcessor } from "../shipment-retry";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Shipment Worker",
    queues: ["shipment-sync", "shipment-retry"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"],
    redisUrl: REDIS_URL,
  });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  console.log("[Shipment Worker] Initializing Workers...");
  
  const syncWorker = new Worker("shipment-sync", shipmentSyncProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const retryWorker = new Worker("shipment-retry", shipmentRetryProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  syncWorker.on("completed", (job) => {
    console.log(`[Shipment Sync Worker] Job ${job.id} completed successfully`);
  });
  syncWorker.on("failed", (job, err) => {
    console.error(`[Shipment Sync Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "shipment-sync" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  retryWorker.on("completed", (job) => {
    console.log(`[Shipment Retry Worker] Job ${job.id} completed successfully`);
  });
  retryWorker.on("failed", (job, err) => {
    console.error(`[Shipment Retry Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "shipment-retry" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown([syncWorker, retryWorker], connection);
  console.log("[Shipment Worker] Active and listening for jobs on both sync and retry queues.");
}

main().catch((err) => {
  console.error("[Shipment Worker] Fatal startup crash:", err);
  process.exit(1);
});
