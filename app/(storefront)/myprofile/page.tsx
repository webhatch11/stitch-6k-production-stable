import React from "react";
import { getServerUser, getServerSupabase } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import MyProfileClient from "./MyProfileClient";

export default async function MyProfilePage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  let name = "Aditya R.";
  let email = "aditya.singhania@heritage.com";
  let phone = "+91 98765 43210";

  const supabase = await getServerSupabase();
  if (supabase) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const metadata = authUser.user_metadata || {};
      name = metadata.name || "Customer User";
      email = authUser.email || "";
      phone = metadata.phone || authUser.phone || "Not Provided";
    }
  }

  const balance = await db.getWalletBalance(user.id);
  const wTxs = await db.getWalletTransactions(user.id);
  const points = await db.getLoyaltyPoints(user.id);
  const lTxs = await db.getLoyaltyTransactions(user.id);
  const orders = await db.getUserOrders(user.id);

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
    />
  );
}
