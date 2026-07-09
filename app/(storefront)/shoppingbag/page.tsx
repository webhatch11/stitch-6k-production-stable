import React from "react";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const ShoppingBagClient = dynamic(() => import("./ShoppingBagClient"), { ssr: true });

export default async function ShoppingBag() {
  const products = await db.getProducts();

  return <ShoppingBagClient initialProducts={products} />;
}
