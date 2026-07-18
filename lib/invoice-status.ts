/**
 * Invoice & Order Status Classification Helpers
 *
 * Single source of truth for which order statuses belong to each
 * invoice category. Derived directly from the order state machine
 * defined in lib/db/orders.ts (ALLOWED_TRANSITIONS).
 *
 * Rules:
 *  - BILLABLE:   Order has completed payment and is in active fulfilment.
 *                Includes wallet-only paid orders.
 *  - RETURNED:   Order was returned / refunded after delivery.
 *  - CANCELLED:  Order was cancelled (pre- or post-payment).
 *  - PENDING:    Order exists but payment has not been captured yet —
 *                must NEVER appear in any invoice view.
 */

/** Statuses that represent a successfully paid and active order. */
export const BILLABLE_STATUSES = new Set([
  "Paid",
  "paid",
  "Paid via Wallet",
  "paid via wallet",
  "Accepted",
  "accepted",
  "Processing",
  "processing",
  "Packed",
  "packed",
  "Waiting for Dispatch",
  "Shipped",
  "shipped",
  "Delivered",
  "delivered",
  "Return Requested",
  "Return Accepted",
  "Return Pickup Scheduled",
  "Return QC Pending",
  "Return Approved",
  "Return QC Failed",
  "Reship Requested",
  "Return in Transit",
  "Return Rejected",
]);

/** Statuses that represent a completed return/refund. */
export const RETURNED_STATUSES = new Set([
  "Returned",
  "returned",
  "Refunded",
  "refunded",
]);

/** Statuses that represent a cancelled order (any point in lifecycle). */
export const CANCELLED_STATUSES = new Set([
  "Cancelled",
  "cancelled",
  "Refunded (Out of Stock)",
  "refunded (out of stock)",
]);

/**
 * Statuses that must NEVER appear as invoices.
 * These are pre-payment or payment-failure states.
 */
export const NON_INVOICE_STATUSES = new Set([
  "Pending",
  "pending",
  "Payment Pending",
  "payment pending",
  "FAILED",
  "Failed",
  "failed",
  "Payment Review Required",
  "payment review required",
]);

// ─── Classification helpers ──────────────────────────────────────────────────

/**
 * Returns true if the order has completed payment and should appear
 * in the "Billed Invoices" ledger.
 */
export function isBillableOrder(status: string): boolean {
  return BILLABLE_STATUSES.has(status);
}

/**
 * Returns true if the order was returned/refunded and should appear
 * in the "Returned Invoices" ledger.
 */
export function isReturnedInvoice(status: string): boolean {
  return RETURNED_STATUSES.has(status);
}

/**
 * Returns true if the order was cancelled and should appear in the
 * "Cancelled" ledger. Only cancelled orders that were previously paid
 * have financial significance.
 */
export function isCancelledInvoice(status: string): boolean {
  return CANCELLED_STATUSES.has(status);
}

/**
 * Returns true if the order has NO invoice relevance — it is still in
 * a pre-payment or failed-payment state.
 */
export function isNonInvoiceOrder(status: string): boolean {
  return NON_INVOICE_STATUSES.has(status);
}

/**
 * Tab classifier — returns which tab an order belongs to.
 * "none" means the order should not appear in any invoice tab.
 */
export type InvoiceTab = "billed" | "returned" | "cancelled" | "none";

export function classifyOrderForInvoice(status: string): InvoiceTab {
  if (isBillableOrder(status)) return "billed";
  if (isReturnedInvoice(status)) return "returned";
  if (isCancelledInvoice(status)) return "cancelled";
  return "none"; // Payment Pending, FAILED, Payment Review Required, etc.
}
