-- Migration: Add returned_items column to public.orders
-- Applied via Supabase SQL Editor

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_items JSONB DEFAULT '[]';
