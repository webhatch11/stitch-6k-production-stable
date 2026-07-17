import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses service role so mutable session state remains server-write-only.
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

    await supabase.from("visitor_sessions").upsert(
      {
        session_id: sessionId,
        current_page: page || "/",
        user_agent: userAgent,
        ip_address: ip,
        last_seen: now,
        updated_at: now,
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
