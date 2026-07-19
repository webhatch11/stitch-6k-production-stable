import IORedis from "ioredis";
import { loadService } from "../../db/client-raw";
import { Queue } from "bullmq";
import { getRedisConfig } from "../connection";

export async function validateWorkerStartup(params: {
  workerName: string;
  queues: string[];
  requiredEnvs: string[];
  redisUrl: string;
}): Promise<void> {
  console.log(`🚀 [${params.workerName}] Starting pre-flight validation checks...`);

  // 1. Validate Environment Variables
  for (const envVar of params.requiredEnvs) {
    if (envVar === "REDIS_URL") {
      const provider = (process.env.REDIS_PROVIDER || "selfhosted").trim().toLowerCase();
      if (provider === "selfhosted" && process.env.REDIS_HOST) {
        continue; // REDIS_URL is not required when discrete keys are configured
      }
    }
    if (!process.env[envVar]) {
      console.error(`❌ [${params.workerName}] FATAL: Environment variable "${envVar}" is not set.`);
      process.exit(1);
    }
  }
  console.log(`✅ [${params.workerName}] All required environment variables verified.`);

  const config = getRedisConfig();
  const createClient = (options: any) => {
    if (typeof config === "string") {
      return new IORedis(config, options);
    }
    return new IORedis({ ...config, ...options });
  };

  // 2. Validate Redis Connectivity
  let redisClient: IORedis | null = null;
  try {
    redisClient = createClient({
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
    await redisClient.ping();
    console.log(`✅ [${params.workerName}] Redis connectivity verified.`);
  } catch (err: any) {
    console.error(`❌ [${params.workerName}] FATAL: Redis connection check failed. Error: ${err.message}`);
    process.exit(1);
  } finally {
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }
  }

  // 3. Validate Database Connectivity
  try {
    const { supabase, isSupabaseConfigured } = loadService();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase service client is not configured.");
    }
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) {
      throw error;
    }
    console.log(`✅ [${params.workerName}] Database connectivity verified.`);
  } catch (err: any) {
    console.error(`❌ [${params.workerName}] FATAL: Database connectivity check failed. Error: ${err.message}`);
    process.exit(1);
  }

  // 4. Validate Queue Registration
  let testConnection: IORedis | null = null;
  try {
    testConnection = createClient({
      maxRetriesPerRequest: null,
    });
    for (const queueName of params.queues) {
      const q = new Queue(queueName, { connection: testConnection as any });
      await q.getJobCounts(); // Verification ping to assert registry can be queried
      await q.close();
      console.log(`✅ [${params.workerName}] Queue "${queueName}" successfully registered.`);
    }
  } catch (err: any) {
    console.error(`❌ [${params.workerName}] FATAL: Queue registration check failed. Error: ${err.message}`);
    process.exit(1);
  } finally {
    if (testConnection) {
      await testConnection.quit().catch(() => {});
    }
  }

  console.log(`✅ [${params.workerName}] Pre-flight validation successfully passed! Starting worker process.`);
}
