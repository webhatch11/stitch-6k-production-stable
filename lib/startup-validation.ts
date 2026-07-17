import { checkDatabase, checkRedis, checkEmail, checkShiprocket, checkStorage } from "./health";

/**
 * Hard blockers: services whose absence makes the app non-functional.
 * - database: every user-facing page depends on it.
 *
 * Soft dependencies (warnings only, never fatal):
 * - redis:      rate limiting / caching. In-memory fallbacks exist throughout.
 * - email:      async transactional emails. Falls back to direct SMTP.
 * - shiprocket: logistics API. Failures are caught per-request.
 * - storage:    Cloudinary image uploads. Not required for site load.
 *
 * IMPORTANT: Do NOT add Redis to fatalBlockers. On Vercel the IORedis
 * client is not available during cold starts until the TCP handshake
 * completes. Treating it as fatal causes process.exit(1) during
 * normal Vercel cold-start, taking down the whole deployment.
 */
const FATAL_SERVICES = new Set(["database"]);

export async function validateServices() {
  console.log("🚀 [Startup Validation] Running external services checks...");

  const [database, redis, email, shiprocket, storage] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkEmail(),
    checkShiprocket(),
    checkStorage(),
  ]);

  const allResults = [database, redis, email, shiprocket, storage];
  const fatalFailures: string[] = [];
  const warnings: string[] = [];

  for (const result of allResults) {
    if (result.status !== "healthy") {
      const msg = `${result.service}: ${result.error}`;
      if (FATAL_SERVICES.has(result.service)) {
        fatalFailures.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("⚠️  [Startup Validation] Non-critical service(s) degraded (app will continue):");
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (fatalFailures.length > 0) {
    console.error("❌ [Startup Validation] FATAL service(s) unavailable:");
    fatalFailures.forEach((f) => console.error(`  - ${f}`));

    if (process.env.NODE_ENV === "production") {
      console.error("🔥 [FATAL] Terminating process — database unavailable in production.");
      process.exit(1);
    }
  } else {
    console.log("✅ [Startup Validation] All critical services are healthy!");
  }
}
