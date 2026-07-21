import { cloudinary } from "../cloudinary";
import { supabaseService as supabase } from "../supabase-service";
import * as Sentry from "@sentry/nextjs";

/**
 * Return Image Cleanup Worker
 * Runs daily to find orders with expired return image retention schedules
 * and permanently destroys the assets in Cloudinary.
 */
export async function returnImageCleanupProcessor(job: any) {
  if (job.name !== "cleanup_expired_return_images") return;

  if (!supabase) {
    console.warn("[Return Image Cleanup Worker] Supabase not configured — skipping.");
    return;
  }

  console.log("[Return Image Cleanup Worker] Starting image deletion sweep...");

  const now = new Date().toISOString();

  // Fetch orders where return_images_deletion_scheduled_at has expired and they aren't deleted
  const { data: expiredOrders, error: fetchErr } = await supabase
    .from("orders")
    .select("id, return_images")
    .not("return_images_deletion_scheduled_at", "is", null)
    .lte("return_images_deletion_scheduled_at", now)
    .eq("return_images_deleted", false);

  if (fetchErr) {
    console.error("[Return Image Cleanup Worker] Error fetching orders:", fetchErr);
    Sentry.captureException(fetchErr, { tags: { queue: "return-image-cleanup" } });
    throw fetchErr;
  }

  if (!expiredOrders || expiredOrders.length === 0) {
    console.log("[Return Image Cleanup Worker] No expired return images found.");
    return;
  }

  console.log(`[Return Image Cleanup Worker] Found ${expiredOrders.length} order(s) with return images to purge.`);

  let successCount = 0;
  let failCount = 0;

  for (const order of expiredOrders) {
    try {
      const imagesList = order.return_images || [];
      if (Array.isArray(imagesList)) {
        for (const img of imagesList) {
          if (img.public_id) {
            console.log(`[Return Image Cleanup Worker] Purging image ${img.public_id} from Cloudinary...`);
            await cloudinary.uploader.destroy(img.public_id);
          }
        }
      }

      // Mark the database record as deleted and empty the array to save DB storage space
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          return_images_deleted: true,
          return_images: []
        })
        .eq("id", order.id);

      if (updateErr) {
        throw updateErr;
      }
      successCount++;
    } catch (err: any) {
      failCount++;
      console.error(`[Return Image Cleanup Worker] Failed to purge images for order ${order.id}:`, err);
      Sentry.captureException(err, {
        tags: { queue: "return-image-cleanup" },
        extra: { orderId: order.id },
      });
    }
  }

  console.log(`[Return Image Cleanup Worker] Sweep completed. Purged: ${successCount}, Failed: ${failCount}`);

  if (failCount > 0) {
    throw new Error(`Return image cleanup job completed with ${failCount} failures.`);
  }
}
