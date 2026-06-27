-- ============================================================
-- Day 12: Refund tracking columns on orders
-- Adds the columns needed for Razorpay refund integration.
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_status TEXT;
-- refund_status values: NULL (no refund) | "initiated" | "processed" | "failed"
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Index for refund webhook lookups (find order by refund_id)
CREATE INDEX IF NOT EXISTS idx_orders_refund_id
  ON public.orders (refund_id)
  WHERE refund_id IS NOT NULL;

-- Backfill razorpay_payment_id from payments table where possible
-- (so we have it directly on orders for the refund call without
-- a join)
UPDATE public.orders o
SET razorpay_payment_id = p.razorpay_payment_id
FROM public.payments p
WHERE p.order_id = o.id
  AND p.razorpay_payment_id IS NOT NULL
  AND o.razorpay_payment_id IS NULL;
