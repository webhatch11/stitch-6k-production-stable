-- ============================================================
-- Day 11: Variants schema lockdown + backfill
-- ============================================================

-- 1. Clean up orphan test variant rows (product_ids that don't exist in products)
DELETE FROM public.product_variants
WHERE product_id NOT IN (SELECT id FROM public.products);

-- 2. Make product_id NOT NULL (after orphan cleanup)
ALTER TABLE public.product_variants
  ALTER COLUMN product_id SET NOT NULL;

-- 3. FK already exists (product_variants_product_id_fkey) — skip

-- 4. Add UNIQUE constraint (product_id, size, color) — not yet present
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_size_color_unique
  UNIQUE (product_id, size, color);

-- 5. Add index on product_id for fast variant lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON public.product_variants (product_id);

-- 6. Enable RLS on product_variants (idempotent)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies
DROP POLICY IF EXISTS "variants_select_public" ON public.product_variants;
CREATE POLICY "variants_select_public"
  ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
      AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "variants_insert_admin" ON public.product_variants;
CREATE POLICY "variants_insert_admin"
  ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "variants_update_admin" ON public.product_variants;
CREATE POLICY "variants_update_admin"
  ON public.product_variants
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "variants_delete_admin" ON public.product_variants;
CREATE POLICY "variants_delete_admin"
  ON public.product_variants
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 8. Backfill — for every product without variants, generate variants from
--    legacy size_stock_* columns. Color = first entry of product.colors[]
--    if present, else "Default".
INSERT INTO public.product_variants (product_id, size, color, sku, price, stock)
SELECT
  p.id AS product_id,
  size_data.size AS size,
  COALESCE(p.colors[1], 'Default') AS color,
  CONCAT(p.id, '-', size_data.size, '-', COALESCE(p.colors[1], 'DEF')) AS sku,
  p.base_price AS price,
  size_data.stock AS stock
FROM public.products p
CROSS JOIN LATERAL (
  VALUES
    ('S',   p.size_stock_s),
    ('M',   p.size_stock_m),
    ('L',   p.size_stock_l),
    ('XL',  p.size_stock_xl),
    ('XXL', p.size_stock_xxl)
) AS size_data(size, stock)
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id
  )
ON CONFLICT (product_id, size, color) DO NOTHING;

-- 9. Verification queries (run separately):
--    SELECT COUNT(*) FROM product_variants;
--    SELECT p.id, p.title, COUNT(v.*) AS variant_count
--    FROM products p LEFT JOIN product_variants v ON v.product_id = p.id
--    WHERE p.deleted_at IS NULL GROUP BY p.id, p.title ORDER BY variant_count;
--    SELECT * FROM product_variants ORDER BY created_at DESC LIMIT 10;
