import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CacheService } from "@/lib/cache";

// M3 fix: rate limit to 30 page-view events per IP per minute
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "anon";
    const allowed = await CacheService.checkRateLimit(`pageview:${ip}`, 30, 60);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const { path, sessionId } = await req.json();
    if (!path || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing path or sessionId" },
        { status: 400 }
      );
    }

    await db.recordPageView(path, sessionId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // Log server-side only — never leak internals to this public endpoint.
    console.error("API Pageview Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to record page view" },
      { status: 500 }
    );
  }
}
