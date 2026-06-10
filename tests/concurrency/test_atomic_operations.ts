// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runConcurrencyTest() {
  console.log("--- Starting ACID Concurrency Test Suite ---");

  // Create a mock user if needed, or use a specific known user ID.
  // For tests, we will just simulate calling the RPCs directly.
  
  const testUserId = "00000000-0000-0000-0000-000000000000"; // replace with actual
  const numWorkers = 5;
  const debitAmount = 100;
  
  console.log(`Simulating ${numWorkers} simultaneous wallet debits of ₹${debitAmount}...`);

  const promises = [];
  for (let i = 0; i < numWorkers; i++) {
    promises.push(
      supabase.rpc("wallet_atomic_debit", {
        p_user_id: testUserId,
        p_amount: debitAmount,
        p_idempotency_key: `test-order-${Date.now()}-${i}`,
        p_desc: `Concurrency test debit ${i}`
      })
    );
  }

  const results = await Promise.all(promises);
  let successCount = 0;
  let failCount = 0;

  results.forEach((res, i) => {
    if (res.error || (res.data && !res.data.success)) {
      failCount++;
      console.log(`[Worker ${i}] Failed:`, res.error?.message || res.data?.error);
    } else {
      successCount++;
      console.log(`[Worker ${i}] Success`);
    }
  });

  console.log(`\nWallet Concurrency Test Completed:`);
  console.log(`Successful debits: ${successCount}`);
  console.log(`Failed/Rejected debits (e.g. due to insufficient funds): ${failCount}`);
  
  console.log("\n--- Starting Inventory Overselling Test ---");
  const testProductId = "product-123"; // replace with real
  const testSize = "M";
  const testColor = "Atelier Choice";

  const invPromises = [];
  for (let i = 0; i < numWorkers; i++) {
    invPromises.push(
      supabase.rpc("reserve_variant_inventory_atomic", {
        p_product_id: testProductId,
        p_size: testSize,
        p_color: testColor,
        p_quantity: 1,
        p_expires_mins: 10,
        p_session: `session-${Date.now()}-${i}`
      })
    );
  }

  const invResults = await Promise.all(invPromises);
  let invSuccessCount = 0;
  let invFailCount = 0;

  invResults.forEach((res, i) => {
    if (res.error || (res.data && !res.data.success)) {
      invFailCount++;
      console.log(`[Inventory Worker ${i}] Failed:`, res.error?.message || res.data?.error);
    } else {
      invSuccessCount++;
      console.log(`[Inventory Worker ${i}] Success. Remaining:`, res.data?.remaining_available);
    }
  });

  console.log(`\nInventory Concurrency Test Completed:`);
  console.log(`Successful reservations: ${invSuccessCount}`);
  console.log(`Failed reservations (e.g. Out of Stock): ${invFailCount}`);
}

runConcurrencyTest().catch(console.error);
