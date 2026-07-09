"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const submitReviewSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

export async function submitReviewAction(input: any) {
  try {
    const parsed = submitReviewSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }

    const ok = await db.submitReview({
      name: parsed.data.name,
      location: parsed.data.location,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });

    if (!ok) {
      return { success: false, error: "Failed to submit review" };
    }

    // Optional cache revalidation for storefront page
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    console.error('[public-reviews.ts]:', err);
    return { success: false, error: err.message };
  }
}
