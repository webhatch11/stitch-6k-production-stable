import { NextResponse } from "next/server";
import {
  checkDatabase,
  checkRedis,
  checkEmail,
  checkShiprocket,
  checkStorage,
  HealthResponse,
} from "@/lib/health";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import os from "os";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

// Global cache of Queue instances and Redis connection to reuse clients between serverless invocations
const queueRegistry = new Map<string, Queue>();
let sharedRedisConnection: IORedis | null = null;

function getSharedRedis(url: string): IORedis {
  if (!sharedRedisConnection) {
    sharedRedisConnection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return sharedRedisConnection;
}

function getCachedQueue(name: string, connection: IORedis): Queue {
  if (!queueRegistry.has(name)) {
    queueRegistry.set(name, new Queue(name, { connection: connection as any }));
  }
  return queueRegistry.get(name)!;
}

// Bounded timeout wrapper to prevent slow external APIs from hanging the health response
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, timeoutMs);
  });
  
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}

// Native system disk usage query using statfs
async function getDiskUsage() {
  try {
    const stats = await fs.statfs(process.cwd());
    const total = stats.bsize * stats.blocks;
    const available = stats.bsize * stats.bavail;
    const used = total - available;
    const percentUsed = total > 0 ? (used / total) * 100 : 0;
    return {
      totalGb: Number((total / 1024 / 1024 / 1024).toFixed(2)),
      availableGb: Number((available / 1024 / 1024 / 1024).toFixed(2)),
      percentUsed: Number(percentUsed.toFixed(2)),
      status: percentUsed > 90 ? "degraded" : "healthy",
    };
  } catch (err: any) {
    return {
      totalGb: 0,
      availableGb: 0,
      percentUsed: 0,
      status: "error",
      error: err.message || "Failed to query disk stats",
    };
  }
}

export async function GET(request: Request) {
  const start = Date.now();
  const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

  // 1. Authenticate Request
  const access = await verifyAdminAccess(request);
  if (!access.authorized) {
    const { getServerUser } = await import("@/lib/supabase-server");
    const user = await getServerUser().catch(() => null);
    if (user && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Perform Subsystem Infrastructure Health Checks
  // DB and Redis checks run with short native connection limits
  const databaseCheckPromise = checkDatabase();
  const redisCheckPromise = checkRedis();

  // External APIs are wrapped in a 2000ms timeout boundary to protect health API performance
  const fallbackUnhealthy = (service: string, error: string): HealthResponse => ({
    service,
    version: "1.2.0-phase3",
    environment: process.env.NODE_ENV || "development",
    status: "unhealthy",
    latencyMs: 2000,
    uptimeSeconds: 0,
    timestamp: new Date().toISOString(),
    lastSuccessfulConnection: null,
    error,
  });

  const emailCheckPromise = withTimeout(checkEmail(), 2000, fallbackUnhealthy("email", "Check timed out after 2000ms"));
  const shiprocketCheckPromise = withTimeout(checkShiprocket(), 2000, fallbackUnhealthy("shiprocket", "Check timed out after 2000ms"));
  const storageCheckPromise = withTimeout(checkStorage(), 2000, fallbackUnhealthy("storage", "Check timed out after 2000ms"));

  const [database, redis, email, shiprocket, storage] = await Promise.all([
    databaseCheckPromise,
    redisCheckPromise,
    emailCheckPromise,
    shiprocketCheckPromise,
    storageCheckPromise,
  ]);

  // 3. Inspect Redis for Worker Heartbeats & Queue Metrics
  const workerStatuses: Record<string, any> = {};
  const queueStats: Record<string, any> = {};
  let workerDegradedReason = "";
  let queueBacklogReason = "";

  const workers = ["payment", "email", "shipment", "cleanup", "loyalty"];
  const queues = [
    "payment-processing",
    "email-delivery",
    "shipment-sync",
    "shipment-retry",
    "reservation-cleanup",
    "payment-recovery",
    "loyalty-expiry",
    "product-cleanup",
    "points-credit",
  ];

  let hasWorkerError = false;
  let hasQueueBacklog = false;

  if (redis.status === "healthy") {
    try {
      const redisClient = getSharedRedis(REDIS_URL);

      // Fetch Worker Heartbeats
      for (const name of workers) {
        const key = `worker:${name}`;
        const heartbeatData = await redisClient.hgetall(key);
        
        if (!heartbeatData || !heartbeatData.lastHeartbeat) {
          workerStatuses[name] = { status: "offline", lastSeen: null };
          hasWorkerError = true;
          workerDegradedReason += `${name} worker is offline. `;
        } else {
          const diffMs = Date.now() - new Date(heartbeatData.lastHeartbeat).getTime();
          let status = "online";
          if (diffMs > 90000) {
            status = "offline";
            hasWorkerError = true;
            workerDegradedReason += `${name} worker is offline (last seen ${Math.round(diffMs / 1000)}s ago). `;
          } else if (diffMs > 45000) {
            status = "degraded";
            hasWorkerError = true;
            workerDegradedReason += `${name} worker heartbeat is delayed. `;
          }

          workerStatuses[name] = {
            status,
            pid: Number(heartbeatData.pid || 0),
            hostname: heartbeatData.hostname || "N/A",
            lastSeen: heartbeatData.lastHeartbeat,
            uptimeSeconds: Number(heartbeatData.uptimeSeconds || 0),
            version: heartbeatData.version || "N/A",
          };
        }
      }

      // Fetch Queue Job Tallies
      for (const name of queues) {
        const q = getCachedQueue(name, redisClient);
        const counts = await q.getJobCounts();
        
        queueStats[name] = {
          waiting: counts.waiting,
          active: counts.active,
          delayed: counts.delayed,
          completed: counts.completed,
          failed: counts.failed,
          paused: counts.paused,
        };

        // Degrade health if any queue backlog exceeds 100 waiting items
        if (counts.waiting > 100) {
          hasQueueBacklog = true;
          queueBacklogReason += `${name} has backlog of ${counts.waiting} jobs. `;
        }
      }

    } catch (err: any) {
      console.error("[Health Check API] Failed to check heartbeats / queues:", err.message);
    }
  } else {
    // If Redis is down, all workers and queues are unreachable
    for (const name of workers) {
      workerStatuses[name] = { status: "unknown", error: "Redis connection offline" };
    }
    for (const name of queues) {
      queueStats[name] = { status: "unknown", error: "Redis connection offline" };
    }
  }

  // 4. Collect System Diagnostics
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsedPercent = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;
  const disk = await getDiskUsage();

  // 5. Calculate Consolidated Status Level (unhealthy -> degraded -> healthy)
  let statusLevel: "healthy" | "degraded" | "unhealthy" = "healthy";
  const warnings: string[] = [];

  // Critical checks: DB or Redis down means UNHEALTHY
  if (database.status !== "healthy" || redis.status !== "healthy") {
    statusLevel = "unhealthy";
  }

  if (statusLevel !== "unhealthy") {
    // Non-critical API timeouts/failures or worker offline/queue backlog trigger DEGRADED
    if (
      email.status !== "healthy" ||
      shiprocket.status !== "healthy" ||
      storage.status !== "healthy" ||
      disk.status !== "healthy" ||
      hasWorkerError ||
      hasQueueBacklog
    ) {
      statusLevel = "degraded";

      if (email.status !== "healthy") warnings.push("Email service check degraded: " + (email.error || "unknown"));
      if (shiprocket.status !== "healthy") warnings.push("Shiprocket API check degraded: " + (shiprocket.error || "unknown"));
      if (storage.status !== "healthy") warnings.push("Cloudinary storage check degraded: " + (storage.error || "unknown"));
      if (disk.status !== "healthy") warnings.push("Disk space usage is high (> 90%)");
      if (hasWorkerError) warnings.push("Workers degraded: " + workerDegradedReason.trim());
      if (hasQueueBacklog) warnings.push("Queues backed up: " + queueBacklogReason.trim());
    }
  }

  const latencyMs = Date.now() - start;

  // 6. Return Structured Observability Payload
  const responsePayload = {
    status: statusLevel,
    timestamp: new Date().toISOString(),
    latencyMs,
    application: {
      status: statusLevel === "unhealthy" ? "down" : "running",
      version: database.version || "1.2.0-phase3",
      warnings: warnings.length > 0 ? warnings : undefined,
    },
    infrastructure: {
      database: {
        status: database.status,
        latencyMs: database.latencyMs,
      },
      redis: {
        status: redis.status,
        latencyMs: redis.latencyMs,
      },
      email: {
        status: email.status,
        error: email.error,
      },
      shiprocket: {
        status: shiprocket.status,
        error: shiprocket.error,
      },
      storage: {
        status: storage.status,
        error: storage.error,
      },
      workers: workerStatuses,
      queues: queueStats,
      system: {
        node_version: process.version,
        hostname: os.hostname(),
        memory_used_percent: Number(memUsedPercent.toFixed(2)),
        disk_used_percent: disk.percentUsed,
        disk_available_gb: disk.availableGb,
        uptime_seconds: Math.round(process.uptime()),
      },
    },
  };

  const httpStatus = statusLevel === "unhealthy" ? 503 : 200;
  return NextResponse.json(responsePayload, { status: httpStatus });
}
