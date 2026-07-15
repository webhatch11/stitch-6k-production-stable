import { loadService } from "./client-raw";
import { LOW_STOCK_THRESHOLD as LS_THRESHOLD } from "../inventory-config";

export { loadService } from "./client-raw";

export const LOW_STOCK_THRESHOLD = LS_THRESHOLD;

// Proxy wrapper for Supabase client to keep it fully dynamic
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const { supabase: svc } = loadService();
    if (!svc) {
      throw new Error(
        "Database connection not configured. " +
        "Check NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
      );
    }
    const value = (svc as any)[prop];
    return typeof value === "function" ? value.bind(svc) : value;
  }
});

// Proxy wrapper for Razorpay client to keep it fully dynamic and server-only
export const razorpay = new Proxy({} as any, {
  get(target, prop) {
    if (typeof window !== "undefined") {
      throw new Error("Razorpay client cannot be used on the client-side.");
    }
    const { razorpay: client } = require("../razorpay");
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  }
});
