// NOTE: This route MUST be deleted or its DEV_ONLY_GATE proven disabled
// before Day 24 production deploy. Audit before launch.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

// DEV-ONLY: HTTP bridge for invoking server actions from Node test scripts.
// Disabled in production. Must NEVER reach a deployed build.

const DEV_ONLY_GATE = 
  process.env.NODE_ENV !== "production" && 
  process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== "false";

export async function POST(req: NextRequest) {
  if (!DEV_ONLY_GATE) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { actionName, args } = await req.json();
    
    if (!actionName || typeof actionName !== "string") {
      return NextResponse.json(
        { error: "Missing actionName" }, 
        { status: 400 }
      );
    }

    if (actionName === "db:deductStock") {
      const { db } = await import("@/lib/db");
      const [items, sessionId] = args;
      const result = await db.deductStock(items, sessionId);
      return NextResponse.json({ success: result });
    }

    if (actionName === "inventory:validateStock") {
      const { InventoryService } = await import("@/lib/services/inventory");
      const [items] = args;
      const result = await InventoryService.validateStock(items);
      return NextResponse.json(result);
    }

    // Import the action module dynamically based on prefix
    let mod: any;
    if (actionName.startsWith("read:")) {
      mod = await import("@/app/actions/admin-reads");
    } else if (actionName.startsWith("product:")) {
      mod = await import("@/app/actions/admin-products");
    } else if (actionName.startsWith("order:")) {
      mod = await import("@/app/actions/admin-orders");
    } else if (actionName.startsWith("coupon:")) {
      mod = await import("@/app/actions/admin-coupons");
    } else if (actionName.startsWith("customer:")) {
      mod = await import("@/app/actions/admin-customers");
    } else if (actionName.startsWith("settings:")) {
      mod = await import("@/app/actions/admin-settings");
    } else if (actionName.startsWith("public_review:")) {
      mod = await import("@/app/actions/public-reviews");
    } else if (actionName.startsWith("checkout:")) {
      mod = await import("@/app/actions/checkout");
    } else {
      return NextResponse.json(
        { error: "Unknown action namespace" }, 
        { status: 400 }
      );
    }

    const actionFnName = actionName.split(":")[1];
    const fn = mod[actionFnName];
    if (typeof fn !== "function") {
      const keys = Object.keys(mod);
      console.log(`[Test Runner] actionFnName ${actionFnName} not found in mod keys:`, keys);
      return NextResponse.json(
        { error: `Action ${actionFnName} not found. Available keys: ${keys.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await fn(...(Array.isArray(args) ? args : []));
    return NextResponse.json(result);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: message || "Internal error" },
      { status: 500 }
    );
  }
}
