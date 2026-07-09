"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ShippingRules } from "@/lib/shipping";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const heroSlideSchema = z.object({
  image_url: z.string().min(1).max(300),
  headline: z.string().min(1).max(120),
  subheadline: z.string().max(300).optional().default(""),
  cta_text: z.string().min(1).max(40),
  cta_url: z.string().min(1).max(200),
});

const heroSchema = z.object({
  image_url: z.string().optional().default(""),
  headline: z.string().min(1).max(120).optional(),
  subheadline: z.string().max(300).optional(),
  cta_text: z.string().min(1).max(40),
  cta_url: z.string().min(1).max(200),
  slides: z.array(heroSlideSchema).max(6).optional().default([]),
  carousel_slides: z.array(z.string()).max(6).optional().default([]),
});


const businessSchema = z.object({
  phone: z.string().max(20).optional().default(""),
  email: z.string().max(100).optional().default(""),
  address: z.string().max(500).optional().default(""),
  gst_no: z.string().max(50).optional().default(""),
  instagram: z.string().max(200).optional().default(""),
  facebook: z.string().max(200).optional().default(""),
});

const flagsSchema = z.object({
  cod_enabled: z.boolean(),
  returns_window_days: z.number().int().min(0).max(60),
});

const marqueeSchema = z.object({
  items: z.array(z.string().max(120)).min(1).max(10),
  enabled: z.boolean(),
});

const offerBoxSchema = z.object({
  enabled: z.boolean(),
  label: z.string().max(200).optional().default(""),
  heading: z.string().max(200).optional().default(""),
  body: z.string().max(200).optional().default(""),
  coupon_code: z.string().max(200).optional().default(""),
  cta_text: z.string().max(200).optional().default(""),
  cta_url: z.string().max(200).optional().default(""),
  bg_image_url: z.string().max(200).optional().default(""),
});

export async function getSettingAction(key: "hero" | "business" | "flags" | "marquee" | "offer_box" | "trust_badges" | "hero_slides" | "categories" | "reviews" | "shipping_rules") {
  // No requireAdmin — these are public reads via cached layer
  try {
    const value = await db.getSetting(key);
    return { success: true, value };
  } catch (e: any) {
    console.error('[admin-settings.ts]:', e);
    return { success: false, error: e.message };
  }
}

export async function saveHeroAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = heroSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("hero", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/shopallshirts");
  revalidatePath("/genz");
  return { success: true };
}

export async function saveBusinessAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("business", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function saveFlagsAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = flagsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("flags", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  revalidatePath("/checkout");
  return { success: true };
}

export async function saveMarqueeAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = marqueeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("marquee", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function saveOfferBoxAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = offerBoxSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("offer_box", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  return { success: true };
}

const trustBadgeItemSchema = z.object({
  icon: z.string().max(40),
  title: z.string().max(30),
  description: z.string().max(80),
});

const trustBadgesSchema = z.object({
  enabled: z.boolean(),
  items: z.array(trustBadgeItemSchema).max(6),
});

export async function saveTrustBadgesAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = trustBadgesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("trust_badges", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  return { success: true };
}

const categoryItemSchema = z.object({
  title: z.string().min(1).max(50),
  subtitle: z.string().min(1).max(150),
  image_url: z.string().min(1).max(300),
  theme: z.enum(["navy", "crimson", "linen", "charcoal", "cream"]),
  cta_url: z.string().max(200).optional().default(""),
});

const categoriesSchema = z.object({
  enabled: z.boolean(),
  items: z.array(categoryItemSchema).max(8),
});

export async function saveCategoriesAction(input: any) {
  try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
  const parsed = categoriesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const ok = await db.saveSetting("categories", parsed.data);
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getReviewsAction(approved?: boolean) {
  try {
    // Only admins may read unapproved/all reviews; the public storefront
    // is limited to approved ones.
    if (approved !== true) {
      try { await requireAdmin(); } catch { return { success: false, error: "Unauthorized" }; }
    }
    const items = await db.getReviews(typeof approved === "boolean" ? { approved } : undefined);
    return { success: true, value: items };
  } catch (e: any) {
    console.error('[admin-settings.ts]:', e);
    return { success: false, error: e.message };
  }
}

export async function approveReviewAction(id: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  const ok = await db.updateReviewStatus(id, true);
  if (!ok) return { success: false, error: "Failed to approve review" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function rejectReviewAction(id: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  const ok = await db.deleteReview(id);
  if (!ok) return { success: false, error: "Failed to delete review" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateReviewAction(id: string, comment: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  if (!comment || comment.trim().length === 0) {
    return { success: false, error: "Comment cannot be empty" };
  }
  const ok = await db.updateReview(id, { comment });
  if (!ok) return { success: false, error: "Failed to update review" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function saveShippingAction(
  rules: ShippingRules
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }
  const ok = await db.saveSetting('shipping_rules', {
    mode: rules.mode,
    flat_rate: Number(rules.flatRate),
    free_above_amount: Number(rules.freeAboveAmount),
    display_message: rules.displayMessage
  });
  if (!ok) return { success: false, error: "Save failed" };
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/checkout");
  return { success: true };
}



