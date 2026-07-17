import { Worker } from "bullmq";
import { supabaseService as supabase } from "../../lib/supabase-service";
import IORedis from "ioredis";
import * as Sentry from "@sentry/nextjs";
import { transporter, FROM_EMAIL } from "../email";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const emailDeliveryWorker = new Worker(
  "email-delivery",
  async (job) => {
    const { logId, recipient, subject, html } = job.data;
    if (!logId) {
      console.warn(`[Email Delivery Worker] Missing logId for job ${job.id}`);
      return;
    }

    if (!supabase) {
      console.warn("[Email Delivery Worker] Supabase service role client not configured.");
      throw new Error("Supabase service role client not configured.");
    }

    // 1. Update status to 'sending' and increment attempt
    const attempts = (job.attemptsMade || 0) + 1;
    await supabase
      .from("email_logs")
      .update({
        status: "sending",
        attempts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    try {
      console.log(`[Email Delivery Worker] Sending email logId=${logId} to ${recipient} (Attempt ${attempts})...`);
      
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipient,
        subject: subject,
        html: html,
      });

      const providerMessageId = info.messageId || null;
      console.log(`[Email Delivery Worker] Email logId=${logId} successfully delivered. MessageID: ${providerMessageId}`);

      // 2. Update status to 'sent'
      await supabase
        .from("email_logs")
        .update({
          status: "sent",
          provider_message_id: providerMessageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);

    } catch (err: any) {
      const errMsg = err.message || err.toString();
      console.error(`[Email Delivery Worker] Failed attempt ${attempts} for logId=${logId}:`, errMsg);

      const maxAttempts = job.opts.attempts || 5;
      const isFinalAttempt = attempts >= maxAttempts;

      // 3. Update status to 'failed' on final retry, or store transient error message
      await supabase
        .from("email_logs")
        .update({
          status: isFinalAttempt ? "failed" : "sending",
          error_message: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);

      // Re-throw so BullMQ triggers retry and exponential backoff
      throw err;
    }
  },
  { connection: connection as any }
);

emailDeliveryWorker.on("completed", (job) => {
  console.log(`[Email Delivery Worker] Job ${job.id} completed successfully`);
});

emailDeliveryWorker.on("failed", (job, err) => {
  console.error(`[Email Delivery Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "email-delivery" },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
    },
  });
});
