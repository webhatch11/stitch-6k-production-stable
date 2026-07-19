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
import { startHeartbeat } from "./heartbeat";
import { workerLog } from "./logger";
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

  workerLog({
    worker: "cleanup",
    event: "startup",
    message: "Cleanup Worker starting up..."
  });

  // Start periodic heartbeat
  await startHeartbeat(connection, "cleanup");

  const wrappedReservationProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "cleanup",
      queue: "reservation-cleanup",
      jobId: job.id,
      event: "job_started",
      message: "Starting expired stock reservations cleanup sweep"
    });

    try {
      const res = await reservationCleanupProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "cleanup",
        queue: "reservation-cleanup",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: "Successfully expired abandoned stock reservations"
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "cleanup",
        queue: "reservation-cleanup",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: "Failed expired stock reservations cleanup sweep"
      });
      throw err;
    }
  };

  const wrappedProductProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "cleanup",
      queue: "product-cleanup",
      jobId: job.id,
      event: "job_started",
      message: "Starting trashed product purge sweep"
    });

    try {
      const res = await productCleanupProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "cleanup",
        queue: "product-cleanup",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: "Successfully purged expired trashed products"
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "cleanup",
        queue: "product-cleanup",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: "Failed trashed product purge sweep"
      });
      throw err;
    }
  };

  const wrappedRecoveryProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "cleanup",
      queue: "payment-recovery",
      jobId: job.id,
      event: "job_started",
      message: `Starting payment recovery sweep for job key: ${job.name}`
    });

    try {
      const res = await paymentRecoveryProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "cleanup",
        queue: "payment-recovery",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: `Successfully executed payment recovery sweep for job key: ${job.name}`
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "cleanup",
        queue: "payment-recovery",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: `Failed payment recovery sweep for job key: ${job.name}`
      });
      throw err;
    }
  };

  const reservationWorker = new Worker("reservation-cleanup", wrappedReservationProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const productWorker = new Worker("product-cleanup", wrappedProductProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const recoveryWorker = new Worker("payment-recovery", wrappedRecoveryProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  reservationWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "reservation-cleanup" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  productWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "product-cleanup" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  recoveryWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "payment-recovery" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown([reservationWorker, productWorker, recoveryWorker], connection);
  workerLog({
    worker: "cleanup",
    event: "info",
    message: "Cleanup Worker is active and listening for jobs on reservation, product, and recovery queues."
  });
}

main().catch((err) => {
  workerLog({
    level: "error",
    worker: "cleanup",
    event: "error",
    error: err.message || String(err),
    message: "Fatal startup crash in Cleanup Worker"
  });
  process.exit(1);
});
