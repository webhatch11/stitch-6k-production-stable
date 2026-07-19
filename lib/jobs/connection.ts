import IORedis from "ioredis";

// Global interface to track metrics inside the application process
interface ConnectionMetrics {
  activeCount: number;
  reconnectCount: number;
  connections: Record<string, {
    status: string;
    reconnects: number;
  }>;
}

// Global registry structure to avoid module-level isolation leaks during Next.js hot reloads
const globalRef = globalThis as any;

if (!globalRef.redisRegistry) {
  globalRef.redisRegistry = {
    sharedProducer: null as IORedis | null,
    workerConnections: new Map<string, IORedis>(),
    reconnectCounts: new Map<string, number>(),
  };
}

const registry = globalRef.redisRegistry;

/**
 * Resolves Redis connection options based on REDIS_PROVIDER and environment configuration.
 * Validates values and supports discrete configurations (Host/Port/User/Pass) as well as URLs.
 */
export function getRedisConfig(): string | { host: string; port: number; username?: string; password?: string } {
  const rawProvider = process.env.REDIS_PROVIDER || "selfhosted";
  const provider = rawProvider.trim().toLowerCase();

  switch (provider) {
    case "selfhosted": {
      // Prioritize discrete keys
      if (process.env.REDIS_HOST) {
        return {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
          username: process.env.REDIS_USERNAME || undefined,
          password: process.env.REDIS_PASSWORD || undefined,
        };
      }
      // Fallback to URL-based configurations
      const url = process.env.REDIS_URL_SELF || process.env.REDIS_URL || "redis://localhost:6379";
      return url;
    }

    case "upstash": {
      const url = process.env.REDIS_URL_UPSTASH || process.env.REDIS_URL || "redis://localhost:6379";
      return url;
    }

    default:
      throw new Error(`Unknown REDIS_PROVIDER: "${rawProvider}". Allowed values are: "selfhosted", "upstash"`);
  }
}

/**
 * Helper to construct an IORedis client from a connection config string or options object.
 */
function createRedisClient(config: string | { host: string; port: number; username?: string; password?: string }, options: any): IORedis {
  if (typeof config === "string") {
    return new IORedis(config, options);
  }
  return new IORedis({
    ...config,
    ...options
  });
}

/**
 * Lazily retrieves the shared producer connection.
 * Used by rate limiters, caching layers, and queue producers.
 */
export function getSharedProducerConnection(): IORedis {
  if (!registry.sharedProducer) {
    const config = getRedisConfig();
    const options = {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      reconnectOnError: () => true,
    };

    registry.sharedProducer = createRedisClient(config, options);

    const key = "shared_producer";
    registry.reconnectCounts.set(key, 0);

    registry.sharedProducer.on("reconnecting", () => {
      const current = registry.reconnectCounts.get(key) || 0;
      registry.reconnectCounts.set(key, current + 1);
    });

    registry.sharedProducer.on("error", (err: any) => {
      console.error("[Redis Shared Producer] Connection Error:", err.message || err);
    });
  }
  return registry.sharedProducer!;
}

/**
 * Instantiates and registers a dedicated Redis connection for a BullMQ worker.
 * BullMQ Workers require dedicated clients due to blocking commands.
 */
export function createWorkerConnection(workerName: string): IORedis {
  // If a connection for this worker is already active in the process, reuse it
  if (registry.workerConnections.has(workerName)) {
    const existing = registry.workerConnections.get(workerName)!;
    if (existing.status === "ready" || existing.status === "connecting") {
      return existing;
    }
    // If it was closed or errored permanently, recreate it
    try {
      existing.disconnect();
    } catch {}
    registry.workerConnections.delete(workerName);
  }

  const config = getRedisConfig();
  const options = {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    reconnectOnError: () => true,
  };

  const client = createRedisClient(config, options);

  const key = `worker_${workerName}`;
  registry.reconnectCounts.set(key, 0);

  client.on("reconnecting", () => {
    const current = registry.reconnectCounts.get(key) || 0;
    registry.reconnectCounts.set(key, current + 1);
  });

  client.on("error", (err: any) => {
    console.error(`[Redis Worker: ${workerName}] Connection Error:`, err.message || err);
  });

  registry.workerConnections.set(workerName, client);
  return client;
}

/**
 * Closes all Redis connections managed by the application.
 * Invoked during process termination (SIGINT / SIGTERM).
 */
export async function closeAllRedisConnections(): Promise<void> {
  const closures: Promise<void>[] = [];

  // Close worker connections
  for (const [name, client] of registry.workerConnections.entries()) {
    try {
      closures.push(
        client.quit().then(() => {
          registry.workerConnections.delete(name);
        }).catch(() => {
          client.disconnect();
          registry.workerConnections.delete(name);
        })
      );
    } catch {}
  }

  // Close shared connection
  if (registry.sharedProducer) {
    try {
      closures.push(
        registry.sharedProducer.quit().then(() => {
          registry.sharedProducer = null;
        }).catch(() => {
          registry.sharedProducer?.disconnect();
          registry.sharedProducer = null;
        })
      );
    } catch {}
  }

  await Promise.all(closures);
}

/**
 * Generates runtime client diagnostics for the observability endpoint.
 */
export function getConnectionMetrics(): ConnectionMetrics {
  const connections: Record<string, { status: string; reconnects: number }> = {};
  let activeCount = 0;
  let totalReconnects = 0;

  if (registry.sharedProducer) {
    activeCount++;
    const recon = registry.reconnectCounts.get("shared_producer") || 0;
    totalReconnects += recon;
    connections["shared_producer"] = {
      status: registry.sharedProducer.status,
      reconnects: recon,
    };
  }

  for (const [name, client] of registry.workerConnections.entries()) {
    activeCount++;
    const key = `worker_${name}`;
    const recon = registry.reconnectCounts.get(key) || 0;
    totalReconnects += recon;
    connections[`worker:${name}`] = {
      status: client.status,
      reconnects: recon,
    };
  }

  return {
    activeCount,
    reconnectCount: totalReconnects,
    connections,
  };
}
