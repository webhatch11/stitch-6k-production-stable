import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase-server";
import AdminSidebar from "../AdminSidebar";
import { db } from "@/lib/db";

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

  return (
    <AdminSidebar user={user} pendingReturnsCount={pendingCount}>
      {children}
    </AdminSidebar>
  );
}
