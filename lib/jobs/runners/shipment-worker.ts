process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import { shipmentSyncProcessor } from "../shipment-sync";
import { shipmentRetryProcessor } from "../shipment-retry";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import { startHeartbeat } from "./heartbeat";
import { workerLog } from "./logger";
import { createWorkerConnection } from "../connection";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Shipment Worker",
    queues: ["shipment-sync", "shipment-retry"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"],
    redisUrl: REDIS_URL,
  });

  const connection = createWorkerConnection("shipment");

  workerLog({
    worker: "shipment",
    event: "startup",
    message: "Shipment Worker starting up..."
  });

  // Start periodic heartbeat
  await startHeartbeat(connection, "shipment");

  const wrappedSyncProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "shipment",
      queue: "shipment-sync",
      jobId: job.id,
      event: "job_started",
      message: "Starting shipment synchronization sweep"
    });

    try {
      const res = await shipmentSyncProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "shipment",
        queue: "shipment-sync",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: "Successfully synchronized active shipments with Shiprocket"
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "shipment",
        queue: "shipment-sync",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: "Failed shipment synchronization sweep"
      });
      throw err;
    }
  };

  const wrappedRetryProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "shipment",
      queue: "shipment-retry",
      jobId: job.id,
      event: "job_started",
      message: `Starting shipment dispatch retry for order ${job.data?.orderId}`
    });

    try {
      const res = await shipmentRetryProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "shipment",
        queue: "shipment-retry",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: `Successfully retried shipment dispatch for order ${job.data?.orderId}`
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "shipment",
        queue: "shipment-retry",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: `Failed shipment dispatch retry for order ${job.data?.orderId}`
      });
      throw err;
    }
  };

  const syncWorker = new Worker("shipment-sync", wrappedSyncProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const retryWorker = new Worker("shipment-retry", wrappedRetryProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  syncWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "shipment-sync" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  retryWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "shipment-retry" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown([syncWorker, retryWorker], connection);
  workerLog({
    worker: "shipment",
    event: "info",
    message: "Shipment Worker is active and listening for jobs on sync and retry queues."
  });
}

main().catch((err) => {
  workerLog({
    level: "error",
    worker: "shipment",
    event: "error",
    error: err.message || String(err),
    message: "Fatal startup crash in Shipment Worker"
  });
  process.exit(1);
});
