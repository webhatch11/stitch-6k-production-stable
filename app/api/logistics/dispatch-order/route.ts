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
    // Fallback mock check
    const mockRole = req.cookies.get("mock_user_role")?.value;
    const mockSession = req.cookies.get("mock_user_session")?.value;
    return !!mockSession && mockRole === "admin";
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

    // 3. Retrieve order
    const orders = await db.getOrders();
    const order = orders.find((o) => o.id === orderId);

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
    // Items in the order are saved as string titles like "Luxury Black Shirt" or JSON
    const quantity = order.items.length || 1;
    const orderItems = order.items.map((itemStr: any, idx: number) => {
      // items can be simple strings or objects. We handle both.
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
      pickup_location: "JRT TEXTILES (6K Brand), Tiruchirappalli",
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
    const ordersCopy = await db.getOrders();
    const idx = ordersCopy.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
      ordersCopy[idx].status = "Shipped";
      ordersCopy[idx].shiprocketId = result.awbCode || "";
      await db.saveOrder(ordersCopy[idx]);

      // Add status history entry
      try {
        await db.addOrderStatusHistory(
          order.id,
          "Shipped",
          "Admin Portal Dispatch",
          {
            shiprocket_order_id: result.shiprocketOrderId,
            shipment_id: result.shipmentId,
            awb: result.awbCode,
            courier: result.courierName,
            is_mock: result.isMock
          }
        );
      } catch (historyErr) {
        console.warn("[Dispatch API] Failed to add order status history:", historyErr);
      }
    }

    return NextResponse.json({
      success: true,
      awbCode: result.awbCode,
      courierName: result.courierName,
      shipmentId: result.shipmentId,
      shiprocketOrderId: result.shiprocketOrderId,
      isMock: result.isMock,
      message: `Order #${orderId} successfully dispatched via Shiprocket.`
    });

  } catch (error: any) {
    console.error("[Dispatch API] Unhandled exception:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
