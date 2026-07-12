import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { db } = require("../lib/db");

async function run() {
  try {
    console.log("Generating Razorpay Order ID...");
    const rzpId = await db.generateOrderId("razorpay");
    console.log("Result:", rzpId);

    console.log("Generating Wallet Order ID...");
    const walletId = await db.generateOrderId("wallet");
    console.log("Result:", walletId);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

run();
