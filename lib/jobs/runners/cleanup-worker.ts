process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { reservationCleanupProcessor } from "../reservation-cleanup";
import { productCleanupProcessor } from "../product-cleanup";
import { paymentRecoveryProcessor } from "../payment-recovery";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Cleanup Worker",
    queues: ["reservation-cleanup", "product-cleanup", "payment-recovery"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    redisUrl: REDIS_URL,
  });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  console.log("[Cleanup Worker] Initializing Workers...");
  
  const reservationWorker = new Worker("reservation-cleanup", reservationCleanupProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const productWorker = new Worker("product-cleanup", productCleanupProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const recoveryWorker = new Worker("payment-recovery", paymentRecoveryProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  reservationWorker.on("completed", (job) => {
    console.log(`[Reservation Cleanup Worker] Job ${job.id} completed successfully`);
  });
  reservationWorker.on("failed", (job, err) => {
    console.error(`[Reservation Cleanup Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "reservation-cleanup" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  productWorker.on("completed", (job) => {
    console.log(`[Product Cleanup Worker] Job ${job.id} completed successfully`);
  });
  productWorker.on("failed", (job, err) => {
    console.error(`[Product Cleanup Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "product-cleanup" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  recoveryWorker.on("completed", (job) => {
    console.log(`[Payment Recovery Worker] Job ${job.id} completed successfully`);
  });
  recoveryWorker.on("failed", (job, err) => {
    console.error(`[Payment Recovery Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "payment-recovery" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown([reservationWorker, productWorker, recoveryWorker], connection);
  console.log("[Cleanup Worker] Active and listening for jobs on reservation, product, and payment-recovery queues.");
}

main().catch((err) => {
  console.error("[Cleanup Worker] Fatal startup crash:", err);
  process.exit(1);
});
