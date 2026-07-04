import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test suite for Stitch 6K.
 *
 * Auth-dependent flows (real OTP login, payment capture) cannot run headless
 * against production Supabase/Razorpay without live credentials, so those
 * specs guard themselves with test.skip() and a note. Everything else runs
 * against the local dev server.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
