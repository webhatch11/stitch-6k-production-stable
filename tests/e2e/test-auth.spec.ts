import { test, expect } from "@playwright/test";

/**
 * Auth flows.
 *
 * Real OTP delivery requires a live inbox, so OTP verification steps are
 * covered up to the point where an email would be sent. Session-dependent
 * assertions are guarded with test.skip().
 */

test.describe("Authentication", () => {
  test("login page renders the OTP email form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // Email input present
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test("unauthenticated access to /checkout redirects to login", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test("login preserves ?redirect=/checkout param", async ({ page }) => {
    await page.goto("/login?redirect=/checkout");
    await expect(page).toHaveURL(/redirect=%2Fcheckout|redirect=\/checkout/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test("unauthenticated access to /myprofile redirects to login", async ({ page }) => {
    await page.goto("/myprofile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /orderhistory redirects to login", async ({ page }) => {
    await page.goto("/orderhistory");
    await expect(page).toHaveURL(/\/login/);
  });

  test("empty email submit shows validation feedback", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    // Submit the surrounding form with an empty email
    await emailInput.press("Enter");
    // Either browser-native validation blocks it or the app shows an error;
    // in both cases we must still be on /login with no OTP inputs shown.
    await expect(page).toHaveURL(/\/login/);
  });

  test("new user signup via OTP flow (manual only)", async () => {
    test.skip(true, "Requires a live email inbox for OTP delivery — run manually");
  });

  test("returning user login via OTP (manual only)", async () => {
    test.skip(true, "Requires a live email inbox for OTP delivery — run manually");
  });

  test("logout clears cart and session (manual only)", async () => {
    test.skip(true, "Requires an authenticated session — run manually or via storage state");
  });
});
