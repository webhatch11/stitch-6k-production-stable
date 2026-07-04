import { test, expect } from "@playwright/test";

/** Policy pages: content presence and footer links. */

const POLICY_PAGES = [
  { path: "/about", mustContain: /6K|atelier|about/i },
  { path: "/contact", mustContain: /contact|concierge|email|phone/i },
  { path: "/privacy", mustContain: /privacy|data|information/i },
  { path: "/terms", mustContain: /terms|conditions|agreement/i },
  { path: "/shipping-policy", mustContain: /shipping|delivery/i },
  { path: "/payment-policy", mustContain: /payment/i },
  { path: "/refund-policy", mustContain: /refund/i },
  { path: "/cancellation-policy", mustContain: /cancel/i },
  { path: "/return-policy", mustContain: /return|exchange/i },
];

test.describe("Policy pages", () => {
  for (const { path, mustContain } of POLICY_PAGES) {
    test(`${path} loads with real content`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(mustContain);
      // Guard against empty shells: the page must have substantial text
      const text = await page.locator("body").innerText();
      expect(text.length).toBeGreaterThan(200);
    });
  }

  test("footer contains all 8 policy links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    for (const href of [
      "/privacy",
      "/terms",
      "/shipping-policy",
      "/payment-policy",
      "/refund-policy",
      "/cancellation-policy",
      "/return-policy",
      "/about",
    ]) {
      await expect(footer.locator(`a[href="${href}"]`).first()).toBeAttached();
    }
  });

  test("/payment-policy mentions COD unavailable", async ({ page }) => {
    await page.goto("/payment-policy");
    await expect(page.locator("body")).toContainText(/COD|cash on delivery/i);
    await expect(page.locator("body")).toContainText(/not available|unavailable|prepaid/i);
  });

  test("/shipping-policy mentions Prepaid Orders Only", async ({ page }) => {
    await page.goto("/shipping-policy");
    await expect(page.locator("body")).toContainText(/prepaid/i);
  });
});
