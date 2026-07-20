import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await verifyAdminAccess(request);
  if (!access.authorized) {
    const { getServerUser } = await import("@/lib/supabase-server");
    const user = await getServerUser().catch(() => null);
    if (user && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "disabled",
    service: "email",
    message: "Email subsystem is intentionally decoupled and disabled."
  }, { status: 200 });
}
