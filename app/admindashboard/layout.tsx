import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase-server";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login?redirect=/admindashboard");
  }

  if (user.role !== "admin") {
    redirect("/myprofile?error=admin_required");
  }

  return (
    <AdminSidebar user={user}>
      {children}
    </AdminSidebar>
  );
}
