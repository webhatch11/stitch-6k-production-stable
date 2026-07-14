// ISR: product pages regenerate at most every 60s (plus on-demand
// revalidation from admin product saves).
export const revalidate = 60;

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const ProductDetailClient = dynamic(() => import("./ProductDetailClient"), { ssr: true });

interface PageProps {
  params: Promise<any>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  if (!slug) {
    return {
      title: "6K Brand",
      metadataBase: new URL("https://the6k.com"),
    };
  }
  const product = await db.getProductBySlug(slug);
  if (!product) {
    return {
      title: "6K Brand",
      metadataBase: new URL("https://the6k.com"),
    };
  }
  
  const title = product.seoTitle || `${product.title} — 6K Brand`;
  const description = product.seoDescription || product.description?.slice(0, 160) || `Buy ${product.title} from 6K Brand.`;
  
  const primaryImage = product.images?.[0] || product.image || "/og-default.jpg";
  
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com"
    ),
    title,
    description,
    keywords: product.seoKeywords || undefined,
    openGraph: {
      title,
      description,
      url: `https://the6k.com/product/${slug}`,
      siteName: "6K Brand",
      images: [{
        url: primaryImage,
        width: 1200,
        height: 1200,
        alt: product.title
      }],
      type: "website",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [primaryImage],
    }
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await db.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Dynamic JSON-LD schema for search engines
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "image": [product.image, ...(product.images || [])].filter(Boolean),
    "description": product.seoDescription || product.description || `Buy ${product.title} at Stitch 6K.`,
    "sku": product.id,
    "offers": {
      "@type": "Offer",
      "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com"}/product/${product.slug}`,
      "priceCurrency": "INR",
      "price": product.price,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.stock && product.stock > 0 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Stitch 6K"
      }
    }
  };

  return (
    <>
      {/* Insert JSON-LD Schema on server-side for SEO crawlers */}
      <script
        type="application/ld+json"
        // Escape < so a product field containing "</script>" cannot break out
        // of the JSON-LD block (stored XSS via admin-editable content).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetailClient product={product} />
    </>
  );
}
