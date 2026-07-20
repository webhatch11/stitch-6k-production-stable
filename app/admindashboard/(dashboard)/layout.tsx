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
  const pendingCount = allOrders.filter(o => (o.status || "").toLowerCase() === "return requested").length;

  // Reconcile sidebar badge count: Count only live orders (Paid/Paid via Wallet and created in last 24 hours).
  const now = new Date();
  const deadline = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const pendingOrdersCount = allOrders.filter(o => {
    const s = (o.status || "").toLowerCase();
    if (!["paid", "paid via wallet"].includes(s)) return false;

    // Parse order date using robust parsing logic identical to orders page
    const orderDateStr = o.created_at || o.createdAt || o.date;
    if (!orderDateStr) return true;

    let orderTime = Date.parse(orderDateStr);
    if (isNaN(orderTime)) {
      const parts = orderDateStr.split("/");
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) >= deadline;
      }
      return true;
    }
    return new Date(orderTime) >= deadline;
  }).length;

  // Check for recent audit activity (last 24h) for the Activity Log badge
  const [recentProductAudits, recentPaymentAudits, recentShippingAudits] = await Promise.all([
    db.getAllProductAuditLogs(5),
    db.getPaymentAuditLogs(5),
    db.getTrackingLogs(5),
  ]);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hasRecentAudit = [
    ...recentProductAudits,
    ...recentPaymentAudits,
    ...recentShippingAudits
  ].some((r: any) => r.created_at && r.created_at > oneDayAgo);

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

