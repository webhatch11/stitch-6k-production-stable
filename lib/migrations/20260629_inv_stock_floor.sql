ALTER TABLE public.product_variants 
  DROP CONSTRAINT IF EXISTS product_variants_stock_non_negative;
ALTER TABLE public.product_variants 
  ADD CONSTRAINT product_variants_stock_non_negative 
  CHECK (stock >= 0);
