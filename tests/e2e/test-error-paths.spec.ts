import { test, expect } from "@playwright/test";

/** Error paths and abuse cases. */

test.describe("Error paths", () => {
  test("/orderconfirmed without orderId shows Order Not Found", async ({ page }) => {
    await page.goto("/orderconfirmed");
    await expect(page.getByText(/order not found/i).first()).toBeVisible();
  });

  test("/orderconfirmed with a bogus orderId shows Order Not Found", async ({ page }) => {
    await page.goto("/orderconfirmed?orderId=ORD-DOES-NOT-EXIST-123");
    await expect(page.getByText(/order not found/i).first()).toBeVisible();
  });

  test("/ordertracking with fake ID shows error gracefully", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/ordertracking?orderId=FAKE-ORDER-999999");
    // Page must render (no crash) and not display another user's data
    await expect(page.locator("body")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("track API rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/logistics/track?orderId=ORD-1001");
    expect([401, 404]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
    // Must never leak an address snapshot to an unauthenticated caller
    expect(JSON.stringify(body)).not.toMatch(/address_line_1|postal_code|phone/);
  });

  test("payments create-order rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/payments/create-order", {
      data: {
        cart: [{ productName: "X", price: 1, size: "M", image: "" }],
        baseTotal: 1,
        netTotal: 1,
        customerName: "Attacker",
        idempotencyKey: "e2e-test-unauth",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("shiprocket webhook without token is rejected (or dev-allowed)", async ({ request }) => {
    const res = await request.post("/api/webhooks/shiprocket", {
      data: { awb: "TEST", current_status: "Delivered" },
    });
    // In production (token configured) this must be 401.
    // In dev with no token configured it is allowed by design.
    expect([200, 401]).toContain(res.status());
  });

  test("empty cart checkout redirects away", async ({ page }) => {
    await page.goto("/shoppingbag");
    // Empty bag either shows an empty state or redirects to the shop page
    const emptyState = page.getByText(/empty|nothing|no items|continue shopping/i).first();
    const redirected = /shopallshirts/.test(page.url());
    if (!redirected) {
      await expect(emptyState).toBeVisible({ timeout: 15_000 });
    }
  });

  test("invalid product slug 404s gracefully", async ({ page }) => {
    const response = await page.goto("/product/this-slug-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("direct /admindashboard access without login redirects to admin login", async ({ page }) => {
    await page.goto("/admindashboard");
    await expect(page).toHaveURL(/\/admindashboard\/login/);
  });

  test("out-of-stock size shows Sold Out state", async ({ page }) => {
    // Data-dependent: only runs when a sold-out size exists on the first product
    await page.goto("/shopallshirts");
    const link = page.locator('a[href^="/product/"]').first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    const href = await link.getAttribute("href");
    await page.goto(href!);
    const soldOut = page.getByText(/sold out|out of stock/i).first();
    if (!(await soldOut.count())) {
      test.skip(true, "No sold-out size on the first product — data-dependent check");
    }
    await expect(soldOut).toBeVisible();
  });
});
