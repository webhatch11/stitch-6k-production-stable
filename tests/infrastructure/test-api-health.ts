import "../../lib/jobs/env";
import { GET } from "../../app/api/health/route";
import IORedis from "ioredis";
import { startHeartbeat } from "../../lib/jobs/runners/heartbeat";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.ADMIN_SECRET = "verification-test-secret-12345678";

function createMockRequest(): Request {
  return new Request("http://localhost:3000/api/health", {
    headers: {
      Authorization: `Bearer ${process.env.ADMIN_SECRET}`,
    },
  });
}

async function runHealthyTest() {
  console.log("\n==================================================");
  console.log("SCENARIO 1: Unified Health Endpoint (Healthy Status)");
  console.log("==================================================");

  const connection = new IORedis(REDIS_URL);
  
  // Publish mock heartbeats for all 5 workers so they appear online
  const timers = await Promise.all([
    startHeartbeat(connection, "payment"),
    startHeartbeat(connection, "email"),
    startHeartbeat(connection, "shipment"),
    startHeartbeat(connection, "cleanup"),
    startHeartbeat(connection, "loyalty"),
  ]);

  console.log("Triggering /api/health endpoint GET handler...");
  const request = createMockRequest();
  const response = await GET(request);
  const data = await response.json();

  console.log("HTTP Status:", response.status);
  console.log("Response JSON:");
  console.log(JSON.stringify(data, null, 2));

  // Clean up
  timers.forEach(clearInterval);
  await connection.del("worker:payment", "worker:email", "worker:shipment", "worker:cleanup", "worker:loyalty");
  await connection.quit();
}

async function runDegradedWorkerTest() {
  console.log("\n==================================================");
  console.log("SCENARIO 2: Failure Detection (Email Worker Offline)");
  console.log("==================================================");

  const connection = new IORedis(REDIS_URL);
  
  // Publish heartbeats for only 4 workers (leave email worker offline)
  const timers = await Promise.all([
    startHeartbeat(connection, "payment"),
    startHeartbeat(connection, "shipment"),
    startHeartbeat(connection, "cleanup"),
    startHeartbeat(connection, "loyalty"),
  ]);

  console.log("Triggering /api/health endpoint (email worker has no heartbeat)...");
  const request = createMockRequest();
  const response = await GET(request);
  const data = await response.json();

  console.log("HTTP Status:", response.status);
  console.log("Consolidated Status:", data.status);
  console.log("Email Worker Status:", data.infrastructure.workers.email);
  console.log("Warnings:", data.application.warnings);

  // Clean up
  timers.forEach(clearInterval);
  await connection.del("worker:payment", "worker:shipment", "worker:cleanup", "worker:loyalty");
  await connection.quit();
}

async function main() {
  console.log("🚀 Starting endpoint health & failure detection tests...");
  await runHealthyTest();
  await runDegradedWorkerTest();
  console.log("\n==================================================");
  console.log("Endpoint tests completed.");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
});
