process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { paymentProcessingProcessor } from "../payment-processing";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Payment Worker",
    queues: ["payment-processing"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RAZORPAY_KEY_SECRET"],
    redisUrl: REDIS_URL,
  });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  console.log("[Payment Worker] Initializing Worker...");
  const worker = new Worker("payment-processing", paymentProcessingProcessor, {
    connection: connection as any,
    concurrency: 1, // Concurrency 1 ensures strict sequence
  });

  worker.on("completed", (job) => {
    console.log(`[Payment Worker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Payment Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "payment-processing" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown(worker, connection);
  console.log("[Payment Worker] Active and listening for jobs.");
}

main().catch((err) => {
  console.error("[Payment Worker] Fatal startup crash:", err);
  process.exit(1);
});
