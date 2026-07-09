import React from "react";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const OrderHistoryClient = dynamic(() => import("./OrderHistoryClient"), { ssr: true });

export default async function OrderHistoryPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await db.getUserOrders(user.id);

  return <OrderHistoryClient initialOrders={orders} userId={user.id} />;
}
