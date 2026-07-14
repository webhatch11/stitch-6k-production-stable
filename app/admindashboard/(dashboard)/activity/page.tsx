import { db } from "@/lib/db";
import ActivityLogClient from "./ActivityLogClient";

export const dynamic = "force-dynamic";

export default async function ActivityLogPage() {
  const [productLogs, paymentLogs, shippingLogs] = await Promise.all([
    db.getAllProductAuditLogs(100),
    db.getPaymentAuditLogs(100),
    db.getTrackingLogs(100),
  ]);

  return (
    <ActivityLogClient
      productLogs={productLogs}
      paymentLogs={paymentLogs}
      shippingLogs={shippingLogs}
    />
  );
}
