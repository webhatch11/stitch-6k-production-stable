import { loadService } from "../db/client-raw";

export interface ReconciliationReport {
  timestamp: string;
  totalOrdersAudited: number;
  unreconciledOrdersCount: number;
  imbalances: Array<{
    orderId: string;
    totalAmount: number;
    walletPaid: number;
    gatewayPaid: number;
    refundAmount: number;
    sumRefundsTable: number;
    sumLedgerRefunds: number;
    discrepancy: number;
    issue: string;
  }>;
}

export async function runFinancialReconciliationAudit(): Promise<ReconciliationReport> {
  const { supabase, isSupabaseConfigured } = loadService();
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured for reconciliation audit.");
  }

  const report: ReconciliationReport = {
    timestamp: new Date().toISOString(),
    totalOrdersAudited: 0,
    unreconciledOrdersCount: 0,
    imbalances: []
  };

  // Fetch all orders with their refunds and ledger transactions
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, total, wallet_paid, gateway_paid, refund_amount, status");

  if (ordersErr || !orders) {
    console.error("[Reconciliation Audit] Failed to fetch orders:", ordersErr);
    return report;
  }

  report.totalOrdersAudited = orders.length;

  for (const order of orders) {
    // 1. Fetch from refunds table
    const { data: refunds, error: refundsErr } = await supabase
      .from("refunds")
      .select("total_refund_amount")
      .eq("order_id", order.id)
      .eq("status", "PROCESSED");

    // 2. Fetch from financial_ledger table
    const { data: ledgerRefunds, error: ledgerErr } = await supabase
      .from("financial_ledger")
      .select("amount")
      .eq("order_id", order.id)
      .eq("event_type", "refund_issued");

    const sumRefunds = (refunds || []).reduce((sum, r) => sum + Number(r.total_refund_amount || 0), 0);
    const sumLedger = (ledgerRefunds || []).reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const orderRefund = Number(order.refund_amount || 0);

    // Check for imbalances between order.refund_amount, refunds table, and financial_ledger
    const discrepancyRefunds = Math.abs(orderRefund - sumRefunds);
    const discrepancyLedger = Math.abs(orderRefund - sumLedger);

    if (discrepancyRefunds > 0.01 || discrepancyLedger > 0.01) {
      report.unreconciledOrdersCount++;
      report.imbalances.push({
        orderId: order.id,
        totalAmount: Number(order.total || 0),
        walletPaid: Number(order.wallet_paid || 0),
        gatewayPaid: Number(order.gateway_paid || 0),
        refundAmount: orderRefund,
        sumRefundsTable: sumRefunds,
        sumLedgerRefunds: sumLedger,
        discrepancy: Math.max(discrepancyRefunds, discrepancyLedger),
        issue: `Discrepancy detected. Order Refund: ₹${orderRefund}, Refunds Table Sum: ₹${sumRefunds}, Ledger Refunds Sum: ₹${sumLedger}`
      });
    }
  }

  console.log(`[Reconciliation Audit] Completed. Audited: ${report.totalOrdersAudited}, Unreconciled: ${report.unreconciledOrdersCount}`);
  return report;
}
