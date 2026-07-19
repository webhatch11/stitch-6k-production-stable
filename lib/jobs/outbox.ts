import { supabaseService as supabase } from "@/lib/supabase-service";
import { paymentProcessingQueue } from "./payment-processing";
import * as Sentry from "@sentry/nextjs";

export async function processOutbox(): Promise<void> {
  if (!supabase) {
    console.warn("[Outbox] Supabase service client not configured. Skipping execution.");
    return;
  }

  // Atomically claim pending events to prevent multiple workers from executing them
  const { data: events, error: claimError } = await supabase.rpc("claim_pending_outbox_events", {
    p_limit: 50
  });

  if (claimError) {
    console.error("[Outbox] Failed to claim pending outbox events:", claimError.message);
    return;
  }

  if (!events || events.length === 0) {
    return;
  }

  console.log(`[Outbox] Claimed ${events.length} pending events to process.`);

  for (const event of events) {
    try {
      if (event.event_type === "process_payment_side_effects") {
        const { order_id, razorpay_payment_id } = event.payload;
        if (!order_id) {
          throw new Error("Missing order_id in event payload");
        }

        const jobId = `payment_${order_id}_${razorpay_payment_id || "wallet"}`;
        await paymentProcessingQueue.add(
          "process_payment_side_effects",
          {
            orderId: order_id,
            razorpayPaymentId: razorpay_payment_id
          },
          {
            jobId // Deduplication key
          }
        );
      }

      // Mark the event as PROCESSED on success
      const { error: updateError } = await supabase
        .from("outbox_events")
        .update({
          status: "PROCESSED",
          processed_at: new Date().toISOString()
        })
        .eq("id", event.id);

      if (updateError) {
        throw new Error(`Failed to update status to PROCESSED: ${updateError.message}`);
      }

    } catch (err: any) {
      console.error(`[Outbox] Error processing event ${event.id}:`, err.message || err);

      // Fetch the current retry count for backoff
      const { data: currentRecord } = await supabase
        .from("outbox_events")
        .select("attempts")
        .eq("id", event.id)
        .maybeSingle();

      const nextAttempts = (currentRecord?.attempts || 0) + 1;

      if (nextAttempts >= 5) {
        // Permanently FAIL the event (dead-letter queue)
        await supabase
          .from("outbox_events")
          .update({
            status: "FAILED",
            attempts: nextAttempts,
            error: err.message || String(err)
          })
          .eq("id", event.id);

        Sentry.captureException(err, {
          tags: { area: "outbox", status: "FAILED" },
          extra: { eventId: event.id, payload: event.payload }
        });
      } else {
        // Revert status to PENDING for retry on the next interval loop
        await supabase
          .from("outbox_events")
          .update({
            status: "PENDING",
            attempts: nextAttempts,
            error: err.message || String(err)
          })
          .eq("id", event.id);
      }
    }
  }
}

/**
 * Re-queue and retry a failed (dead-lettered) outbox event manually
 */
export async function retryFailedOutboxEvent(eventId: string): Promise<{ success: boolean; message?: string }> {
  if (!supabase) {
    return { success: false, error: "Database not configured" } as any;
  }

  const { data: event, error: fetchError } = await supabase
    .from("outbox_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (fetchError || !event) {
    return { success: false, message: fetchError?.message || "Event not found" };
  }

  if (event.status !== "FAILED") {
    return { success: false, message: `Only FAILED events can be retried manually. Current status: ${event.status}` };
  }

  const { error: resetError } = await supabase
    .from("outbox_events")
    .update({
      status: "PENDING",
      attempts: 0,
      error: null
    })
    .eq("id", eventId);

  if (resetError) {
    return { success: false, message: `Failed to reset event: ${resetError.message}` };
  }

  // Trigger fast-path sweep asynchronously
  processOutbox().catch((err) => {
    console.error("[Outbox Retry] Fast-path trigger failed:", err);
  });

  return { success: true, message: "Outbox event reset to PENDING and swept successfully." };
}
