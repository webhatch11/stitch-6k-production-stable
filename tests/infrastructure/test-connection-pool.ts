import "../../lib/jobs/env";
import {
  getSharedProducerConnection,
  createWorkerConnection,
  getConnectionMetrics,
  closeAllRedisConnections,
} from "../../lib/jobs/connection";

async function main() {
  console.log("🚀 Starting Redis connection consolidation tests...");

  // 1. Verify Shared Caching / Producer Client Reference Sharing
  console.log("\n==================================================");
  console.log("TEST 1: Shared Producer client reference sharing");
  console.log("==================================================");
  
  const client1 = getSharedProducerConnection();
  const client2 = getSharedProducerConnection();
  
  const isShared = client1 === client2;
  console.log(isShared ? "✅ PASSED: getSharedProducerConnection returns identical instance." : "❌ FAILED: Different client instances created.");

  // 2. Verify Worker Connection Isolation (Workers must NOT share connections)
  console.log("\n==================================================");
  console.log("TEST 2: Dedicated Worker connection isolation");
  console.log("==================================================");
  
  const paymentWorkerConn = createWorkerConnection("payment");
  const emailWorkerConn = createWorkerConnection("email");
  
  const notSharedWithProducer = paymentWorkerConn !== client1;
  const workersAreIsolated = paymentWorkerConn !== emailWorkerConn;
  
  console.log(notSharedWithProducer ? "✅ PASSED: Worker connection is isolated from producer." : "❌ FAILED: Worker sharing connection with producer.");
  console.log(workersAreIsolated ? "✅ PASSED: Worker connections are isolated from each other." : "❌ FAILED: Workers sharing same connection.");

  // 3. Verify Connection Metrics
  console.log("\n==================================================");
  console.log("TEST 3: Active connection count and status metrics");
  console.log("==================================================");
  
  const metrics = getConnectionMetrics();
  console.log("Retrieved Metrics:");
  console.log(JSON.stringify(metrics, null, 2));

  // Should have 3 active connections: shared_producer, payment worker, and email worker
  const countPassed = metrics.activeCount === 3;
  console.log(countPassed ? "✅ PASSED: Active connection counts are correct (3)." : `❌ FAILED: Count is ${metrics.activeCount}, expected 3.`);

  // 4. Verify Graceful Pool Teardown
  console.log("\n==================================================");
  console.log("TEST 4: Graceful shutdown pool cleanup");
  console.log("==================================================");
  
  console.log("Closing all connections...");
  await closeAllRedisConnections();
  
  const postShutdownMetrics = getConnectionMetrics();
  const shutdownPassed = postShutdownMetrics.activeCount === 0;
  console.log(shutdownPassed ? "✅ PASSED: All connections closed. Pool is empty." : `❌ FAILED: Active connections remaining: ${postShutdownMetrics.activeCount}`);

  console.log("\n==================================================");
  const suitePassed = isShared && notSharedWithProducer && workersAreIsolated && countPassed && shutdownPassed;
  console.log(suitePassed ? "🏆 ALL REDIS ARCHITECTURE TESTS PASSED SUCCESSFULLY!" : "❌ SOME TEST CASES FAILED.");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
});
