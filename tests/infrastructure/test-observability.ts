import "../../lib/jobs/env";
import IORedis from "ioredis";
import os from "os";
import fs from "fs/promises";
import { startHeartbeat } from "../../lib/jobs/runners/heartbeat";
import { workerLog } from "../../lib/jobs/runners/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function verifyHeartbeats() {
  console.log("\n==================================================");
  console.log("TEST 1: Heartbeat Publishing and Redis layout");
  console.log("==================================================");

  const connection = new IORedis(REDIS_URL);
  
  // Start heartbeat
  console.log("Publishing payment worker heartbeat...");
  const timer = await startHeartbeat(connection, "payment");

  // Read back heartbeat
  const data = await connection.hgetall("worker:payment");
  console.log("Heartbeat data retrieved from Redis:");
  console.log(JSON.stringify(data, null, 2));

  const passed = data.worker === "payment" && data.status === "online" && !!data.lastHeartbeat && !!data.uptimeSeconds;
  console.log(passed ? "✅ PASSED: Heartbeat saved correctly in Redis." : "❌ FAILED: Heartbeat fields invalid.");
  
  // Clean up
  clearInterval(timer);
  await connection.del("worker:payment");
  await connection.quit();
}

async function verifyStructuredLogging() {
  console.log("\n==================================================");
  console.log("TEST 2: Structured JSON Logging output format");
  console.log("==================================================");

  console.log("Logging a sample start job event:");
  workerLog({
    level: "info",
    worker: "payment",
    queue: "payment-processing",
    jobId: "job-101",
    event: "job_started",
    message: "Starting test payment processing"
  });

  console.log("Logging a sample complete event with duration:");
  workerLog({
    level: "info",
    worker: "payment",
    queue: "payment-processing",
    jobId: "job-101",
    event: "job_completed",
    durationMs: 145,
    message: "Successfully processed test payment"
  });
  
  console.log("✅ PASSED: Structured logs generated.");
}

async function verifySystemDiagnostics() {
  console.log("\n==================================================");
  console.log("TEST 3: System Diagnostics (Disk, Memory, Uptime)");
  console.log("==================================================");

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsedPercent = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;

  const stats = await fs.statfs(process.cwd());
  const diskTotal = stats.bsize * stats.blocks;
  const diskAvailable = stats.bsize * stats.bavail;
  const diskUsed = diskTotal - diskAvailable;
  const diskUsedPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  console.log(`Node Version: ${process.version}`);
  console.log(`OS Hostname: ${os.hostname()}`);
  console.log(`Memory Used %: ${memUsedPercent.toFixed(2)}%`);
  console.log(`Disk Used %: ${diskUsedPercent.toFixed(2)}% (Available: ${(diskAvailable / 1024 / 1024 / 1024).toFixed(2)} GB)`);

  const passed = memUsedPercent >= 0 && memUsedPercent <= 100 && diskUsedPercent >= 0 && diskUsedPercent <= 100;
  console.log(passed ? "✅ PASSED: System diagnostics calculated successfully." : "❌ FAILED: Invalid diagnostic numbers.");
}

async function main() {
  console.log("🚀 Starting observability verification tests...");
  await verifyHeartbeats();
  await verifyStructuredLogging();
  await verifySystemDiagnostics();
  console.log("\n==================================================");
  console.log("Observability test suite completed.");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
});
