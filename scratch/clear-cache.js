const IORedis = require("ioredis");
const fs = require("fs");
const path = require("path");

// Load .env.local variables
const envPath = path.join(__dirname, "..", ".env.local");
let redisUrl = "redis://localhost:6379";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const redisMatch = envContent.match(/REDIS_URL\s*=\s*(.*)/);
  if (redisMatch) redisUrl = redisMatch[1].trim().replace(/['"]/g, "");
}

console.log("Connecting to Redis at:", redisUrl);

const redisClient = new IORedis(redisUrl, {
  maxRetriesPerRequest: 2,
  connectTimeout: 2000,
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err.message);
  process.exit(1);
});

redisClient.on("connect", async () => {
  console.log("Connected to Redis successfully.");
  try {
    const key = "settings:coupons";
    const exists = await redisClient.exists(key);
    console.log(`Does key "${key}" exist in Redis?`, exists === 1 ? "Yes" : "No");
    
    if (exists === 1) {
      const val = await redisClient.get(key);
      console.log("Current cached value in Redis:", val);
      await redisClient.del(key);
      console.log(`Successfully deleted Redis cache key "${key}"`);
    } else {
      console.log("Key not found in Redis, nothing to delete.");
    }
  } catch (err) {
    console.error("Error operations on Redis:", err);
  } finally {
    redisClient.disconnect();
    process.exit(0);
  }
});
