import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiprocket } from "@/lib/shiprocket";
import { createServerClient } from "@supabase/ssr";

// Utility to verify if the requesting user is an admin
async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

  if (isSupabaseConfigured) {
    let response = NextResponse.next();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return profile?.role === "admin";
  } else {
    throw new Error("Supabase is not configured.");
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate as admin
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin privileges required." }, { status: 401 });
    }

    // 2. Parse request payload
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing parameter: orderId" }, { status: 400 });
    }

    // 3. Retrieve order (indexed lookup)
    const order = await db.getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ success: false, error: `Order #${orderId} not found.` }, { status: 404 });
    }

    if (order.status === "Shipped" && order.shiprocketId) {
      return NextResponse.json({ success: false, error: `Order #${orderId} has already been dispatched with AWB ${order.shiprocketId}.` }, { status: 400 });
    }

    // 4. Read delivery address from checkout-time snapshot — no fallback or name-matching
    const snap = order.address_snapshot;
    if (!snap) {
      return NextResponse.json(
        { success: false, error: `Order #${orderId} has no address_snapshot — cannot dispatch without a verified delivery address` },
        { status: 422 }
      );
    }
    const shippingAddress = {
      name: snap.name || order.customer,
      phone: snap.phone || "",
      address_line_1: snap.address_line_1 || "",
      address_line_2: snap.address_line_2 || "",
      city: snap.city || "",
      state: snap.state || "",
      postal_code: snap.postal_code || "",
      country: snap.country || "India",
      email: snap.email || "",
    };

    // 5. Build Shiprocket order items payload
    const useCartItems = Array.isArray(order.cartItems) && order.cartItems.length > 0;
    const quantity = useCartItems
      ? order.cartItems!.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
      : (order.items.length || 1);

    const orderItems = useCartItems
      ? order.cartItems!.map((item: any, idx: number) => {
          const name = item.productName || item.title || "Luxury Atelier Shirt";
          const sku = item.productId ? `SKU-${item.productId}-${item.size || "M"}-${item.color || "Default"}` : `SKU-${name.toUpperCase().substring(0, 5).replace(/\s+/g, "")}-${idx}`;
          return {
            name,
            sku,
            units: item.quantity || 1,
            selling_price: Number(item.price || Math.round(order.total / quantity)),
          };
        })
      : order.items.map((itemStr: any, idx: number) => {
          const name = typeof itemStr === "string" ? itemStr : (itemStr.productName || itemStr.title || "Luxury Atelier Shirt");
          const sku = `SKU-${name.toUpperCase().substring(0, 5).replace(/\s+/g, "")}-${idx}`;
          return {
            name,
            sku,
            units: 1,
            selling_price: Math.round(order.total / quantity),
          };
        });

    // 6. Calculate shipment dimensions
    // 0.4 kg per shirt, box length 30cm, width 22cm, height 5cm per shirt
    const weight = 0.4 * quantity;
    const length = 30;
    const width = 22;
    const height = Math.max(5, 5 * quantity);

    const shiprocketPayload = {
      order_id: order.id,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "JRT TEXTILES (6K Brand), Tiruchirappalli",
      billing_customer_name: shippingAddress.name.split(" ")[0] || "Customer",
      billing_last_name: shippingAddress.name.split(" ").slice(1).join(" ") || "Atelier",
      billing_address: shippingAddress.address_line_1,
      billing_address_2: shippingAddress.address_line_2,
      billing_city: shippingAddress.city,
      billing_pincode: shippingAddress.postal_code,
      billing_state: shippingAddress.state,
      billing_country: shippingAddress.country,
      billing_email: shippingAddress.email,
      billing_phone: shippingAddress.phone,
      shipping_is_billing: true,
      order_items: orderItems,
      payment_method: "Prepaid" as const,
      sub_total: order.total,
      length,
      width,
      height,
      weight,
    };

    // 7. Dispatch via Shiprocket SDK
    const result = await shiprocket.createAndDispatchOrder(shiprocketPayload);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Failed to create Shiprocket dispatch" }, { status: 500 });
    }

    // 8. Update order in database/local storage
    await db.saveOrder({
      id: order.id,
      shiprocketId: result.awbCode || "",
      awbCode: result.awbCode || "",
      courierName: result.courierName || "Shiprocket Express",
      trackingUrl: result.awbCode ? `https://shiprocket.co/tracking/${result.awbCode}` : null
    });
    await db.transitionOrderStatus(order.id, "Shipped", {
      triggerSource: "Admin Portal Dispatch",
      userOrAdmin: "admin",
      reason: `Dispatched via Shiprocket. AWB: ${result.awbCode}`,
      metadata: {
        shiprocket_order_id: result.shiprocketOrderId,
        shipment_id: result.shipmentId,
        awb: result.awbCode,
        courier: result.courierName,
        is_mock: result.isMock
      }
    });

    return NextResponse.json({
      success: true,
      awbCode: result.awbCode,
      courierName: result.courierName,
      shipmentId: result.shipmentId,
      shiprocketOrderId: result.shiprocketOrderId,
      isMock: result.isMock,
      message: `Order #${orderId} successfully dispatched via Shiprocket.`
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Dispatch API] Unhandled exception:", error);
    return NextResponse.json({ success: false, error: message || "Internal server error" }, { status: 500 });
  }
}
