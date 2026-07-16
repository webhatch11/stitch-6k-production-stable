import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, cartCount, cartValue } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Missing sessionId" });
    }

    await supabase.from("page_views").upsert(
      {
        session_id: sessionId,
        cart_items_count: cartCount,
        cart_value: cartValue,
        last_seen: new Date().toISOString(),
      },
      {
        onConflict: "session_id",
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/analytics/cart-activity] error:", err);
    return NextResponse.json({ ok: false });
  }
}
