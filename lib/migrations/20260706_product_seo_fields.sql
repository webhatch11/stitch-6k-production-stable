-- Compare-at price (original price for strike-through display)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC DEFAULT NULL;

-- Product weight in grams (for Shiprocket)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER DEFAULT NULL;

-- Product status (draft/active/archived)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_status TEXT DEFAULT 'active'
  CHECK (product_status IN ('active', 'draft', 'archived'));

-- SEO fields per product
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT DEFAULT NULL;
