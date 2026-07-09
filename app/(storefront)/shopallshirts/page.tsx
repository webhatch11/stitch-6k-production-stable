// ISR: product listing regenerates at most every 60s (plus on-demand
// revalidation from admin product saves).
export const revalidate = 60;

import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com"
  ),
  title: "Shop All Shirts — 6K Brand",
  description: "Browse premium cotton and linen shirts from 6K Brand. Heritage craftsmanship meets Gen-Z streetwear.",
  openGraph: {
    title: "Shop All Shirts — 6K Brand",
    description: "Browse premium shirts from 6K Brand.",
    images: [{
      url: "/og-default.jpg",
      width: 1200,
      height: 630,
    }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-default.jpg"],
  }
};

import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const ShopAllShirtsClient = dynamic(() => import("./ShopAllShirtsClient"), { ssr: true });

export default async function ShopAllShirtsPage() {
  const products = await db.getProducts();

  return <ShopAllShirtsClient initialProducts={products} />;
}
