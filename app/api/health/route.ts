import { NextResponse } from "next/server";
import {
  checkDatabase,
  checkRedis,
  checkEmail,
  checkShiprocket,
  checkStorage,
} from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
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
