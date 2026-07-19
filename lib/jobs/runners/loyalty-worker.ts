process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { loyaltyExpiryProcessor } from "../loyalty-expiry";
import { pointsCreditProcessor } from "../points-credit";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import { startHeartbeat } from "./heartbeat";
import { workerLog } from "./logger";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Loyalty Worker",
    queues: ["loyalty-expiry", "points-credit"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    redisUrl: REDIS_URL,
  });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  workerLog({
    worker: "loyalty",
    event: "startup",
    message: "Loyalty Worker starting up..."
  });

  // Start periodic heartbeat
  await startHeartbeat(connection, "loyalty");

  const wrappedExpiryProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "loyalty",
      queue: "loyalty-expiry",
      jobId: job.id,
      event: "job_started",
      message: "Starting daily loyalty points expiration sweep"
    });

    try {
      const res = await loyaltyExpiryProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "loyalty",
        queue: "loyalty-expiry",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: "Successfully expired outstanding loyalty points"
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "loyalty",
        queue: "loyalty-expiry",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: "Failed daily loyalty points expiration sweep"
      });
      throw err;
    }
  };

  const wrappedCreditProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "loyalty",
      queue: "points-credit",
      jobId: job.id,
      event: "job_started",
      message: "Starting loyalty points credit sweep"
    });

    try {
      const res = await pointsCreditProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "loyalty",
        queue: "points-credit",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: "Successfully credited loyalty points to user profiles"
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "loyalty",
        queue: "points-credit",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: "Failed loyalty points credit sweep"
      });
      throw err;
    }
  };

  const expiryWorker = new Worker("loyalty-expiry", wrappedExpiryProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const creditWorker = new Worker("points-credit", wrappedCreditProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  expiryWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "loyalty-expiry" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  creditWorker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "points-credit" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown([expiryWorker, creditWorker], connection);
  workerLog({
    worker: "loyalty",
    event: "info",
    message: "Loyalty Worker is active and listening for jobs on loyalty-expiry and points-credit queues."
  });
}

main().catch((err) => {
  workerLog({
    level: "error",
    worker: "loyalty",
    event: "error",
    error: err.message || String(err),
    message: "Fatal startup crash in Loyalty Worker"
  });
  process.exit(1);
});
