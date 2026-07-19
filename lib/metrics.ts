import { Queue } from "bullmq";
import IORedis from "ioredis";
import { loadService } from "./db/client-raw";
import { getSharedProducerConnection } from "./jobs/connection";

const globalMetrics = (globalThis as any).metricsRegistry || {
  cacheHits: 0,
  cacheMisses: 0,
  latencies: {} as Record<string, number[]>,
  requestCounts: {} as Record<string, number>,
  slowestEndpoints: {} as Record<string, number>,
};
(globalThis as any).metricsRegistry = globalMetrics;

export function recordCacheHit() {
  globalMetrics.cacheHits++;
}

export function recordCacheMiss() {
  globalMetrics.cacheMisses++;
}

export function recordApiLatency(route: string, durationMs: number) {
  if (!globalMetrics.latencies[route]) {
    globalMetrics.latencies[route] = [];
  }
  globalMetrics.latencies[route].push(durationMs);
  if (globalMetrics.latencies[route].length > 100) {
    globalMetrics.latencies[route].shift();
  }


  globalMetrics.requestCounts[route] = (globalMetrics.requestCounts[route] || 0) + 1;
  globalMetrics.slowestEndpoints[route] = Math.max(globalMetrics.slowestEndpoints[route] || 0, durationMs);
}

export async function getQueueMetrics(): Promise<any> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return {};
  
  const connection = getSharedProducerConnection();
  const queues = [
    "email-delivery",
    "shipment-retry",
    "payment-processing",
    "shipment-sync",
    "reservation-cleanup",
    "payment-recovery",
    "loyalty-expiry",
    "product-cleanup",
    "points-credit",
    "outbox-processing",
  ];
  
  const results: Record<string, any> = {};
  
  try {
    for (const name of queues) {
      const q = new Queue(name, { connection: connection as any });
      const counts = await q.getJobCounts();
      
      const completedJobs = await q.getCompleted(0, 10);
      let avgLatencyMs = 0;
      let avgProcessingMs = 0;
      let count = 0;
      
      for (const job of completedJobs) {
        if (job.processedOn && job.timestamp) {
          avgLatencyMs += (job.processedOn - job.timestamp);
        }
        if (job.finishedOn && job.processedOn) {
          avgProcessingMs += (job.finishedOn - job.processedOn);
        }
        count++;
      }
      
      results[name] = {
        counts,
        avgLatencyMs: count > 0 ? Math.round(avgLatencyMs / count) : 0,
        avgProcessingMs: count > 0 ? Math.round(avgProcessingMs / count) : 0,
      };
      await q.close();
    }
  } catch (err) {
    console.error("[metrics] Error fetching queue metrics:", err);
  }
  
  return results;
}

export function getSystemMetrics() {
  const hitRatio = globalMetrics.cacheHits + globalMetrics.cacheMisses === 0
    ? 0
    : globalMetrics.cacheHits / (globalMetrics.cacheHits + globalMetrics.cacheMisses);
    
  const apiAverages: Record<string, number> = {};
  let overallSlowestRoute = "";
  let overallSlowestLatency = 0;
  let totalApiRequests = 0;

  for (const [route, times] of Object.entries(globalMetrics.latencies)) {
    const arr = times as number[];
    if (arr.length > 0) {
      const sum = arr.reduce((a, b) => a + b, 0);
      apiAverages[route] = Math.round(sum / arr.length);
    } else {
      apiAverages[route] = 0;
    }
    
    const count = globalMetrics.requestCounts[route] || 0;
    totalApiRequests += count;

    const slowest = globalMetrics.slowestEndpoints[route] || 0;
    if (slowest > overallSlowestLatency) {
      overallSlowestLatency = slowest;
      overallSlowestRoute = route;
    }
  }

  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  
  return {
    cache: {
      hits: globalMetrics.cacheHits,
      misses: globalMetrics.cacheMisses,
      hitRatio: parseFloat(hitRatio.toFixed(4)),
    },
    system: {
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
      cpu: {
        userMicro: cpu.user,
        systemMicro: cpu.system,
      }
    },
    api: {
      averages: apiAverages,
      slowest: {
        route: overallSlowestRoute || "none",
        latencyMs: overallSlowestLatency,
      },
      totalRequests: totalApiRequests,
    }
  };
}

export async function getCommerceMetrics(): Promise<any> {
  try {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      return { successRate: 0, failureRate: 0, backlogs: { email: 0, shiprocket: 0, payment: 0 } };
    }

    // Fast exact count queries using pagination flags
    const { count: paidCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["Paid", "Processing", "Packed", "Shipped", "Delivered"]);

    const { count: totalCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    const paid = paidCount || 0;
    const total = totalCount || 0;
    const failed = total - paid;

    const successRate = total > 0 ? (paid / total) * 100 : 100;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    // Fetch backlogs from queue directly
    const queueMetrics = await getQueueMetrics();
    const emailBacklog = (queueMetrics["email-delivery"]?.counts?.waiting || 0) + (queueMetrics["email-delivery"]?.counts?.active || 0);
    const shiprocketBacklog = 
      (queueMetrics["shipment-retry"]?.counts?.waiting || 0) + 
      (queueMetrics["shipment-retry"]?.counts?.active || 0) + 
      (queueMetrics["shipment-sync"]?.counts?.waiting || 0) + 
      (queueMetrics["shipment-sync"]?.counts?.active || 0);
    const paymentBacklog = 
      (queueMetrics["payment-processing"]?.counts?.waiting || 0) + 
      (queueMetrics["payment-processing"]?.counts?.active || 0);

    // Fetch outbox metrics from DB
    const { count: pendingOutboxCount } = await supabase
      .from("outbox_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING");

    const { count: processingOutboxCount } = await supabase
      .from("outbox_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "PROCESSING");

    const { count: failedOutboxCount } = await supabase
      .from("outbox_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "FAILED");

    // Fetch oldest pending outbox event age
    const { data: oldestEvent } = await supabase
      .from("outbox_events")
      .select("created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let oldestPendingAgeSec = 0;
    if (oldestEvent?.created_at) {
      oldestPendingAgeSec = Math.round((Date.now() - new Date(oldestEvent.created_at).getTime()) / 1000);
    }

    return {
      paymentSuccessRate: parseFloat(successRate.toFixed(2)),
      paymentFailureRate: parseFloat(failureRate.toFixed(2)),
      backlogs: {
        email: emailBacklog,
        shiprocket: shiprocketBacklog,
        payment: paymentBacklog,
      },
      outbox: {
        pendingCount: pendingOutboxCount || 0,
        processingCount: processingOutboxCount || 0,
        failedCount: failedOutboxCount || 0,
        oldestPendingAgeSec: oldestPendingAgeSec
      }
    };
  } catch (err) {
    console.error("[metrics] Commerce metrics error:", err);
    return { 
      paymentSuccessRate: 0, 
      paymentFailureRate: 0, 
      backlogs: { email: 0, shiprocket: 0, payment: 0 },
      outbox: { pendingCount: 0, processingCount: 0, failedCount: 0, oldestPendingAgeSec: 0 }
    };
  }
}

export async function getAggregatedMetrics() {
  const systemAndApi = getSystemMetrics();
  const queueMetrics = await getQueueMetrics();
  const commerceMetrics = await getCommerceMetrics();

  return {
    timestamp: new Date().toISOString(),
    system: systemAndApi.system,
    cache: systemAndApi.cache,
    api: systemAndApi.api,
    queues: queueMetrics,
    commerce: commerceMetrics,
  };
}
