import React from "react";
import { db } from "@/lib/db";
import GenZStreetwearClient from "./GenZStreetwearClient";

export default async function GenZStreetwearPage() {
  const allProducts = await db.getProducts();
  const genzProducts = allProducts.filter((p) => p.isGenz);

  return <GenZStreetwearClient initialProducts={genzProducts} />;
}
