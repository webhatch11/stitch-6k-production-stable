export const dynamic = "force-dynamic";

import React from "react";
import { db } from "@/lib/db";
import GenZStreetwearClient from "./GenZStreetwearClient";

export default async function GenZStreetwearPage() {
  const genzProducts = await db.getProducts({ display_section: "genz" });

  return <GenZStreetwearClient initialProducts={genzProducts} />;
}
