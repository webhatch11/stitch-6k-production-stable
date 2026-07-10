-- Migration: Stitch 6K Dashboard and E-Commerce Schema Fixes (2026-07-10)
-- 1. Enforce strict size-wise uniqueness for product variants (since products do not vary by color/print/pattern)
-- 2. Expand allowed coupon type check constraint to support BOGO and Spend Discount coupon configurations

-- Failsafe: Clean up duplicate variants before creating the unique constraint (keeping the highest ID)
DELETE FROM public.product_variants a
USING public.product_variants b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.size = b.size;

-- Drop legacy unique constraints on size/color combination if exists
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_product_size_color_unique;
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_product_size_unique;

-- Add strict composite UNIQUE constraint for (product_id, size)
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_size_unique UNIQUE (product_id, size);

-- Drop old check constraint on coupons and add new expanded validation check
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_type_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_type_check CHECK (type IN ('percent', 'flat', 'bogo_quantity', 'bogo_product', 'spend_discount'));
