import { Worker } from "bullmq";
import IORedis from "ioredis";
import { closeAllRedisConnections } from "../connection";

export function registerGracefulShutdown(workers: Worker | Worker[], connection?: IORedis): void {
  const workerList = Array.isArray(workers) ? workers : [workers];

  const handler = async (signal: string) => {
    console.log(`\n⚠️ [Shutdown] Received ${signal}. Starting graceful shutdown...`);
    
    // 1. Tell all workers to stop pulling new jobs
    console.log("[Shutdown] Closing BullMQ workers (no longer accepting new jobs)...");
    try {
      await Promise.all(workerList.map((w) => w.close()));
      console.log("[Shutdown] All active jobs completed successfully, workers closed.");
    } catch (err: any) {
      console.error("[Shutdown] Error closing workers:", err.message || err);
    }

    // 2. Safely close all registered Redis connections managed globally
    try {
      await closeAllRedisConnections();
      console.log("[Shutdown] All Redis connections closed successfully.");
    } catch (err: any) {
      console.error("[Shutdown] Error closing Redis connections:", err.message || err);
    }

    console.log("[Shutdown] Graceful shutdown finished. Exiting process.");
    process.exit(0);
  };

  process.on("SIGTERM", () => handler("SIGTERM"));
  process.on("SIGINT", () => handler("SIGINT"));
}
