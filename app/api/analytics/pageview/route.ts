import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { path, sessionId } = await req.json();
    if (!path || !sessionId) {
      return NextResponse.json({ success: false, error: "Missing path or sessionId" }, { status: 400 });
    }

    await db.recordPageView(path, sessionId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // Log the real error server-side but never leak internals to this public,
    // unauthenticated endpoint.
    console.error("API Pageview Error:", err);
    return NextResponse.json({ success: false, error: "Failed to record page view" }, { status: 500 });
  }
}
