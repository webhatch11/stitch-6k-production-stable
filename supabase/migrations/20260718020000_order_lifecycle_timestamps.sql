-- Stitch 6K Order Lifecycle Schema Extension Migration
-- Add lifecycle audit timestamps to support Task 2 Requirements

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Optimize query paths for order status groupings in dashboard pages
CREATE INDEX IF NOT EXISTS idx_orders_lifecycle_status ON public.orders (status);
