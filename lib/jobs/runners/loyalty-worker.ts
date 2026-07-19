process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { loyaltyExpiryProcessor } from "../loyalty-expiry";
import { pointsCreditProcessor } from "../points-credit";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
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

  console.log("[Loyalty Worker] Initializing Workers...");
  
  const expiryWorker = new Worker("loyalty-expiry", loyaltyExpiryProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  const creditWorker = new Worker("points-credit", pointsCreditProcessor, {
    connection: connection as any,
    concurrency: 1,
  });

  expiryWorker.on("completed", (job) => {
    console.log(`[Loyalty Expiry Worker] Job ${job.id} completed successfully`);
  });
  expiryWorker.on("failed", (job, err) => {
    console.error(`[Loyalty Expiry Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "loyalty-expiry" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  creditWorker.on("completed", (job) => {
    console.log(`[Points Credit Worker] Job ${job.id} completed successfully`);
  });
  creditWorker.on("failed", (job, err) => {
    console.error(`[Points Credit Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "points-credit" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown([expiryWorker, creditWorker], connection);
  console.log("[Loyalty Worker] Active and listening for jobs on loyalty-expiry and points-credit queues.");
}

main().catch((err) => {
  console.error("[Loyalty Worker] Fatal startup crash:", err);
  process.exit(1);
});
