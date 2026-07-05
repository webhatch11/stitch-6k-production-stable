-- Migration: Returns and Eligibility Column Expansion
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_awb TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_pickup_scheduled TIMESTAMPTZ DEFAULT NULL;
