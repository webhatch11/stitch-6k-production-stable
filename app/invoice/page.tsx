import React, { Suspense } from "react";
import { getServerUser } from "@/lib/supabase-server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const InvoiceClient = dynamic(() => import("./InvoiceClient"), { ssr: true });

interface InvoicePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function InvoiceContent({ searchParams }: InvoicePageProps) {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const orderIdParam = resolvedSearchParams.orderId as string | undefined;

  const userOrders = await db.getUserOrders(user.id);
  let matchedOrder = orderIdParam ? await db.getOrderById(orderIdParam) : null;
  if (!matchedOrder && userOrders.length > 0) {
    matchedOrder = userOrders[0];
  }

  if (!matchedOrder) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center bg-[#f9f9f9]">
        <h3 className="font-headline text-lg font-black uppercase text-on-surface mb-2">No Order Selected</h3>
        <p className="text-xs text-outline mb-6">Please choose an order from your Order History.</p>
        <a href="/orderhistory" className="bg-primary text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-secondary">
          Go To History
        </a>
      </div>
    );
  }

  // Security check: only own order or admin
  if (user.role !== "admin" && (!matchedOrder.userId || matchedOrder.userId !== user.id)) {
    redirect("/orderhistory");
  }

  // Enforce production-safe invoice lifecycle access controls on the server
  const statusLower = (matchedOrder.status || "").toLowerCase();
  const paymentStatusLower = (matchedOrder.paymentStatus || "").toLowerCase();

  const isPending = statusLower === "payment pending";
  const isReview = statusLower === "payment review required";
  const isFailed = statusLower === "failed";
  const isExpired = paymentStatusLower === "expired";
  const isCancelledBeforePayment = statusLower === "cancelled" && paymentStatusLower !== "paid";

  if (isPending || isReview || isFailed || isExpired || isCancelledBeforePayment) {
    if (user.role === "admin") {
      redirect("/admindashboard/invoices?error=invoice_not_ready");
    } else {
      redirect("/orderhistory?error=invoice_not_ready");
    }
  }

  const allProducts = await db.getProducts();

  const pointsDiscount = matchedOrder.pointsDiscount || 0;
  const walletPaid = matchedOrder.walletPaid || 0;
  const couponDiscount = matchedOrder.couponDiscount || 0;
  const originalTotal = matchedOrder.originalTotal !== undefined ? matchedOrder.originalTotal : (matchedOrder.total + pointsDiscount + couponDiscount);
  const finalGatewayAmount = matchedOrder.gatewayPaid !== undefined ? matchedOrder.gatewayPaid : Math.max(0, matchedOrder.total - walletPaid);

  const businessSettings = await db.getSetting("business");
  const gstin = businessSettings?.gst_no || "33BFOPT4938Q1ZE";

  return (
    <InvoiceClient
      initialOrder={matchedOrder}
      products={allProducts}
      originalTotal={originalTotal}
      finalGatewayAmount={finalGatewayAmount}
      pointsDiscount={pointsDiscount}
      walletPaid={walletPaid}
      couponDiscount={couponDiscount}
      gstin={gstin}
      isAdmin={user.role === "admin"}
    />
  );
}

export default function InvoicePage({ searchParams }: InvoicePageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    }>
      <InvoiceContent searchParams={searchParams} />
    </Suspense>
  );
}
