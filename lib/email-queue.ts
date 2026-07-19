import { Queue } from "bullmq";
import { supabaseService as supabase } from "./supabase-service";
import { transporter, FROM_EMAIL } from "./email";
import { getSharedProducerConnection } from "./jobs/connection";

// Initialize BullMQ Queue
let emailQueue: Queue | null = null;
if (process.env.REDIS_URL) {
  const connection = getSharedProducerConnection();
  emailQueue = new Queue("email-delivery", { connection: connection as any });
}

export async function queueEmailHelper(params: {
  recipient: string;
  subject: string;
  html: string;
  templateName: string;
  variables: any;
  deduplicationKey: string;
}): Promise<void> {
  if (!emailQueue || !supabase) {
    console.warn("[Email Subsystem] Redis or Supabase not configured — fallback to synchronous SMTP send");
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: params.recipient,
        subject: params.subject,
        html: params.html,
      });
    } catch (err: any) {
      console.error("[Email Subsystem Fallback] Failed to deliver email:", err.message || err);
    }
    return;
  }

  const logId = crypto.randomUUID();
  try {
    // Atomic queue + log creation
    // 1. Try to insert to database with unique deduplication key
    const { data, error } = await supabase
      .from("email_logs")
      .insert({
        id: logId,
        recipient: params.recipient,
        subject: params.subject,
        template_name: params.templateName,
        template_variables: params.variables || {},
        status: "queued",
        deduplication_key: params.deduplicationKey,
      })
      .select();

    if (error) {
      if (error.code === "23505") { // PostgreSQL unique_violation code
        console.log(`[Email Subsystem] Duplicate email detected for key: ${params.deduplicationKey}. Skipping.`);
        return;
      }
      throw error;
    }

    // 2. If insert succeeded, push to BullMQ queue
    if (data && data.length > 0) {
      await emailQueue.add(
        params.templateName,
        {
          logId: logId,
          recipient: params.recipient,
          subject: params.subject,
          html: params.html,
        },
        {
          jobId: params.deduplicationKey,
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: false, // retain failed jobs for dead-letter review
        }
      );
      console.log(`[Email Subsystem] Successfully enqueued email (logId=${logId}) with dedupKey=${params.deduplicationKey}`);
    }
  } catch (err: any) {
    console.error(`[Email Subsystem] Error enqueuing email with dedupKey=${params.deduplicationKey}:`, err.message || err);
    // Fallback directly to SMTP send to guarantee delivery if Redis/DB transaction fails
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: params.recipient,
        subject: params.subject,
        html: params.html,
      });
    } catch (smtpErr: any) {
      console.error("[Email Subsystem Fallback] Failed to deliver email via fallback SMTP:", smtpErr.message || smtpErr);
    }
  }
}
