"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const heroSchema = z.object({
  image_url: z.string().optional().default(""),
  headline: z.string().min(1).max(120),
  subheadline: z.string().max(300).optional().default(""),
  cta_text: z.string().min(1).max(40),
  cta_url: z.string().min(1).max(200),
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

export async function getSettingAction(key: "hero" | "business" | "flags") {
  // No requireAdmin — these are public reads via cached layer
  try {
    const value = await db.getSetting(key);
    return { success: true, value };
  } catch (e: any) {
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
