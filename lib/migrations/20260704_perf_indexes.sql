-- Performance indexes for hot query paths (2026-07-04 audit).
-- Apply via Supabase SQL editor or CLI. All statements are idempotent.

-- Payment verification looks orders up by razorpay_order_id on every capture.
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON public.orders (razorpay_order_id);

-- Customer order history + ownership checks filter by user_id.
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);

-- Shiprocket webhook + tracking sync look orders up by AWB.
CREATE INDEX IF NOT EXISTS idx_orders_shiprocket_id
  ON public.orders (shiprocket_id);

-- Order listings sort by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- Order sub-resources fetched per order id.
CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON public.order_events (order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id);
