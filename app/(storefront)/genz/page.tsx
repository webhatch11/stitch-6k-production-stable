// ISR: product listing regenerates at most every 60s (plus on-demand
// revalidation from admin product saves).
export const revalidate = 60;

import React from "react";
import { db } from "@/lib/db";
import GenZStreetwearClient from "./GenZStreetwearClient";

export default async function GenZStreetwearPage() {
  const genzProducts = await db.getProducts({ display_section: "genz" });

  return <GenZStreetwearClient initialProducts={genzProducts} />;
}
