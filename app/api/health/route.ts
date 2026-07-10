import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// M4 fix: only expose ok/degraded — no per-service env-var enumeration
export async function GET() {
  try {
    const allCriticalHealthy =
      !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) &&
      !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) &&
      !!(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

    return NextResponse.json(
      {
        status: allCriticalHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      },
      { status: allCriticalHealthy ? 200 : 503 }
    );
  } catch (error) {
    console.error("[GET /api/health]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
