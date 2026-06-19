import React from "react";
import { db } from "@/lib/db";
import ShopAllShirtsClient from "./ShopAllShirtsClient";

export default async function ShopAllShirtsPage() {
  const products = await db.getProducts();

  return <ShopAllShirtsClient initialProducts={products} />;
}
