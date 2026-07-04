import { NextResponse } from "next/server";
import { supabaseService as supabase } from "@/lib/supabase-service";
import pkg from "@/package.json";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitoring (UptimeRobot etc.).
 * GET /api/health → { status, timestamp, supabase, version }
 */
export async function GET() {
  let supabaseStatus: "connected" | "error" = "error";

  try {
    if (supabase) {
      // Cheap connectivity probe: HEAD count on a small table.
      const { error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      supabaseStatus = error ? "error" : "connected";
    }
  } catch {
    supabaseStatus = "error";
  }

  const healthy = supabaseStatus === "connected";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      supabase: supabaseStatus,
      version: (pkg as { version?: string }).version || "unknown",
    },
    { status: healthy ? 200 : 503 }
  );
}
