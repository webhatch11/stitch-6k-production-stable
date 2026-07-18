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
    return NextResponse.json(
      {
        status: overallHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
      },
      { status: overallHealthy ? 200 : 503 }
    );
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
