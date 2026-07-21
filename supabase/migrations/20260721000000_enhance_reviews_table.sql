-- Migration: Enhance Reviews Table with Soft Deletes, Rate Limiting Fingerprint, and Optional Foreign Keys
-- Timestamp: 20260721000000_enhance_reviews_table.sql

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_approved_created ON public.reviews (approved, created_at DESC) WHERE deleted_at IS NULL;
