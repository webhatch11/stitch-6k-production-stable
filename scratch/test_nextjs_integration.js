const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("====================================================");
console.log("Stitch 6K Heritage - Next.js E2E Integration Audit (Async DB)");
console.log("====================================================\n");

// Step 1: Compile lib/db.ts, lib/supabase.ts, and lib/registry.ts to CommonJS so we can run them in Node
console.log("Compiling database adapter and registry files...");
try {
    execSync('npx tsc lib/db.ts lib/supabase.ts lib/registry.ts --target es2020 --module commonjs --outDir scratch', { stdio: 'inherit' });
    console.log("Compilation successful!\n");
} catch (err) {
    console.error("Compilation failed. Ensure typescript is installed and source files are valid.", err);
    process.exit(1);
}

// Step 2: Set up mock environment for the browser-only registry
const localStorageStore = {};
global.window = {};
global.localStorage = {
    getItem(key) {
        return localStorageStore[key] !== undefined ? localStorageStore[key] : null;
    },
    setItem(key, value) {
        localStorageStore[key] = String(value);
    },
    removeItem(key) {
        delete localStorageStore[key];
    }
};
global.location = {
    reload() {
        console.log("[Window Reload Triggered]");
    }
};

// Import the compiled db adapter
const { db } = require('./db.js');

// Define registry keys matching lib/registry.ts
const PRODUCTS_KEY = "registry_products";
const ORDERS_KEY = "registry_orders";
const WALLET_BALANCE_KEY = "registry_wallet_balance";
const LOYALTY_POINTS_KEY = "registry_loyalty_points";

// Assert Helper
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ Assertion Failed: ${message}`);
        process.exit(1);
    }
    console.log(`✅ Passed: ${message}`);
}

// Step 3: Run Audit Scenario
(async () => {
    // --- 1. Coupon Management Audit ---
    console.log("\n--- Audit Part 1: Coupon Management ---");
    // Create a flat discount coupon PROCEED20
    const flatPromo = {
        code: "PROCEED20",
        discount: 2000, // flat ₹2000 discount
        type: "flat"
    };
    await db.saveCoupon(flatPromo);

    const fetchedCoupon = await db.validateCoupon("PROCEED20");
    assert(fetchedCoupon !== undefined, "PROCEED20 coupon should be created and valid");
    assert(fetchedCoupon.type === "flat", "Coupon type should be flat");
    assert(fetchedCoupon.discount === 2000, "Coupon discount should be 2000");

    // --- 2. Product Management Audit ---
    console.log("\n--- Audit Part 2: Product Creation & Editing ---");
    // Add product ATELIER-LIN-10 with size stock loaded (10 items per size)
    const atelierProduct = {
        id: "ATELIER-LIN-10",
        title: "Atelier French Blue Linen",
        price: 10799, // Final price computed
        category: "Linen",
        image: "/assets/atelier_linen.jpg",
        images: ["/assets/atelier_linen.jpg"],
        isNew: true,
        isAtelierExclusive: true,
        stock: 50, // total sizeStock sum
        sizeStock: {
            S: 10,
            M: 10,
            L: 10,
            XL: 10,
            XXL: 10
        },
        basePrice: 9999,
        gstRate: 18,
        discountRate: 10,
        specFabric: "100% French Linen",
        specFit: "Atelier Tailored Fit",
        specCollar: "Spread Collar",
        specSleeve: "Long Sleeve",
        specCare: "Dry Clean Only"
    };

    await db.saveProduct(atelierProduct);

    const products = await db.getProducts();
    const savedProd = products.find(p => p.id === "ATELIER-LIN-10");
    assert(savedProd !== undefined, "ATELIER-LIN-10 product should exist in product list");
    assert(savedProd.category === "Linen", "Category should be Linen");
    assert(savedProd.isAtelierExclusive === true, "Should have Atelier Exclusive badging enabled");

    // Verify price calculation consistency
    const gstPercent = savedProd.gstRate / 100;
    const discPercent = savedProd.discountRate / 100;
    const expectedPrice = (savedProd.basePrice * (1 + gstPercent)) - (savedProd.basePrice * discPercent);
    console.log(`Calculated Final Price: ₹${expectedPrice} (Saved Price: ₹${savedProd.price})`);
    assert(Math.abs(savedProd.price - expectedPrice) < 0.1, "Saved price should match the Live Pricing Calculator logic");

    // --- 3. Checkout Split Payment Math ---
    console.log("\n--- Audit Part 3: Checkout Split Payment & Wallet/Loyalty Deductions ---");
    // Net Total = ₹10799
    // User uses:
    // - Coupon PROCEED20 (Flat ₹2000) -> Balance to pay: ₹8799
    // - Redeems 1000 Loyalty Points (value = ₹100, since 10 points = ₹1 ratio) -> Balance to pay: ₹8699
    // - Pays with Store Wallet: ₹1500
    // - Rest is paid via Payment Gateway: ₹7199

    // Pre-load user wallet and loyalty account
    localStorage.setItem(WALLET_BALANCE_KEY, "5000");
    localStorage.setItem(LOYALTY_POINTS_KEY, "3000");

    const cartSubtotal = savedProd.price; // 10799
    const couponDiscount = 2000;
    const netBeforePoints = cartSubtotal - couponDiscount; // 8799
    const pointsRedeemed = 1000;
    const pointsDiscount = pointsRedeemed / 10; // 100
    const finalPayable = netBeforePoints - pointsDiscount; // 8699

    const walletAmountToPay = 1500;
    const gatewayAmountToPay = finalPayable - walletAmountToPay; // 7199

    // Debit Wallet and Loyalty Points
    await db.applyWalletDebit(walletAmountToPay, "ORD-E2E-1");
    await db.applyLoyaltyDebit(pointsRedeemed, "ORD-E2E-1");

    // Save the order
    const newOrderPayload = {
        id: "ORD-E2E-1",
        customer: "Keerthi Kumar",
        date: new Date().toLocaleDateString("en-IN"),
        total: finalPayable,
        originalTotal: cartSubtotal,
        couponCode: "PROCEED20",
        couponDiscount: couponDiscount,
        walletPaid: walletAmountToPay,
        gatewayPaid: gatewayAmountToPay,
        pointsRedeemed: pointsRedeemed,
        pointsDiscount: pointsDiscount,
        pointsEarned: Math.floor(finalPayable / 10), // 869 points earned
        status: "Pending",
        items: ["Atelier French Blue Linen"]
    };

    await db.saveOrder(newOrderPayload);

    // Verify balances after checkout
    assert(await db.getWalletBalance() === 3500, "Wallet balance should be ₹3500 (5000 - 1500)");
    assert(await db.getLoyaltyPoints() === 2000, "Loyalty points should be 2000 (3000 - 1000)");

    const ordersList = await db.getOrders();
    const savedOrder = ordersList.find(o => o.id === "ORD-E2E-1");
    assert(savedOrder !== undefined, "Order should be persisted in orders list");
    assert(savedOrder.gatewayPaid === 7199, "Gateway paid should be ₹7199");
    assert(savedOrder.walletPaid === 1500, "Wallet paid should be ₹1500");

    // --- 4. Logistics, Returns, and Restocking Quality Check Audit ---
    console.log("\n--- Audit Part 4: Logistics Status Flow & Returns restock validation ---");

    // Step 4.1: Mark Order Shipped/Delivered
    savedOrder.status = "Delivered";
    localStorage.setItem(ORDERS_KEY, JSON.stringify(ordersList));

    // Step 4.2: Customer Requests Return (Option: Original Payment Method)
    const returnReqSuccess = await db.requestManualReturn("ORD-E2E-1", {
        reason: "Size fit issue",
        details: "The atelier fit is slightly too tight at the shoulders.",
        image: "data:image/png;base64,...",
        refundOption: "bank" // Refund gatewayPaid back to bank, walletPaid back to wallet
    });
    assert(returnReqSuccess === true, "Return request should be accepted");
    
    const ordersAfterReturn = await db.getOrders();
    assert(ordersAfterReturn.find(o => o.id === "ORD-E2E-1").status === "Return Requested", "Order status should update to 'Return Requested'");

    // Step 4.3: Admin Approves Pickup
    const pickupApproved = await db.approveReturnPickup("ORD-E2E-1");
    assert(pickupApproved === true, "Return pickup approval should succeed");
    
    const ordersAfterPickup = await db.getOrders();
    assert(ordersAfterPickup.find(o => o.id === "ORD-E2E-1").status === "Return in Transit", "Order status should update to 'Return in Transit'");

    // Step 4.4: Admin Quality Audit & Process Refund (QC Passed -> RESTOCKS product)
    // Initial stock count of product is 50
    const productsBeforeRefund = await db.getProducts();
    assert(productsBeforeRefund.find(p => p.id === "ATELIER-LIN-10").stock === 50, "Initial product stock should be 50");

    const refundProcessed = await db.processReturnRefund("ORD-E2E-1", true); // QC PASSED
    assert(refundProcessed === true, "Refund processing should succeed");

    // Verify order status
    const ordersAfterRefund = await db.getOrders();
    const finalOrder = ordersAfterRefund.find(o => o.id === "ORD-E2E-1");
    assert(finalOrder.status === "Returned", "Final order status should be 'Returned'");
    assert(finalOrder.qualityCheckPassed === true, "Quality Check status should be PASSED");

    // Verify RESTOCKING
    const productsAfterRefund = await db.getProducts();
    const restockedProduct = productsAfterRefund.find(p => p.id === "ATELIER-LIN-10");
    assert(restockedProduct.stock === 51, "Product stock should increment by 1 to 51 since QC Passed");

    // Verify split refund math credits
    // Since refundOption was 'bank':
    // - Wallet balance gets walletPaid (₹1500) credited back. Total: 3500 + 1500 = 5000.
    // - Loyalty Points:
    //   - restored pointsRedeemed (1000)
    //   - revoked pointsEarned (869)
    //   - Net change: +131 points. Total: 2000 + 131 = 2131.
    assert(await db.getWalletBalance() === 5000, "Wallet balance should be restored to ₹5000");
    assert(await db.getLoyaltyPoints() === 2131, "Loyalty points should be 2131 (restored redeemed + revoked earned)");

    console.log("\n====================================================");
    console.log("🎉 SUCCESS: All E2E Integration Audit steps passed!");
    console.log("====================================================");
    process.exit(0);
})().catch(err => {
    console.error("❌ E2E Integration Audit Scenario Failed:", err);
    process.exit(1);
});
