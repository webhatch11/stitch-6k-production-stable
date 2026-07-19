import IORedis from "ioredis";
import os from "os";

const startedAt = new Date().toISOString();
const APP_VERSION = "1.2.0-phase3";

export async function startHeartbeat(connection: IORedis, workerName: string): Promise<NodeJS.Timeout> {
  const key = `worker:${workerName}`;

  const publish = async () => {
    try {
      const info = {
        worker: workerName,
        status: "online",
        pid: String(process.pid),
        hostname: os.hostname(),
        startedAt: startedAt,
        lastHeartbeat: new Date().toISOString(),
        uptimeSeconds: String(Math.round(process.uptime())),
        version: APP_VERSION,
      };

      await connection.hset(key, info);
      await connection.expire(key, 90); // 90-second TTL
    } catch (err: any) {
      console.error(`[Heartbeat] Failed to publish heartbeat for ${workerName}:`, err.message || err);
    }
  };

  // Run immediately on startup
  await publish();

  // Schedule to run every 30 seconds
  const timer = setInterval(publish, 30000);
  timer.unref(); // Prevent timer from keeping node process active during shutdown signals
  return timer;
}
