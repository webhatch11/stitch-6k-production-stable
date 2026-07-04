// ISR: product listing regenerates at most every 60s (plus on-demand
// revalidation from admin product saves).
export const revalidate = 60;

import React from "react";
import { db } from "@/lib/db";
import ShopAllShirtsClient from "./ShopAllShirtsClient";

export default async function ShopAllShirtsPage() {
  const products = await db.getProducts();

  return <ShopAllShirtsClient initialProducts={products} />;
}
