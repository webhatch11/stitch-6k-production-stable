-- Add shipping_amount to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC DEFAULT 0;
