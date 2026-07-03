import React from "react";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import Link from "next/link";
import OrderConfirmedClient from "./OrderConfirmedClient";

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function OrderConfirmedPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const orderId = resolvedParams.orderId || null;

  let lastOrder = null;
  let unauthorizedOrNotFound = false;

  if (orderId) {
    const order = await db.getOrder(orderId);
    if (order) {
      const user = await getServerUser();
      const orderUserId = order.userId || order.user_id;
      if (orderUserId && (!user || orderUserId !== user.id)) {
        unauthorizedOrNotFound = true;
      } else {
        lastOrder = order;
      }
    } else {
      unauthorizedOrNotFound = true;
    }
  } else {
    unauthorizedOrNotFound = true;
  }

  if (unauthorizedOrNotFound || !lastOrder) {
    return (
      <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <h1 className="text-2xl font-black uppercase mb-4 text-[#BA7517]">Order Not Found</h1>
        <p className="text-xs text-outline uppercase tracking-wider mb-6">
          Please check your order history or contact support.
        </p>
        <Link
          href="/orderhistory"
          className="inline-flex items-center justify-center bg-on-surface text-surface hover:bg-[#BA7517] hover:text-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-on-surface/10"
        >
          Go to Order History
        </Link>
      </div>
    );
  }

  return <OrderConfirmedClient lastOrder={lastOrder} />;
}

