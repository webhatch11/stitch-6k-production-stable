import React from "react";
import { getServerUser, getServerSupabase } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const MyProfileClient = dynamic(() => import("./MyProfileClient"), { ssr: true });

export default async function MyProfilePage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  let name = "";
  let email = "";
  let phone = "";

  const supabase = await getServerSupabase();
  if (supabase) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const metadata = authUser.user_metadata || {};
      name = metadata.name || metadata.full_name || "Customer User";
      email = authUser.email || "";
      phone = metadata.phone || authUser.phone || "Not Provided";
    }
  }

  // Safe session fallback if authUser query fails
  if (!email && user?.email) {
    email = user.email;
    name = name || user.email.split("@")[0] || "Customer User";
  }
  if (!phone) {
    phone = "Not Provided";
  }

  const balance = await db.getWalletBalance(user.id);
  const wTxs = await db.getWalletTransactions(user.id);
  const points = await db.getLoyaltyPoints(user.id);
  const lTxs = await db.getLoyaltyTransactions(user.id);
  const orders = await db.getUserOrders(user.id);
  const activeProducts = await db.getProducts();

  return (
    <MyProfileClient
      userName={name}
      userEmail={email}
      userPhone={phone}
      userRole={user.role}
      initialWalletBalance={balance}
      initialWalletTxs={wTxs}
      initialLoyaltyPoints={points}
      initialLoyaltyTxs={lTxs}
      initialRecentOrders={orders.slice(0, 3)}
      initialAllOrders={orders}
      activeProducts={activeProducts}
    />
  );
}
