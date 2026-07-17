import { checkDatabase, checkRedis, checkEmail, checkShiprocket, checkStorage } from "./health";

export async function validateServices() {
  console.log("🚀 [Startup Validation] Running external services checks...");
  
  const [database, redis, email, shiprocket, storage] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkEmail(),
    checkShiprocket(),
    checkStorage(),
  ]);

  const failures: string[] = [];
  if (database.status !== "healthy") failures.push(`Database: ${database.error}`);
  if (redis.status !== "healthy") failures.push(`Redis: ${redis.error}`);
  if (email.status !== "healthy") failures.push(`Email: ${email.error}`);
  if (shiprocket.status !== "healthy") failures.push(`Shiprocket: ${shiprocket.error}`);
  if (storage.status !== "healthy") failures.push(`Storage: ${storage.error}`);

  if (failures.length > 0) {
    console.error("❌ [Startup Validation] Service validation failed! Blockers detected:");
    failures.forEach((f) => console.error(`  - ${f}`));
    
    if (process.env.NODE_ENV === "production") {
      console.error("🔥 [FATAL] Terminating process due to missing critical services in production.");
      process.exit(1);
    }
  } else {
    console.log("✅ [Startup Validation] All external services are healthy and connected!");
  }
}
