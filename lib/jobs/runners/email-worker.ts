process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { emailDeliveryProcessor } from "../email-delivery";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Email Worker",
    queues: ["email-delivery"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"],
    redisUrl: REDIS_URL,
  });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  console.log("[Email Worker] Initializing Worker...");
  const worker = new Worker("email-delivery", emailDeliveryProcessor, {
    connection: connection as any,
    concurrency: 5, // Emails can be parallelized safely
  });

  worker.on("completed", (job) => {
    console.log(`[Email Worker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Email Worker] Job ${job?.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { queue: "email-delivery" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown(worker, connection);
  console.log("[Email Worker] Active and listening for jobs.");
}

main().catch((err) => {
  console.error("[Email Worker] Fatal startup crash:", err);
  process.exit(1);
});
