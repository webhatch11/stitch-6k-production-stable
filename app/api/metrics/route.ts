import { NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/metrics";
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

  try {
    const metrics = await getAggregatedMetrics();
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
