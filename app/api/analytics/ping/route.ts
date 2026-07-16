import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses service role so the upsert bypasses RLS restrictions on UPDATE
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, page } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Missing sessionId" });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const now = new Date().toISOString();

    await supabase.from("page_views").upsert(
      {
        session_id: sessionId,
        page: page || "/",
        user_agent: userAgent,
        ip_address: ip,
        last_seen: now,
        // created_at only set on first insert — upsert won't overwrite it
        // because we don't include it here and DB default handles it
      },
      {
        onConflict: "session_id",
        ignoreDuplicates: false,
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/analytics/ping] error:", err);
    return NextResponse.json({ ok: false });
  }
}
