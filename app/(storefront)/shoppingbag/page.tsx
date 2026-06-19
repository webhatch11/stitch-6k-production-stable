import React from "react";
import { db } from "@/lib/db";
import ShoppingBagClient from "./ShoppingBagClient";

export default async function ShoppingBag() {
  const products = await db.getProducts();

  return <ShoppingBagClient initialProducts={products} />;
}
