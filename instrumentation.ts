// Next.js instrumentation hook — loads the correct Sentry runtime config.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    
    // Run startup services validation checks dynamically
    const { validateServices } = await import("./lib/startup-validation");
    await validateServices().catch((err) => {
      console.error("[Startup Validation Error]:", err);
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
