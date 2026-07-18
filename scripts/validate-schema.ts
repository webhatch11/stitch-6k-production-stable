/**
 * scripts/validate-schema.ts
 *
 * Standalone CI/CD script that validates the Supabase PostgREST schema cache
 * is fully synchronized with the actual database before deploying application
 * code that writes to recently migrated columns.
 *
 * Exit codes:
 *   0  All critical columns present in the schema cache -- safe to deploy.
 *   1  Schema cache out of sync, or cannot connect -- DO NOT deploy.
 *
 * Usage:
 *   npx tsx scripts/validate-schema.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[validate-schema] FATAL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// MAINTENANCE NOTE: When a migration adds a column that app code will
// immediately write to, append the column name here BEFORE merging the app PR.
// -----------------------------------------------------------------------------

const ORDERS_CRITICAL_COLUMNS = [
  "id",
  "status",
  "payment_status",
  "razorpay_order_id",
  "razorpay_payment_id",
  "wallet_paid",
  "gateway_paid",
  "points_redeemed",
  "points_discount",
  "idempotency_key",
  "cart_items",
  "user_id",
  "payment_processing_state", // Added: 20260718002000_phase2_reliability.sql
];

const PAYMENTS_CRITICAL_COLUMNS = [
  "id",
  "order_id",
  "razorpay_order_id",
  "razorpay_payment_id",
  "amount",
  "currency",
  "status",
  "method",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

async function validateTable(
  supabase: SupabaseClient,
  table: string,
  columns: string[]
): Promise<boolean> {
  const { error } = await supabase.from(table).select(columns.join(",")).limit(1);

  if (error) {
    const isSchemaGap =
      error.code === "PGRST204" ||
      (error.message && error.message.includes("column"));
    if (isSchemaGap) {
      console.error(`[validate-schema] SCHEMA GAP on '${table}': ${error.message}`);
      console.error(`[validate-schema]   Fix: run NOTIFY pgrst, 'reload schema'; in Supabase SQL editor`);
    } else {
      console.error(`[validate-schema] DB ERROR on '${table}': ${error.message}`);
    }
    return false;
  }

  console.log(
    `[validate-schema] OK '${table}' -- ${columns.length} critical columns confirmed in schema cache.`
  );
  return true;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[validate-schema] Verifying Supabase PostgREST schema cache...\n");

  const results = await Promise.all([
    validateTable(supabase, "orders", ORDERS_CRITICAL_COLUMNS),
    validateTable(supabase, "payments", PAYMENTS_CRITICAL_COLUMNS),
  ]);

  const allPassed = results.every(Boolean);

  console.log("");
  if (allPassed) {
    console.log("[validate-schema] ALL CHECKS PASSED -- safe to deploy application code.");
    process.exit(0);
  } else {
    console.error("[validate-schema] VALIDATION FAILED -- DO NOT deploy. Fix schema cache and re-run.");
    process.exit(1);
  }
}

main().catch((err: any) => {
  console.error("[validate-schema] Unexpected error:", err?.message ?? err);
  process.exit(1);
});
