import { loadService } from "./db/client-raw";
import IORedis from "ioredis";

export interface HealthResponse {
  service: string;
  version: string;
  environment: string;
  status: "healthy" | "unhealthy";
  latencyMs: number;
  uptimeSeconds: number;
  timestamp: string;
  lastSuccessfulConnection: string | null;
  error: string | null;
}

const bootTime = Date.now();
const APP_VERSION = "1.2.0-phase3";
const ENV = process.env.NODE_ENV || "development";

// Global cache for last successful connections
const globalCache = (globalThis as any).healthCache || {
  database: null,
  redis: null,
  email: null,
  shiprocket: null,
  storage: null,
};
(globalThis as any).healthCache = globalCache;

function getUptimeSeconds(): number {
  return Math.round((Date.now() - bootTime) / 1000);
}

export async function checkDatabase(): Promise<HealthResponse> {
  const start = Date.now();
  try {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured");
    }
    const { error: profileError } = await supabase.from("profiles").select("id").limit(1);
    if (profileError) throw profileError;

    // Schema Validation Check: Ensure PostgREST cache has updated and recognizes all payment-critical columns
    const criticalColumns = [
      "id",
      "customer",
      "date",
      "total",
      "status",
      "original_total",
      "wallet_paid",
      "gateway_paid",
      "points_redeemed",
      "points_discount",
      "idempotency_key",
      "payment_status",
      "razorpay_order_id",
      "razorpay_payment_id",
      "payment_processing_state"
    ];
    const { error: schemaError } = await supabase.from("orders").select(criticalColumns.join(",")).limit(1);
    if (schemaError) {
      if (schemaError.code === "PGRST204" || schemaError.message?.includes("column")) {
        throw new Error(`Supabase schema cache out of sync (PGRST204): Critical columns validation failed: ${schemaError.message}`);
      }
      throw schemaError;
    }
    
    const latencyMs = Date.now() - start;
    globalCache.database = new Date().toISOString();
    return {
      service: "database",
      version: APP_VERSION,
      environment: ENV,
      status: "healthy",
      latencyMs,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.database,
      error: null,
    };
  } catch (err: any) {
    return {
      service: "database",
      version: APP_VERSION,
      environment: ENV,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.database,
      error: err.message || "Database connection error",
    };
  }
}

export async function checkRedis(): Promise<HealthResponse> {
  const start = Date.now();
  let connection: IORedis | null = null;
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL not configured");
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    const pong = await connection.ping();
    if (pong !== "PONG") throw new Error("Redis ping response invalid");
    
    const latencyMs = Date.now() - start;
    globalCache.redis = new Date().toISOString();
    return {
      service: "redis",
      version: APP_VERSION,
      environment: ENV,
      status: "healthy",
      latencyMs,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.redis,
      error: null,
    };
  } catch (err: any) {
    return {
      service: "redis",
      version: APP_VERSION,
      environment: ENV,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.redis,
      error: err.message || "Redis connection error",
    };
  } finally {
    if (connection) {
      await connection.quit().catch(() => {});
    }
  }
}

export async function checkEmail(): Promise<HealthResponse> {
  const start = Date.now();
  try {
    const hasBrevo = !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);
    const hasResend = !!process.env.RESEND_API_KEY;
    if (!hasBrevo && !hasResend) {
      throw new Error("No transactional email provider configured");
    }
    
    if (hasResend) {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }
      });
      if (res.status === 401) throw new Error("Invalid Resend API Key");
    }
    
    const latencyMs = Date.now() - start;
    globalCache.email = new Date().toISOString();
    return {
      service: "email",
      version: APP_VERSION,
      environment: ENV,
      status: "healthy",
      latencyMs,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.email,
      error: null,
    };
  } catch (err: any) {
    return {
      service: "email",
      version: APP_VERSION,
      environment: ENV,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.email,
      error: err.message || "Email service configuration error",
    };
  }
}

export async function checkShiprocket(): Promise<HealthResponse> {
  const start = Date.now();
  try {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;
    if (!email || !password) throw new Error("Shiprocket credentials not configured");
    
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("Shiprocket login credentials validation failed");
    
    const latencyMs = Date.now() - start;
    globalCache.shiprocket = new Date().toISOString();
    return {
      service: "shiprocket",
      version: APP_VERSION,
      environment: ENV,
      status: "healthy",
      latencyMs,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.shiprocket,
      error: null,
    };
  } catch (err: any) {
    return {
      service: "shiprocket",
      version: APP_VERSION,
      environment: ENV,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.shiprocket,
      error: err.message || "Shiprocket API check failed",
    };
  }
}

export async function checkStorage(): Promise<HealthResponse> {
  const start = Date.now();
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary storage credentials not configured");
    }
    
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/ping`;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) throw new Error(`Cloudinary responded with status ${res.status}`);
    
    const latencyMs = Date.now() - start;
    globalCache.storage = new Date().toISOString();
    return {
      service: "storage",
      version: APP_VERSION,
      environment: ENV,
      status: "healthy",
      latencyMs,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.storage,
      error: null,
    };
  } catch (err: any) {
    return {
      service: "storage",
      version: APP_VERSION,
      environment: ENV,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      uptimeSeconds: getUptimeSeconds(),
      timestamp: new Date().toISOString(),
      lastSuccessfulConnection: globalCache.storage,
      error: err.message || "Storage service connection failed",
    };
  }
}
