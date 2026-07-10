import { chromium } from "playwright";

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to example.com...");
  await page.goto("https://example.com");
  console.log("Title:", await page.title());
  await browser.close();
  console.log("Success!");
}

main().catch(console.error);
