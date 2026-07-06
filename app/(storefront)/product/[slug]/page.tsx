// ISR: product pages regenerate at most every 60s (plus on-demand
// revalidation from admin product saves).
export const revalidate = 60;

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProductDetailClient from "./ProductDetailClient";

interface PageProps {
  params: Promise<any>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  if (!slug) {
    return {
      title: "Product | Stitch 6K",
    };
  }
  const product = await db.getProductBySlug(slug);
  if (!product) {
    return {
      title: "Product Not Found | Stitch 6K",
      description: "Artisan luxury shirt not found.",
    };
  }
  const title = product.seoTitle || `${product.title} | Stitch 6K`;
  const description = product.seoDescription || product.description || `Buy ${product.title} at Stitch 6K. Artisan crafted premium luxury menswear.`;
  return {
    title,
    description,
    keywords: product.seoKeywords || undefined,
    openGraph: {
      title,
      description,
      images: [
        {
          url: product.image,
          alt: product.title,
        },
      ],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await db.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const recommendations = await db.relatedProducts(slug);

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
      "url": `https://6kthebrand.com/product/${product.slug}`,
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
      <ProductDetailClient product={product} recommendations={recommendations} />
    </>
  );
}
