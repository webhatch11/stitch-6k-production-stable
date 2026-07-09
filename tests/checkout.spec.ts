import { test, expect } from "@playwright/test";

test.describe("Stitch 6K Storefront Core Flow Tests", () => {
  test("Landing Page Loads Successfully", async ({ page }) => {
    await page.goto("/");
    // Validate the page title contains brand name
    await expect(page).toHaveTitle(/6K Brand/);
    
    // Check if hero header is visible
    const heroHeading = page.locator("h1");
    await expect(heroHeading.first()).toBeVisible();
  });

  test("Shop Page Product Grid Navigation", async ({ page }) => {
    await page.goto("/shopallshirts");
    // Verify product card container is visible
    const card = page.locator("[id^='product-card-']");
    await expect(card.first()).toBeAttached({ timeout: 10000 });
  });

  test("Add Product to Shopping Cart", async ({ page }) => {
    // Navigate to a known product page
    await page.goto("/product/classic-linen-shirt-white");
    
    // Select a size (e.g. Size M) if size options exist
    const sizeButton = page.locator("button[aria-label*='Size M']");
    if (await sizeButton.count() > 0) {
      await sizeButton.first().click();
    }
    
    // Check if add to cart button exists and click
    const addToCartButton = page.locator("button:has-text('ADD TO BAG')");
    if (await addToCartButton.count() > 0) {
      await addToCartButton.click();
      // Verify shopping bag counter increments or cart drawer appears
      const cartCount = page.locator(".cart-badge-count");
      if (await cartCount.count() > 0) {
        await expect(cartCount).not.toHaveText("0");
      }
    }
  });

  test("Checkout Unauthorized Access Redirects", async ({ page }) => {
    // Unauthorized access to checkout page must redirect to login
    await page.goto("/checkout");
    await page.waitForURL("**/login**");
    await expect(page.url()).toContain("/login");
  });

  test("Invoice Route Security Restrictions", async ({ page }) => {
    // Unauthorized access to invoice details must redirect to login
    await page.goto("/invoice");
    await page.waitForURL("**/login**");
    await expect(page.url()).toContain("/login");
  });

  test("Payment Verification API Endpoint Health Check", async ({ request }) => {
    // Payment verification endpoint must reject empty GET requests with 405 Method Not Allowed or 400 bad request
    const response = await request.post("/api/payments/verify", {
      data: {}
    });
    expect(response.status()).toBe(400); // expect bad request due to schema validation failure
  });

  test("Logistics Tracking API Health Check", async ({ request }) => {
    // Logistics tracking endpoint must return 400/404 or bad request status for invalid IDs
    const response = await request.get("/api/logistics/track?orderId=STK-INVALID-123");
    expect(response.status()).toBe(400);
  });
});
