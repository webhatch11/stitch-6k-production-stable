-- Migration: Add approved_by column to reviews table (2026-07-09 Audit)
-- Apply via Supabase CLI or SQL Editor. All statements are idempotent.

ALTER TABLE public.reviews 
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
