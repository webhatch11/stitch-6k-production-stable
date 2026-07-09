import { NextResponse } from "next/server";
import pkg from "@/package.json";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitoring (UptimeRobot etc.).
 * GET /api/health → { status, timestamp, supabase, version }
 */
export async function GET() {
  const checks = {
    supabase: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    razorpay: !!(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
    ),
    cloudinary: !!(
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    ),
    redis: !!(process.env.REDIS_URL),
    resend: !!(process.env.RESEND_API_KEY)
  };

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.npm_package_version || pkg.version || "unknown"
    },
    {
      status: allHealthy ? 200 : 503
    }
  );
}
