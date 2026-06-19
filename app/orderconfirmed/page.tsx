import React from "react";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import OrderConfirmedClient from "./OrderConfirmedClient";

export default async function OrderConfirmedPage() {
  const user = await getServerUser();
  let lastOrder = null;

  if (user) {
    const orders = await db.getUserOrders(user.id);
    if (orders.length > 0) {
      lastOrder = orders[0];
    }
  } else {
    // Check general orders in mock mode
    const orders = await db.getOrders();
    if (orders.length > 0) {
      lastOrder = orders[0];
    }
  }

  return <OrderConfirmedClient lastOrder={lastOrder} />;
}
