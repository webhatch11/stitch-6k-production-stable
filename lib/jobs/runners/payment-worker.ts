process.env.IS_ISOLATED_RUNNER = "true";
process.env.IS_WORKER = "true";

import "../env";
import { Worker } from "bullmq";
import { paymentProcessingProcessor } from "../payment-processing";
import { validateWorkerStartup } from "./startup-validation";
import { registerGracefulShutdown } from "./shutdown";
import { startHeartbeat } from "./heartbeat";
import { workerLog } from "./logger";
import { createWorkerConnection } from "../connection";
import * as Sentry from "@sentry/nextjs";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  await validateWorkerStartup({
    workerName: "Payment Worker",
    queues: ["payment-processing"],
    requiredEnvs: ["REDIS_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RAZORPAY_KEY_SECRET"],
    redisUrl: REDIS_URL,
  });

  const connection = createWorkerConnection("payment");

  workerLog({
    worker: "payment",
    event: "startup",
    message: "Payment Worker starting up..."
  });

  // Start periodic heartbeat
  await startHeartbeat(connection, "payment");

  const wrappedProcessor = async (job: any) => {
    const start = Date.now();
    workerLog({
      level: "info",
      worker: "payment",
      queue: "payment-processing",
      jobId: job.id,
      event: "job_started",
      message: `Starting payment processing for order ${job.data?.orderId}`
    });

    try {
      const res = await paymentProcessingProcessor(job);
      const durationMs = Date.now() - start;
      workerLog({
        level: "info",
        worker: "payment",
        queue: "payment-processing",
        jobId: job.id,
        event: "job_completed",
        durationMs,
        message: `Successfully processed payment side effects for order ${job.data?.orderId}`
      });
      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      workerLog({
        level: "error",
        worker: "payment",
        queue: "payment-processing",
        jobId: job.id,
        event: "job_failed",
        durationMs,
        error: err.message || String(err),
        message: `Failed to process payment side effects for order ${job.data?.orderId}`
      });
      throw err;
    }
  };

  const worker = new Worker("payment-processing", wrappedProcessor, {
    connection: connection as any,
    concurrency: 1, // Concurrency 1 ensures strict sequence
  });

  worker.on("failed", (job, err) => {
    Sentry.captureException(err, {
      tags: { queue: "payment-processing" },
      extra: { jobId: job?.id, jobData: job?.data },
    });
  });

  registerGracefulShutdown(worker, connection);
  workerLog({
    worker: "payment",
    event: "info",
    message: "Payment Worker is active and listening for jobs."
  });
}

main().catch((err) => {
  workerLog({
    level: "error",
    worker: "payment",
    event: "error",
    error: err.message || String(err),
    message: "Fatal startup crash in Payment Worker"
  });
  process.exit(1);
});
