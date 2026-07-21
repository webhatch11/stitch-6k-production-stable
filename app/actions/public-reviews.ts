"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

const submitReviewSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

const ipSubmissionTracker = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes window
  const maxSubmissions = 3;

  const timestamps = (ipSubmissionTracker.get(ip) || []).filter(
    (t) => now - t < windowMs
  );

  if (timestamps.length >= maxSubmissions) {
    return false;
  }

  timestamps.push(now);
  ipSubmissionTracker.set(ip, timestamps);
  return true;
}

function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>?/gm, "").trim();
}

export async function submitReviewAction(input: any) {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    if (!checkRateLimit(ip)) {
      return {
        success: false,
        error: "Too many review submissions. Please try again in 10 minutes.",
      };
    }

    const parsed = submitReviewSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }

    const cleanName = sanitizeString(parsed.data.name);
    const cleanLocation = sanitizeString(parsed.data.location);
    const cleanComment = sanitizeString(parsed.data.comment);

    if (!cleanName || !cleanLocation || !cleanComment) {
      return { success: false, error: "Invalid review content." };
    }

    const ok = await db.submitReview({
      name: cleanName,
      location: cleanLocation,
      rating: parsed.data.rating,
      comment: cleanComment,
    });

    if (!ok) {
      return { success: false, error: "Failed to submit review" };
    }

    revalidatePath("/", "layout");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("[public-reviews.ts]:", err);
    return { success: false, error: err.message };
  }
}
