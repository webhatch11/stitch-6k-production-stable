import React from "react";
import { db } from "@/lib/db";
import ReturnsDashboardClient from "@/components/admin/ReturnsDashboardClient";

export const revalidate = 0; // Disable static cache, force dynamic server rendering

export default async function ReturnsDashboardPage() {
  const allOrders = await db.getOrders();
  return <ReturnsDashboardClient initialOrders={allOrders} />;
}
