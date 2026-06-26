-- ====================================================================
-- Day 10: Soft delete for products
-- Adds deleted_at column, partial index, and updates RLS to hide
-- soft-deleted products from anonymous and authenticated SELECT.
-- Admin reads bypass RLS via service-role client.
-- ====================================================================

-- 1. Add the deleted_at column (defaults to NULL = active)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Partial index for the common query: "list active products"
--    Indexes only rows where deleted_at IS NULL, keeping it small
CREATE INDEX IF NOT EXISTS idx_products_active
  ON public.products (created_at DESC)
  WHERE deleted_at IS NULL;

-- 3. Update the storefront RLS policy to filter out soft-deleted
--    products. Use DROP + CREATE because USING expression cannot
--    be altered in place.

DROP POLICY IF EXISTS "products_select_public" ON public.products;

CREATE POLICY "products_select_public"
  ON public.products
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

-- Admin-only policy to read all products including soft-deleted
-- (for the Trash view in admin panel). This is in addition to the
-- public policy; admin's request matches both.
CREATE POLICY "products_select_admin_all"
  ON public.products
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. Verification queries (run these after migration, not as part of it)
--    Show them as comments for the operator to run manually:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_name='products' AND column_name='deleted_at';
--
--    SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename='products' AND indexname='idx_products_active';
--
--    SELECT policyname, cmd, qual FROM pg_policies
--    WHERE tablename='products' ORDER BY policyname;
