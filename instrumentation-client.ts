// Browser Sentry init. Under Sentry v10 + Next.js 16 this file replaces the
// legacy sentry.client.config.ts (which the SDK deprecates and which does not
// work under Turbopack). No-op when the DSN is absent.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Required by the SDK to instrument client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
