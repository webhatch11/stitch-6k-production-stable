import { db } from "../lib/db";

async function check() {
  try {
    const coupons = await db.getCoupons();
    console.log("ALL COUPONS:", JSON.stringify(coupons, null, 2));

    const orders = await db.getOrders();
    const ordersWithSam = orders.filter(o => (o.couponCode || "").toUpperCase() === "SAM");
    console.log("ORDERS WITH SAM:", JSON.stringify(ordersWithSam, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

check();
