import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// M14 fix: check if the product still exists before doing a permanent redirect.
// If the product is deleted or renamed, sends to shop instead of a 404.
export default async function SignatureShirtBlackRedirect() {
  const SLUG = "luxury-black-shirt";

  try {
    const products = await db.getProducts();
    const exists = products.some((p: { slug?: string }) => p.slug === SLUG);
    if (exists) {
      redirect(`/product/${SLUG}`);
    }
  } catch {
    // DB unavailable — fall through to shop
  }

  redirect("/shopallshirts");
}
