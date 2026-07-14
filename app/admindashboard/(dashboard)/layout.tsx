import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase-server";
import AdminSidebar from "../AdminSidebar";
import { db } from "@/lib/db";
import Script from "next/script";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect("/admindashboard/login?redirect=/admindashboard");
  }

  if (user.role !== "admin") {
    redirect("/admindashboard/login?error=admin_required");
  }

  const allOrders = await db.getOrders();
  const pendingCount = allOrders.filter(o => o.status === "Return Requested").length;
  const pendingOrdersCount = allOrders.filter(
    o => o.status === "Payment Pending" || o.status === "Paid"
  ).length;

  // Check for recent audit activity (last 24h) for the Activity Log badge
  const recentAudit = await db.getAllProductAuditLogs(5);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hasRecentAudit = recentAudit.some((r: any) => r.created_at && r.created_at > oneDayAgo);

  return (
    <>
      <Script
        src="https://upload-widget.cloudinary.com/global/all.js"
        strategy="lazyOnload"
      />
      <AdminSidebar user={user} pendingReturnsCount={pendingCount} pendingOrdersCount={pendingOrdersCount} hasRecentAudit={hasRecentAudit}>
        {children}
      </AdminSidebar>
    </>
  );
}

