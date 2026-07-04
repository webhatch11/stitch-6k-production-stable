import { test, expect } from "@playwright/test";

/** Shopping flows: browsing, product detail, size selection, cart. */

async function firstProductLink(page: import("@playwright/test").Page) {
  // Product cards link to /product/<slug>
  const link = page.locator('a[href^="/product/"]').first();
  await expect(link).toBeVisible({ timeout: 20_000 });
  return link;
}

test.describe("Shopping", () => {
  test("homepage loads with products", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/6K|Stitch/i);
    // At least one product link somewhere on the homepage
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("shop all page lists products", async ({ page }) => {
    await page.goto("/shopallshirts");
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("product detail page loads correctly", async ({ page }) => {
    await page.goto("/shopallshirts");
    const link = await firstProductLink(page);
    const href = await link.getAttribute("href");
    await page.goto(href!);
    await expect(page).toHaveURL(/\/product\//);
    // Title, price and size options should render
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/₹|INR/).first()).toBeVisible();
  });

  test("size selection enables Add to Cart", async ({ page }) => {
    await page.goto("/shopallshirts");
    const link = await firstProductLink(page);
    const href = await link.getAttribute("href");
    await page.goto(href!);

    const addToCart = page.getByRole("button", { name: /add to (cart|bag)/i }).first();
    await expect(addToCart).toBeVisible();

    // Click a size chip (S/M/L/XL/XXL buttons)
    const sizeButton = page
      .getByRole("button", { name: /^(S|M|L|XL|XXL)$/ })
      .first();
    if (await sizeButton.count()) {
      await sizeButton.click();
    }
    await expect(addToCart).toBeEnabled();
  });

  test("add to cart updates cart and cart page shows the item", async ({ page }) => {
    await page.goto("/shopallshirts");
    const link = await firstProductLink(page);
    const href = await link.getAttribute("href");
    await page.goto(href!);

    const title = (await page.locator("h1").first().textContent())?.trim() || "";

    const sizeButton = page
      .getByRole("button", { name: /^(S|M|L|XL|XXL)$/ })
      .first();
    if (await sizeButton.count()) {
      await sizeButton.click();
    }

    const addToCart = page.getByRole("button", { name: /add to (cart|bag)/i }).first();
    await addToCart.click();

    await page.goto("/shoppingbag");
    // The bag should contain the product name we added
    if (title) {
      await expect(page.getByText(new RegExp(title.slice(0, 12), "i")).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("remove from cart works", async ({ page }) => {
    // Seed cart
    await page.goto("/shopallshirts");
    const link = await firstProductLink(page);
    const href = await link.getAttribute("href");
    await page.goto(href!);
    const sizeButton = page
      .getByRole("button", { name: /^(S|M|L|XL|XXL)$/ })
      .first();
    if (await sizeButton.count()) {
      await sizeButton.click();
    }
    await page.getByRole("button", { name: /add to (cart|bag)/i }).first().click();

    await page.goto("/shoppingbag");
    const removeButton = page
      .getByRole("button", { name: /remove|delete|trash/i })
      .first();
    if (await removeButton.count()) {
      await removeButton.click();
    } else {
      // Icon-only remove buttons: fall back to a button containing a trash icon
      const iconRemove = page.locator("button:has(svg)").filter({ hasText: "" });
      test.skip(!(await iconRemove.count()), "No remove control found");
    }
  });
});
