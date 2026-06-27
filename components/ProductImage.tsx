"use client";

import Image, { ImageProps } from "next/image";
import { CldImage } from "next-cloudinary";

/**
 * Smart product image renderer.
 *
 * - Detects Cloudinary URLs (res.cloudinary.com) and serves them via
 *   CldImage with f_auto,q_auto + responsive resizing.
 * - Falls back to Next.js <Image> for any other URL (Unsplash, etc.).
 *
 * Use this anywhere a product image (`product.image` or similar) is
 * rendered. Keeps the same prop interface as next/image so existing
 * code is a drop-in replacement.
 */

type Props = Omit<ImageProps, "src"> & {
  src: string;
  // Optional: explicit hint to skip cloudinary detection even if URL matches
  forceNextImage?: boolean;
};

function isCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("res.cloudinary.com");
}

export default function ProductImage({
  src,
  forceNextImage = false,
  ...rest
}: Props) {
  const useCloudinary = !forceNextImage && isCloudinaryUrl(src);

  if (useCloudinary) {
    // CldImage applies f_auto + q_auto by default and resizes via width prop
    // when not using fill. For fill mode it uses the container size.
    return (
      <CldImage
        src={src}
        format="auto"
        quality="auto"
        {...rest}
      />
    );
  }

  // Fallback: next/image for non-Cloudinary URLs
  return <Image src={src} {...rest} />;
}
