import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase-service";

export async function GET(req: NextRequest) {
  // Admin-only — check session
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = req.nextUrl.searchParams.get("since");
  if (!since) {
    return NextResponse.json({ error: "Missing ?since= param" }, { status: 400 });
  }

  try {
    if (!supabaseService) {
      // Service role key not configured — return empty gracefully
      return NextResponse.json({ orders: [] });
    }

    const { data, error } = await supabaseService
      .from("orders")
      .select("id, customer, total, cart_items, address_snapshot, created_at")
      .gt("created_at", since)
      .in("status", ["Paid", "Processing", "Shipped", "Delivered"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[live-orders] Supabase error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const orders = (data || []).map((o: any) => {
      const items: any[] = Array.isArray(o.cart_items) ? o.cart_items : [];
      const firstItem = items[0];
      const itemName = firstItem?.name || firstItem?.productName || "Item";
      const snap = o.address_snapshot || {};
      const city =
        snap.city ||
        snap.City ||
        snap.district ||
        "";
      const customerName = o.customer || "Customer";
      // Format total
      const total = typeof o.total === "number" ? o.total : parseFloat(o.total || "0");

      return {
        id: o.id,
        customer: customerName,
        city,
        itemName,
        itemCount: items.length,
        total,
        createdAt: o.created_at,
      };
    });

    return NextResponse.json({ orders });
  } catch (err) {
    console.error("[live-orders] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
