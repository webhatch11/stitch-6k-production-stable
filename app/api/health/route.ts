import { NextResponse } from "next/server";
import {
  checkDatabase,
  checkRedis,
  checkEmail,
  checkShiprocket,
  checkStorage,
} from "@/lib/health";
import { verifyAdminAccess } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = Date.now();
  
  const [database, redis, email, shiprocket, storage] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkEmail(),
    checkShiprocket(),
    checkStorage(),
  ]);
  
  const overallHealthy =
    database.status === "healthy" &&
    redis.status === "healthy" &&
    email.status === "healthy" &&
    shiprocket.status === "healthy" &&
    storage.status === "healthy";
    
  const latencyMs = Date.now() - start;
  const access = await verifyAdminAccess(request);
  
  if (!access.authorized) {
    const { getServerUser } = await import("@/lib/supabase-server");
    const user = await getServerUser().catch(() => null);
    if (user && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return NextResponse.json(
    {
      status: overallHealthy ? "healthy" : "unhealthy",
      latencyMs,
      timestamp: new Date().toISOString(),
      subsystems: {
        database,
        redis,
        email,
        shiprocket,
        storage,
      },
    },
    { status: overallHealthy ? 200 : 503 }
  );
}
