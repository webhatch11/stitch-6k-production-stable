-- Migration: Add non-negative constraint to product_variants stock
ALTER TABLE public.product_variants 
  ADD CONSTRAINT product_variants_stock_non_negative 
  CHECK (stock >= 0);
