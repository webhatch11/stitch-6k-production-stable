process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import { emailDeliveryProcessor } from "../email-delivery";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import { startHeartbeat } from "./heartbeat";
import { workerLog } from "./logger";
import { createWorkerConnection } from "../connection";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Email Worker",
    queues: ["email-delivery"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"],
    redisUrl: REDIS_URL,
  });

  const connection = createWorkerConnection("email");

  workerLog({
    worker: "email",
    event: "startup",
    message: "Email Worker starting up..."
  });

  // Start periodic heartbeat
  await startHeartbeat(connection, "email");

  const wrappedProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "email",
      queue: "email-delivery",
      jobId: job.id,
      event: "job_started",
      message: `Starting email delivery to ${job.data?.recipient}`
    });

    try {
      const res = await emailDeliveryProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "email",
        queue: "email-delivery",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: `Successfully delivered email to ${job.data?.recipient}`
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "email",
        queue: "email-delivery",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: `Failed email delivery to ${job.data?.recipient}`
      });
      throw err;
    }
  };

  const worker = new Worker("email-delivery", wrappedProcessor, {
    connection: connection as any,
    concurrency: 5, // Emails can be parallelized safely
  });

  worker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "email-delivery" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown(worker, connection);
  workerLog({
    worker: "email",
    event: "info",
    message: "Email Worker is active and listening for jobs."
  });
}

main().catch((err) => {
  workerLog({
    level: "error",
    worker: "email",
    event: "error",
    error: err.message || String(err),
    message: "Fatal startup crash in Email Worker"
  });
  process.exit(1);
});
