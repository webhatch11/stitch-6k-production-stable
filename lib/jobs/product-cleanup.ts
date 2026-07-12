import { Worker } from "bullmq";
import { supabaseService as supabase } from "../../lib/supabase-service";
import { db } from "../db";
import IORedis from "ioredis";
import * as Sentry from "@sentry/nextjs";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

/**
 * Product Permanent Deletion Cleanup Worker
 * Runs daily to find and permanently delete products that have exceeded their 7-day trash period.
 */
export const productCleanupWorker = new Worker(
  "product-cleanup",
  async (job) => {
    if (job.name !== "cleanup_expired_products") return;

    if (!supabase) {
      console.warn("[Product Cleanup Worker] Supabase not configured — skipping.");
      return;
    }

    console.log("[Product Cleanup Worker] Starting permanent deletion sweep...");

    const now = new Date().toISOString();

    // Query all products where scheduled_permanent_deletion_at has expired
    const { data: expiredProducts, error: fetchErr } = await supabase
      .from("products")
      .select("id, title")
      .not("scheduled_permanent_deletion_at", "is", null)
      .lte("scheduled_permanent_deletion_at", now);

    if (fetchErr) {
      console.error("[Product Cleanup Worker] Error fetching expired products:", fetchErr);
      Sentry.captureException(fetchErr, { tags: { queue: "product-cleanup" } });
      throw fetchErr;
    }

    if (!expiredProducts || expiredProducts.length === 0) {
      console.log("[Product Cleanup Worker] No expired products found.");
      return;
    }

    console.log(`[Product Cleanup Worker] Found ${expiredProducts.length} product(s) scheduled for permanent deletion.`);

    let successCount = 0;
    let failCount = 0;

    for (const product of expiredProducts) {
      try {
        console.log(`[Product Cleanup Worker] Permanently deleting product: ${product.title} (ID: ${product.id})`);
        await db.permanentlyDeleteProduct(product.id, undefined, "system", "Automated 7-day trash retention expiration");
        successCount++;
      } catch (err: any) {
        failCount++;
        console.error(`[Product Cleanup Worker] Failed to permanently delete product ID ${product.id}:`, err);
        Sentry.captureException(err, {
          tags: { queue: "product-cleanup" },
          extra: { productId: product.id, productTitle: product.title },
        });
      }
    }

    console.log(`[Product Cleanup Worker] Permanent deletion sweep completed. Successfully deleted: ${successCount}, Failed: ${failCount}`);

    if (failCount > 0) {
      throw new Error(`Cleanup job completed with ${failCount} failures.`);
    }
  },
  { connection: connection as any }
);

productCleanupWorker.on("completed", (job) => {
  console.log(`[Product Cleanup Worker] Job ${job.id} completed successfully`);
});

productCleanupWorker.on("failed", (job, err) => {
  console.error(`[Product Cleanup Worker] Job ${job?.id} failed:`, err);
  Sentry.captureException(err, {
    tags: { queue: "product-cleanup" },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
    },
  });
});
