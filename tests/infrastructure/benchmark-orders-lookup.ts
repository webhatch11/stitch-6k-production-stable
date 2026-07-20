// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBenchmark() {
  console.log("⏱️ Starting Phase 1 Performance Benchmark...");

  // Fetch sample order ID
  const { data: sampleOrders } = await supabase.from("orders").select("id").limit(1);
  if (!sampleOrders || sampleOrders.length === 0) {
    console.warn("⚠️ No orders in DB to benchmark.");
    return;
  }

  const sampleOrderId = sampleOrders[0].id;
  console.log(`Target Sample Order ID: ${sampleOrderId}\n`);

  // Benchmark 1: Full-table scan (db.getOrders() approach)
  const memBeforeScan = process.memoryUsage().heapUsed;
  const startScan = performance.now();
  const { data: allOrders } = await supabase.from("orders").select("*");
  const foundScan = allOrders?.find((o: any) => o.id === sampleOrderId);
  const endScan = performance.now();
  const memAfterScan = process.memoryUsage().heapUsed;
  const scanDuration = (endScan - startScan).toFixed(2);
  const scanMemMB = ((memAfterScan - memBeforeScan) / 1024 / 1024).toFixed(2);

  console.log(`📊 Baseline (Full Table Scan - getOrders()):`);
  console.log(`   - Execution Time: ${scanDuration} ms`);
  console.log(`   - Memory Delta:   ${scanMemMB} MB`);
  console.log(`   - Rows Fetched:   ${allOrders?.length || 0}`);

  // Benchmark 2: Indexed lookup (db.getOrderById() approach)
  const memBeforeIndexed = process.memoryUsage().heapUsed;
  const startIndexed = performance.now();
  const { data: indexedOrder } = await supabase.from("orders").select("*").eq("id", sampleOrderId).maybeSingle();
  const endIndexed = performance.now();
  const memAfterIndexed = process.memoryUsage().heapUsed;
  const indexedDuration = (endIndexed - startIndexed).toFixed(2);
  const indexedMemMB = ((memAfterIndexed - memBeforeIndexed) / 1024 / 1024).toFixed(2);

  console.log(`\n🚀 Optimized (Indexed Lookup - getOrderById()):`);
  console.log(`   - Execution Time: ${indexedDuration} ms`);
  console.log(`   - Memory Delta:   ${indexedMemMB} MB`);
  console.log(`   - Rows Fetched:   1`);

  const speedup = (Number(scanDuration) / Math.max(Number(indexedDuration), 1)).toFixed(1);
  console.log(`\n==================================================`);
  console.log(`🏆 BENCHMARK RESULT: Indexed lookup is ${speedup}x faster!`);
  console.log(`==================================================`);
}

runBenchmark().catch(console.error);
