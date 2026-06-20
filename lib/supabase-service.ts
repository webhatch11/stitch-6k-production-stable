import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isServiceClientConfigured = !!(supabaseUrl && serviceRoleKey);

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase-service.ts must NEVER be imported in browser code. " +
    "It exposes the service role key which bypasses RLS."
  );
}

if (!isServiceClientConfigured) {
  console.warn(
    "⚠️ SUPABASE_SERVICE_ROLE_KEY missing. Service-role operations will be disabled."
  );
}

export const supabaseService = isServiceClientConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })
  : null;
