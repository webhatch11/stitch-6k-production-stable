import { NextResponse } from "next/server";
import { checkRedis } from "@/lib/health";
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

  const result = await checkRedis();
  return NextResponse.json(result, { status: result.status === "healthy" ? 200 : 503 });
}
