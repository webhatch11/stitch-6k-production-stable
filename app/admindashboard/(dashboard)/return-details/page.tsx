import React from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import ReturnDetailsClient from "./ReturnDetailsClient";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

const RETURN_STATUSES = [
  "return requested",
  "return accepted",
  "return in transit",
  "returned",
  "return rejected",
  "return pickup scheduled",
  "return qc pending",
  "return qc failed",
  "refund initiated",
  "reship requested",
  "return approved"
];

export default async function ReturnDetailsPage({ searchParams }: PageProps) {
  const { orderId } = await searchParams;

  if (!orderId) {
    redirect("/admindashboard/returns");
  }

  const returnData = await db.getReturnByOrderId(orderId);

  if (!returnData || !returnData.order) {
    redirect("/admindashboard/returns");
  }

  const statusLower = (returnData.order.status || "").toLowerCase();
  const isReturn = statusLower.includes("return") || statusLower.includes("refund") || RETURN_STATUSES.some(s => statusLower.includes(s));

  if (!isReturn) {
    redirect("/admindashboard/returns");
  }

  return (
    <ReturnDetailsClient
      initialOrder={returnData.order}
      initialEvents={returnData.events}
      initialNotes={returnData.notes}
    />
  );
}
