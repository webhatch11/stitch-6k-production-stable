-- Migration: 20260714_product_reorder_point
-- Adds per-product reorder threshold.
-- Run in Supabase SQL Editor before deploy.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.products.reorder_point IS
  'Optional per-product low-stock threshold. When set, overrides the global LOW_STOCK_THRESHOLD for this product.';
