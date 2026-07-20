import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_PATTERNS = [
  "bot", "crawler", "spider", "slurp", "googlebot", "bingbot", "yandex", 
  "baidu", "duckduckbot", "ahrefs", "semrush", "facebookexternalhit", 
  "twitterbot", "pinterest", "headlesschrome", "python-requests", "curl", "wget"
];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some((pattern) => lower.includes(pattern));
}

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

    // 1. Filter out bot/crawler traffic
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true, ignored: "bot" });
    }

    // 2. Filter out admin dashboard sessions
    const currentPage = (page || "/").toLowerCase();
    if (currentPage.startsWith("/admindashboard") || currentPage.startsWith("/admin")) {
      return NextResponse.json({ ok: true, ignored: "admin" });
    }

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
