import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test suite for Stitch 6K.
 *
 * Default target: https://the6k.com (production).
 * Override with E2E_BASE_URL=http://localhost:3000 for local dev runs.
 *
 * Auth-dependent flows (real OTP login, payment capture) cannot run headless
 * without live credentials — those specs guard themselves with test.skip().
 * webServer is only started when targeting localhost.
 */
const BASE_URL = process.env.E2E_BASE_URL || "https://the6k.com";
const isLocalhost = BASE_URL.includes("localhost");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Only spin up the local dev server when targeting localhost
  ...(isLocalhost
    ? {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 180_000,
        },
      }
    : {}),
});
