import IORedis from "ioredis";

/**
 * Strips surrounding quotes and whitespace that Vercel's env var UI
 * sometimes injects, e.g.  REDIS_URL="rediss://..." stored literally
 * with the quotes, which IORedis receives as `"rediss://..."` and
 * fails to parse (EINVAL / ENOTFOUND on port %22).
 */
function sanitizeRedisUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Remove leading/trailing whitespace then strip surrounding single or double quotes
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const REDIS_URL = sanitizeRedisUrl(process.env.REDIS_URL) || "redis://localhost:6379";

let redisClient: IORedis | null = null;
let isRedisAvailable = false;

// Gracefully initialize Redis client
try {
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    if (!sanitizeRedisUrl(process.env.REDIS_URL)) {
      console.warn("[Cache Service] REDIS_URL not set — running without Redis. In-memory fallback active.");
    } else {
      redisClient = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: 2,
        connectTimeout: 2000,
      });

      redisClient.on("error", (err) => {
        console.warn("[Cache Service] Redis connection offline:", err.message);
        isRedisAvailable = false;
      });

      redisClient.on("connect", () => {
        console.log("[Cache Service] Redis connection established successfully.");
        isRedisAvailable = true;
      });
    }
  }
} catch (e) {
  // Never throw during module init — a Redis misconfiguration must not crash
  // the Next.js server or poison the module cache for downstream routes.
  console.error("[Cache Service] Redis init error — falling back to in-memory cache:", e);
  redisClient = null;
  isRedisAvailable = false;
}

// Memory cache fallback for robustness/offline mode
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

export const CacheService = {
  /**
   * Retrieves a parsed JSON object from cache. Returns null on miss or fallback.
   */
  async get<T>(key: string): Promise<T | null> {
    if (process.env.DISABLE_REDIS_CACHE === "true") {
      return null;
    }

    const now = Date.now();

    // 1. Try memory cache first (as fallback/offline option)
    const memEntry = memoryCache.get(key);
    if (memEntry) {
      if (memEntry.expiresAt > now) {
        return memEntry.value as T;
      } else {
        memoryCache.delete(key);
      }
    }

    // 2. Try Redis if available
    if (redisClient && isRedisAvailable) {
      try {
        const val = await redisClient.get(key);
        if (val) {
          return JSON.parse(val) as T;
        }
      } catch (err: any) {
        console.warn(`[Cache Service] Redis GET failed for key "${key}":`, err.message);
      }
    }

    return null;
  },

  /**
   * Caches a value with a given Time-To-Live (TTL) in seconds.
   */
  async set(key: string, value: any, ttlSecs: number): Promise<void> {
    if (process.env.DISABLE_REDIS_CACHE === "true") {
      return;
    }

    const expiresAt = Date.now() + ttlSecs * 1000;
    
    // Save to memory cache fallback
    memoryCache.set(key, { value, expiresAt });

    // Save to Redis
    if (redisClient && isRedisAvailable) {
      try {
        await redisClient.set(key, JSON.stringify(value), "EX", ttlSecs);
        
        // Track keys via Redis Sets for optimized pattern invalidation (avoiding keys/scan spikes)
        let tagSet: string | null = null;
        if (key.startsWith("products:slug:")) {
          tagSet = "tag:products:slug";
        } else if (key.startsWith("products:list")) {
          tagSet = "tag:products:list";
        }
        if (tagSet) {
          await redisClient.sadd(tagSet, key);
          // Set tag set TTL to match or exceed the key TTL to prevent stale sets
          await redisClient.expire(tagSet, ttlSecs + 3600);
        }
      } catch (err: any) {
        console.warn(`[Cache Service] Redis SET failed for key "${key}":`, err.message);
      }
    }
  },

  /**
   * Invalidates a specific cache key.
   */
  async del(key: string): Promise<void> {
    memoryCache.delete(key);

    if (process.env.DISABLE_REDIS_CACHE === "true") {
      return;
    }

    if (redisClient && isRedisAvailable) {
      try {
        await redisClient.del(key);
      } catch (err: any) {
        console.warn(`[Cache Service] Redis DEL failed for key "${key}":`, err.message);
      }
    }
  },

  /**
   * Invalidates keys matching a wildcard pattern (e.g. "products:*").
   */
  async delPattern(pattern: string): Promise<void> {
    // Invalidate matching memory cache entries
    const regexPattern = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of memoryCache.keys()) {
      if (regexPattern.test(key)) {
        memoryCache.delete(key);
      }
    }

    if (process.env.DISABLE_REDIS_CACHE === "true") {
      return;
    }

    if (redisClient && isRedisAvailable) {
      try {
        // Tag set check based on pattern wildcard
        let tagSet: string | null = null;
        if (pattern === "products:slug:*" || pattern.startsWith("products:slug")) {
          tagSet = "tag:products:slug";
        } else if (pattern === "products:list*" || pattern.startsWith("products:list")) {
          tagSet = "tag:products:list";
        }

        if (tagSet) {
          const keys = await redisClient.smembers(tagSet);
          if (keys && keys.length > 0) {
            await redisClient.del(...keys);
            await redisClient.del(tagSet);
          }
        } else {
          // Fallback for generic patterns: use SCAN instead of blocking KEYS call
          const keys: string[] = [];
          let cursor = "0";
          do {
            const reply = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = reply[0];
            keys.push(...reply[1]);
          } while (cursor !== "0");

          if (keys.length > 0) {
            await redisClient.del(...keys);
          }
        }
      } catch (err: any) {
        console.warn(`[Cache Service] Redis DEL pattern failed for "${pattern}":`, err.message);
      }
    }
  },

  /**
   * Simple health check returns true if Redis is active.
   */
  async healthCheck(): Promise<boolean> {
    if (process.env.DISABLE_REDIS_CACHE === "true") {
      return false;
    }
    if (!redisClient) return false;
    try {
      const ping = await redisClient.ping();
      return ping === "PONG";
    } catch (e) {
      return false;
    }
  },

  /**
   * Rate limits an identifier (e.g., IP address) for a specific action.
   * Returns true if allowed, false if limit exceeded.
   */
  async checkRateLimit(identifier: string, limit: number, windowSecs: number): Promise<boolean> {
    if (process.env.DISABLE_REDIS_CACHE === "true") {
      return true; // Pass-through when Redis is disabled
    }
    if (redisClient && isRedisAvailable) {
      const key = `ratelimit:${identifier}`;
      try {
        const count = await redisClient.incr(key);
        if (count === 1) {
          await redisClient.expire(key, windowSecs);
        }
        return count <= limit;
      } catch (err: any) {
        console.warn(`[Cache Service] Rate limit check failed for "${identifier}":`, err.message);
        return false; // Fail-closed on Redis error — prevents brute-force during outage
      }
    }
    return true; // Fallback to pass-through if Redis is offline
  }
};
