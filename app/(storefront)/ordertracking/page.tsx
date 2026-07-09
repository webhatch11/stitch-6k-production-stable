import React, { Suspense } from "react";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const OrderTrackingClient = dynamic(() => import("./OrderTrackingClient"), { ssr: true });

export default async function OrderTrackingPage() {
  const user = await getServerUser();
  const products = await db.getProducts();

  let recentOrders: any[] = [];
  if (user) {
    const orders = await db.getUserOrders(user.id);
    recentOrders = orders.slice(0, 3);
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    }>
      <OrderTrackingClient recentOrders={recentOrders} products={products} />
    </Suspense>
  );
}
