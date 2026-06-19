import React from "react";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import OrderHistoryClient from "./OrderHistoryClient";

export default async function OrderHistoryPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await db.getUserOrders(user.id);

  return <OrderHistoryClient initialOrders={orders} userId={user.id} />;
}
