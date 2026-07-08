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

  return (
    <>
      <Script
        src="https://upload-widget.cloudinary.com/global/all.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('[Cloudinary] Widget ready');
        }}
      />
      <AdminSidebar user={user} pendingReturnsCount={pendingCount}>
        {children}
      </AdminSidebar>
    </>
  );
}
