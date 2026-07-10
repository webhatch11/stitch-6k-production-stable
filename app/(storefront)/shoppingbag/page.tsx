import React from "react";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const ShoppingBagClient = dynamic(() => import("./ShoppingBagClient"), { ssr: true });

// M5 fix: wrap db.getProducts() in try/catch so a DB failure returns empty bag
// instead of crashing the entire page render.
export default async function ShoppingBag() {
  let products: Awaited<ReturnType<typeof db.getProducts>> = [];
  try {
    products = await db.getProducts();
  } catch (err) {
    console.error("[ShoppingBag] Failed to load products:", err);
  }

  return <ShoppingBagClient initialProducts={products} />;
}
