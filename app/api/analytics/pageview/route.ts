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
  } catch (err: any) {
    console.error("API Pageview Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
