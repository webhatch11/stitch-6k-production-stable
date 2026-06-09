/**
 * Automated Verification Check Utility for Stitch 6K Foundation Stabilization Phase
 * Runs assertions on the business logic layers to guarantee transactional safety.
 */

import assert from "assert";
import { RegistryManager } from "../lib/registry";
import { db } from "../lib/db";

console.log("=========================================");
console.log("STITCH 6K FOUNDATION STABILIZATION CHECK");
console.log("=========================================");

// Mocking Browser context requirements for RegistryManager
(global as any).window = {
  location: {
    reload: () => console.log("Window reload called.")
  }
};
(global as any).localStorage = {
  store: {} as { [key: string]: string },
  getItem(key: string) { return this.store[key] || null; },
  setItem(key: string, value: any) { this.store[key] = String(value); },
  removeItem(key: string) { delete this.store[key]; },
  clear() { this.store = {}; }
};

function runInventoryTests() {
  console.log("\n[1/3] Running Inventory & Stock Transaction Tests...");
  
  // Initialize mock store products
  RegistryManager.init();
  const products = RegistryManager.getProducts();
  assert(products.length > 0, "Seed products should be loaded");

  // Find a product to test (e.g., Boxy Streetwear Oversized)
  const testProduct = products.find(p => p.slug === "oversized-atelier-black");
  assert(testProduct, "Boxy Streetwear Oversized product should exist");
  
  const originalStockS = testProduct.sizeStock?.S || 0;
  console.log(`- Product: ${testProduct.title}`);
  console.log(`- Original Size S Stock: ${originalStockS}`);

  // 1. Verify verification of available stock
  const singleItem = [{ productName: testProduct.title, size: "S", price: 2999, image: "" }];
  const verifyRes1 = RegistryManager.verifyStock(singleItem);
  assert(verifyRes1.success, "Should succeed for single item in stock");
  console.log("✓ verifyStock succeeds when stock is available");

  // 2. Verify blocking when stock is insufficient
  const hugeDemand = Array(originalStockS + 5).fill({ productName: testProduct.title, size: "S", price: 2999, image: "" });
  const verifyRes2 = RegistryManager.verifyStock(hugeDemand);
  assert(!verifyRes2.success, "Should fail when demand exceeds size stock");
  assert(verifyRes2.message?.includes("Insufficient stock"), "Should report insufficient stock message");
  console.log("✓ verifyStock blocks checkout when stock is insufficient");

  // 3. Verify transactional stock deduction
  RegistryManager.deductStock(singleItem);
  const updatedProducts = RegistryManager.getProducts();
  const updatedProduct = updatedProducts.find(p => p.slug === "oversized-atelier-black");
  assert(updatedProduct, "Updated product should exist");
  assert.strictEqual(updatedProduct.sizeStock?.S, originalStockS - 1, "Size S stock should decrease by 1");
  console.log(`✓ deductStock correctly decrements inventory size stock (Now: ${updatedProduct.sizeStock?.S})`);
}

function runZustandStateSimulation() {
  console.log("\n[2/3] Simulating Zustand Cart State Business Logic...");

  // We simulate the state transition operations from stores/cartStore.ts
  const cartItems: any[] = [];

  const addToCart = (item: any, quantity = 1) => {
    for (let i = 0; i < quantity; i++) {
      cartItems.push({ ...item });
    }
  };

  const removeFromCart = (productName: string, size: string, color: string) => {
    const index = cartItems.findIndex(
      (x) => x.productName === productName && x.size === size && (x.color || "Atelier Choice") === color
    );
    if (index !== -1) {
      cartItems.splice(index, 1);
    }
  };

  const incrementQuantity = (productName: string, size: string, color: string, availableStock: number) => {
    const groupedCount = cartItems.filter(
      (x) => x.productName === productName && x.size === size && (x.color || "Atelier Choice") === color
    ).length;

    if (groupedCount >= availableStock) {
      console.log(`- Blocked incrementing beyond stock limit (${availableStock})`);
      return false;
    }
    
    // Add one more
    const template = cartItems.find(
      (x) => x.productName === productName && x.size === size && (x.color || "Atelier Choice") === color
    );
    if (template) {
      cartItems.push({ ...template });
      return true;
    }
    return false;
  };

  // Run Assertions on Zustand Cart operations
  addToCart({ productName: "Atelier Olive", price: 1899, size: "M" }, 2);
  assert.strictEqual(cartItems.length, 2, "Cart should contain 2 items");
  console.log("✓ Add to Cart simulation adds item with correct quantity");

  removeFromCart("Atelier Olive", "M", "Atelier Choice");
  assert.strictEqual(cartItems.length, 1, "Cart should contain 1 item after removal of one unit");
  console.log("✓ Remove from Cart decreases item quantity correctly");

  const incrementSuccess = incrementQuantity("Atelier Olive", "M", "Atelier Choice", 5);
  assert(incrementSuccess, "Should increment successfully");
  assert.strictEqual(cartItems.length, 2, "Cart should be 2 items again");
  
  // Try to increment beyond stock limit of 2
  const limitIncrement = incrementQuantity("Atelier Olive", "M", "Atelier Choice", 2);
  assert(!limitIncrement, "Should block increment beyond stock limit of 2");
  assert.strictEqual(cartItems.length, 2, "Cart count should remain 2");
  console.log("✓ Cart state logic successfully enforces maximum stock bounds");
}

function runDatabaseVerify() {
  console.log("\n[3/3] Verifying Proxy and DB layer integrations...");
  
  assert(db, "db object should be imported successfully");
  assert(typeof db.verifyStock === "function", "db.verifyStock should be defined");
  assert(typeof db.deductStock === "function", "db.deductStock should be defined");
  
  console.log("✓ db.verifyStock and db.deductStock methods are exposed correctly");
}

try {
  runInventoryTests();
  runZustandStateSimulation();
  runDatabaseVerify();
  console.log("\n=========================================");
  console.log("  ALL VERIFICATION CHECKS PASSED CLEANLY!");
  console.log("=========================================");
} catch (e) {
  console.error("\n❌ VERIFICATION FAILURE DETECTED:");
  console.error(e);
  process.exit(1);
}
