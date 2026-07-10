-- Migration: Add Return Schema Constraints and Composite Performance Indexes (2026-07-09)
-- Apply via Supabase CLI or SQL Editor. All statements are idempotent.

-- 1. Check constraints on return fields in orders table
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_return_fields;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_return_fields CHECK (
    (status NOT IN ('Return Requested', 'Returned', 'Return Rejected')) OR 
    (return_reason IS NOT NULL AND refund_option IS NOT NULL AND return_request_date IS NOT NULL)
) NOT VALID;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_return_reject;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_return_reject CHECK (
    (status <> 'Return Rejected') OR (return_reject_reason IS NOT NULL)
) NOT VALID;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_refund_option;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_refund_option CHECK (
    refund_option IS NULL OR refund_option IN ('wallet', 'original_source')
) NOT VALID;

-- 2. Composite indexes for high performance query lookups
-- Speed up active user order filtering by (user_id, status)
CREATE INDEX IF NOT EXISTS idx_orders_user_id_status 
  ON public.orders (user_id, status);

-- Speed up product variant lookups on stock check & deduction paths
CREATE INDEX IF NOT EXISTS idx_product_variants_lookup 
  ON public.product_variants (product_id, size, color);
