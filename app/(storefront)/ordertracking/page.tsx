import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const OrderTrackingClient = dynamic(() => import("./OrderTrackingClient"), { ssr: true });

// M13 fix: redirect unauthenticated users to login instead of showing an empty form
export default async function OrderTrackingPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login?redirect=/ordertracking");
  }

  const [products, orders] = await Promise.all([
    db.getProducts().catch(() => []),
    db.getUserOrders(user.id).catch(() => []),
  ]);

  const recentOrders = orders.slice(0, 3);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
        </div>
      }
    >
      <OrderTrackingClient recentOrders={recentOrders} products={products} />
    </Suspense>
  );
}
