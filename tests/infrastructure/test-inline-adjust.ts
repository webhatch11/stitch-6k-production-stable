// @ts-nocheck
import { db } from "../../lib/db";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdjust() {
  console.log("🚀 Fetching a test product variant...");
  const { data: variants, error } = await supabase
    .from("product_variants")
    .select("product_id, size, stock")
    .limit(1);

  if (error || !variants || variants.length === 0) {
    console.error("❌ Failed to fetch product variant:", error?.message || "No variants found");
    return;
  }

  const testVariant = variants[0];
  console.log(`Found variant: Product ID=${testVariant.product_id}, Size=${testVariant.size}, Current Stock=${testVariant.stock}`);

  console.log("Calling adjustVariantStockBySize with delta +1...");
  const res = await db.adjustVariantStockBySize(testVariant.product_id, testVariant.size, 1);
  console.log("Result:", res);
}

testAdjust().catch(console.error);
