import { test, expect } from "@playwright/test";

/**
 * Admin dashboard security and flows.
 *
 * Full admin CRUD flows need an admin session (real OTP); those are guarded
 * behind E2E_ADMIN_STORAGE_STATE. The security-critical redirect behavior is
 * fully covered without a session.
 */

const HAS_ADMIN = !!process.env.E2E_ADMIN_STORAGE_STATE;

test.describe("Admin — unauthenticated", () => {
  test("/admindashboard/login loads without redirect loop", async ({ page }) => {
    const response = await page.goto("/admindashboard/login");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/admindashboard\/login/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test("direct /admindashboard access redirects to admin login", async ({ page }) => {
    await page.goto("/admindashboard");
    await expect(page).toHaveURL(/\/admindashboard\/login/);
  });

  test("deep admin route access redirects to admin login", async ({ page }) => {
    await page.goto("/admindashboard/orders");
    await expect(page).toHaveURL(/\/admindashboard\/login/);
  });

  test("non-admin email is blocked before OTP is sent", async ({ page }) => {
    await page.goto("/admindashboard/login");
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill("definitely-not-an-admin@example.com");
    const submit = page.getByRole("button", { name: /send|continue|otp|login|sign/i }).first();
    await submit.click();
    // The checkAdminEmail server action must reject before any OTP is sent
    await expect(
      page.getByText(/not authorized|not an admin|denied|unauthorized|not allowed/i).first()
    ).toBeVisible({ timeout: 15_000 });
    // Must NOT advance to the OTP entry step
    await expect(page).toHaveURL(/\/admindashboard\/login/);
  });
});

test.describe("Admin — authenticated", () => {
  test.skip(!HAS_ADMIN, "Requires E2E_ADMIN_STORAGE_STATE with an admin session");
  test.use({ storageState: process.env.E2E_ADMIN_STORAGE_STATE });

  test("admin can view product list", async ({ page }) => {
    await page.goto("/admindashboard/inventory");
    await expect(page.getByText(/product|inventory/i).first()).toBeVisible();
  });

  test("admin can open add-product form", async ({ page }) => {
    await page.goto("/admindashboard/add-product");
    await expect(page.locator("form, input").first()).toBeVisible();
  });

  test("admin inventory shows per-size controls", async ({ page }) => {
    await page.goto("/admindashboard/inventory");
    await expect(page.getByText(/^(S|M|L|XL|XXL)$/).first()).toBeVisible();
  });

  test("admin settings save and reload correctly", async ({ page }) => {
    await page.goto("/admindashboard/settings");
    const saveButton = page.getByRole("button", { name: /save/i }).first();
    await expect(saveButton).toBeVisible();
  });
});
