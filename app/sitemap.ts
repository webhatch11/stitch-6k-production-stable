import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com";

// Regenerate the sitemap hourly.
export const revalidate = 3600;

const STATIC_PATHS = [
  "",
  "/shopallshirts",
  "/genz",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/shipping-policy",
  "/payment-policy",
  "/refund-policy",
  "/cancellation-policy",
  "/return-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await db.getProducts();
    productEntries = (products || [])
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${SITE_URL}/product/${p.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch (e) {
    console.error("[sitemap] Failed to load products:", e);
  }

  return [...staticEntries, ...productEntries];
}
