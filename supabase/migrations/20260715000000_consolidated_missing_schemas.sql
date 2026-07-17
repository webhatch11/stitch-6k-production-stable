-- Consolidated Schema Sync Migration --


-- -----------------------------------------------------
-- Migration: 20260625_day10_soft_delete_products.sql
-- -----------------------------------------------------

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
DROP POLICY IF EXISTS "products_select_admin_all" ON public.products;
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


-- -----------------------------------------------------
-- Migration: 20260628_day11_variants_setup.sql
-- -----------------------------------------------------

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
  DROP CONSTRAINT IF EXISTS product_variants_product_size_color_unique;
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
--    if present, else "Atelier Choice".
INSERT INTO public.product_variants (product_id, size, color, sku, price, stock)
SELECT
  p.id AS product_id,
  size_data.size AS size,
  COALESCE(p.colors[1], 'Atelier Choice') AS color,
  CONCAT(p.id, '-', size_data.size, '-', COALESCE(SUBSTRING(p.colors[1], 1, 3), 'ATL')) AS sku,
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


-- -----------------------------------------------------
-- Migration: 20260628_day12_refund_tracking.sql
-- -----------------------------------------------------

-- ============================================================
-- Day 12: Refund tracking columns on orders
-- Adds the columns needed for Razorpay refund integration.
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_status TEXT;
-- refund_status values: NULL (no refund) | "initiated" | "processed" | "failed"
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Index for refund webhook lookups (find order by refund_id)
CREATE INDEX IF NOT EXISTS idx_orders_refund_id
  ON public.orders (refund_id)
  WHERE refund_id IS NOT NULL;

-- Backfill razorpay_payment_id from payments table where possible
-- (so we have it directly on orders for the refund call without
-- a join)
UPDATE public.orders o
SET razorpay_payment_id = p.razorpay_payment_id
FROM public.payments p
WHERE p.order_id = o.id
  AND p.razorpay_payment_id IS NOT NULL
  AND o.razorpay_payment_id IS NULL;


-- -----------------------------------------------------
-- Migration: 20260629_day13_site_settings.sql
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read (storefront uses this for hero, business info)
DROP POLICY IF EXISTS "site_settings_select_public" ON public.site_settings;
CREATE POLICY "site_settings_select_public"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);

-- Only admins can mutate
DROP POLICY IF EXISTS "site_settings_insert_admin" ON public.site_settings;
CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_settings_update_admin" ON public.site_settings;
CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed defaults
INSERT INTO public.site_settings (key, value) VALUES
  ('hero', jsonb_build_object(
    'image_url', '',
    'headline', 'PREDEFINING LUXURY',
    'subheadline', 'Heritage craftsmanship meets Gen-Z streetwear.',
    'cta_text', 'Shop Collection',
    'cta_url', '/shopallshirts'
  )),
  ('business', jsonb_build_object(
    'phone', '',
    'email', '',
    'address', '',
    'gst_no', '',
    'instagram', '',
    'facebook', ''
  )),
  ('flags', jsonb_build_object(
    'cod_enabled', true,
    'returns_window_days', 7
  ))
ON CONFLICT (key) DO NOTHING;


-- -----------------------------------------------------
-- Migration: 20260629_inv_stock_floor.sql
-- -----------------------------------------------------

ALTER TABLE public.product_variants 
  DROP CONSTRAINT IF EXISTS product_variants_stock_non_negative;
ALTER TABLE public.product_variants 
  ADD CONSTRAINT product_variants_stock_non_negative 
  CHECK (stock >= 0);


-- -----------------------------------------------------
-- Migration: 20260629_lp2_landing_settings.sql
-- -----------------------------------------------------

-- Seed default values for marquee and offer_box in site_settings
INSERT INTO public.site_settings (key, value) VALUES
  ('marquee', jsonb_build_object(
    'enabled', true,
    'items', jsonb_build_array(
      'FREE DELIVERY ACROSS INDIA',
      'USE CODE FESTIVE24 FOR 10% OFF',
      '100% PREMIUM COTTON & LINEN',
      'EASY 7-DAY RETURNS'
    )
  )),
  ('offer_box', jsonb_build_object(
    'enabled', true,
    'label', 'Limited Time Offer',
    'heading', 'S E A S O N',
    'body', 'Elevate your wardrobe with the atelier linen collection. Get 10% off with promo code.',
    'coupon_code', 'FESTIVE24',
    'cta_text', 'Shop The Collection',
    'cta_url', '/shopallshirts',
    'bg_image_url', ''
  ))
ON CONFLICT (key) DO NOTHING;

-- Add display_sections column to products table if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_sections JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_products_display_sections ON public.products USING gin (display_sections);


-- -----------------------------------------------------
-- Migration: 20260629_lp3_landing_extras.sql
-- -----------------------------------------------------

INSERT INTO public.site_settings (key, value) VALUES
  ('trust_badges', jsonb_build_object(
    'enabled', true,
    'items', jsonb_build_array(
      jsonb_build_object('icon', 'flag', 'title', 'Made in India', 'description', 'Crafted in Tamil Nadu'),
      jsonb_build_object('icon', 'shield', 'title', 'Premium Fabric', 'description', '100% cotton & linen'),
      jsonb_build_object('icon', 'truck', 'title', 'Fast Delivery', 'description', 'Pan-India shipping')
    )
  )),
  ('hero_slides', jsonb_build_object(
    'enabled', false,
    'items', '[]'::jsonb
  )),
  ('categories', jsonb_build_object(
    'enabled', true,
    'items', '[]'::jsonb
  )),
  ('reviews', jsonb_build_object(
    'enabled', true,
    'items', '[]'::jsonb,
    'moderation_required', true
  ))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- -----------------------------------------------------
-- Migration: 20260629_lp3_reviews_table.sql
-- -----------------------------------------------------

ALTER TABLE public.reviews 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_admin_only"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());



-- -----------------------------------------------------
-- Migration: 20260704_perf_indexes.sql
-- -----------------------------------------------------

-- Performance indexes for hot query paths (2026-07-04 audit).
-- Apply via Supabase SQL editor or CLI. All statements are idempotent.

-- Payment verification looks orders up by razorpay_order_id on every capture.
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON public.orders (razorpay_order_id);

-- Customer order history + ownership checks filter by user_id.
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);

-- Shiprocket webhook + tracking sync look orders up by AWB.
CREATE INDEX IF NOT EXISTS idx_orders_shiprocket_id
  ON public.orders (shiprocket_id);

-- Order listings sort by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- Order sub-resources fetched per order id.
CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON public.order_events (order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id);


-- -----------------------------------------------------
-- Migration: 20260705_bogo_coupons.sql
-- -----------------------------------------------------

-- Add BOGO fields to coupons table
ALTER TABLE public.coupons 
  ADD COLUMN IF NOT EXISTS buy_quantity INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_quantity INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_discount_percent INTEGER DEFAULT NULL 
    CHECK (get_discount_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS buy_product_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_product_id TEXT DEFAULT NULL;

-- Update type check to include new types
ALTER TABLE public.coupons 
  DROP CONSTRAINT IF EXISTS coupons_type_check;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_type_check 
  CHECK (type IN (
    'percent',        -- X% off entire order
    'flat',           -- ₹X off entire order  
    'bogo_quantity',  -- Buy X qty get Y qty free
    'bogo_product',   -- Buy product X get Y at Z% off
    'spend_discount'  -- Spend ₹X get Y% off
  ));


-- -----------------------------------------------------
-- Migration: 20260705_user_cart.sql
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_cart (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'Default',
  image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 
    CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, size, color)
);

ALTER TABLE public.user_cart 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_select_own" 
  ON public.user_cart FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cart_insert_own" 
  ON public.user_cart FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cart_update_own" 
  ON public.user_cart FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cart_delete_own" 
  ON public.user_cart FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_cart_user_id
  ON public.user_cart(user_id);


-- -----------------------------------------------------
-- Migration: 20260706_ad_spend.sql
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ad_spend (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL 
    CHECK (channel IN (
      'google_ads', 'meta_ads', 
      'instagram', 'other'
    )),
  month DATE NOT NULL,
  spend_amount NUMERIC NOT NULL 
    CHECK (spend_amount >= 0),
  campaign_name TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, month, campaign_name)
);

ALTER TABLE public.ad_spend 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_spend_admin_only"
  ON public.ad_spend FOR ALL 
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- -----------------------------------------------------
-- Migration: 20260706_analytics_suite.sql
-- -----------------------------------------------------

-- Create page views table
CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on page_views
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated inserts
CREATE POLICY "page_views_insert_public"
  ON public.page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow authenticated admin reads
CREATE POLICY "page_views_select_admin"
  ON public.page_views
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Create index on created_at for fast live queries
CREATE INDEX IF NOT EXISTS 
  idx_page_views_created_at
  ON public.page_views(created_at);

-- Alter orders table to add UTM tracking columns if they do not exist
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS utm_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT DEFAULT NULL;


-- -----------------------------------------------------
-- Migration: 20260706_order_notes.sql
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL 
    REFERENCES public.orders(id) 
    ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_notes 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_notes_admin_only"
  ON public.order_notes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS 
  idx_order_notes_order_id
  ON public.order_notes(order_id);


-- -----------------------------------------------------
-- Migration: 20260706_product_seo_fields.sql
-- -----------------------------------------------------

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


-- -----------------------------------------------------
-- Migration: 20260706_returns_and_eligibility.sql
-- -----------------------------------------------------

-- Migration: Returns and Eligibility Column Expansion
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_awb TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_pickup_scheduled TIMESTAMPTZ DEFAULT NULL;


-- -----------------------------------------------------
-- Migration: 20260707_shipping_rules.sql
-- -----------------------------------------------------

-- Add shipping_amount to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC DEFAULT 0;


-- -----------------------------------------------------
-- Migration: 20260707_seed_shipping_rules.sql
-- -----------------------------------------------------

INSERT INTO public.site_settings 
  (key, value)
VALUES (
  'shipping_rules',
  '{
    "mode": "free_above",
    "flat_rate": 99,
    "free_above_amount": 999,
    "always_free": false,
    "always_paid": false,
    "free_above_enabled": true,
    "display_message": "Free shipping on orders above ₹999"
  }'::jsonb
)
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;


-- -----------------------------------------------------
-- Migration: 20260712_product_soft_delete_audit.sql
-- -----------------------------------------------------

-- Migration: Product Soft Delete, Deletion Scheduling & Audit Logging
-- Applies metadata columns to product table and creates the permanent audit logs table.

-- 1. Add scheduled deletion timestamp to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS scheduled_permanent_deletion_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create product audit logs table (kept forever, does not cascade-delete)
CREATE TABLE IF NOT EXISTS public.product_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL CHECK (action IN ('soft_delete', 'restore', 'permanent_delete')),
    product_id TEXT NOT NULL,
    product_title TEXT NOT NULL,
    admin_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_user_email TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance auditing
CREATE INDEX IF NOT EXISTS idx_product_audit_logs_product ON public.product_audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_logs_created ON public.product_audit_logs(created_at DESC);


-- -----------------------------------------------------
-- Migration: 20260713_order_id_sequence.sql
-- -----------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.order_id_seq START 1;

CREATE OR REPLACE FUNCTION public.get_next_order_sequence()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT nextval('public.order_id_seq')::INTEGER;
$$;

SELECT setval('public.order_id_seq', 
  COALESCE(
    (SELECT MAX(
      CAST(regexp_replace(id, '^6K-(RPO|WPO)-0*', '') AS INTEGER)
    ) FROM public.orders 
    WHERE id ~ '^6K-(RPO|WPO)-\d+$'),
    1
  ),
  EXISTS(
    SELECT 1 FROM public.orders 
    WHERE id ~ '^6K-(RPO|WPO)-\d+$'
  )
);


-- -----------------------------------------------------
-- Migration: 20260714_coupon_atomic_decrement.sql
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.coupon_atomic_decrement(p_code TEXT)
RETURNS JSON AS $$
DECLARE
    v_coupon coupons%ROWTYPE;
BEGIN
    SELECT * INTO v_coupon 
    FROM coupons 
    WHERE code = UPPER(p_code) 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
          'success', false, 
          'error', 'Coupon not found'
        );
    END IF;

    IF COALESCE(v_coupon.usage_count, 0) <= 0 THEN
        RETURN json_build_object(
          'success', true,
          'note', 'Usage count already at zero'
        );
    END IF;

    UPDATE coupons 
    SET usage_count = GREATEST(0, COALESCE(usage_count, 0) - 1)
    WHERE code = UPPER(p_code);
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------
-- Migration: 20260714_fix_wallet_default.sql
-- -----------------------------------------------------

-- Fix default wallet balance from 2500 to 0
-- New users should start with 0 wallet balance
-- Welcome bonus (if any) should be credited 
-- explicitly after registration, not as a default
ALTER TABLE public.profiles 
ALTER COLUMN wallet_balance 
SET DEFAULT 0;


-- -----------------------------------------------------
-- Migration: 20260714_points_credit_status.sql
-- -----------------------------------------------------

-- pending: points earned but not yet credited
-- credited: points credited to user balance
-- cancelled: order cancelled, points voided
-- expired: return window passed with return, points voided

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS points_credit_status TEXT DEFAULT 'pending'
CHECK (points_credit_status IN ('pending', 'credited', 'cancelled', 'expired'));

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS points_credit_scheduled_at TIMESTAMPTZ DEFAULT NULL;


-- -----------------------------------------------------
-- Migration: 20260714_product_reorder_point.sql
-- -----------------------------------------------------

-- Migration: 20260714_product_reorder_point
-- Adds per-product reorder threshold.
-- Run in Supabase SQL Editor before deploy.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.products.reorder_point IS
  'Optional per-product low-stock threshold. When set, overrides the global LOW_STOCK_THRESHOLD for this product.';


-- -----------------------------------------------------
-- Migration: 20260714_shipment_label_manifest.sql
-- -----------------------------------------------------

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS label_url TEXT DEFAULT NULL;

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS manifest_url TEXT DEFAULT NULL;


-- -----------------------------------------------------
-- Migration: rename_atelier_choice_color.sql
-- -----------------------------------------------------

-- Update existing product_variants rows
UPDATE public.product_variants 
SET color = 'Default' 
WHERE color = 'Atelier Choice';

-- Update existing products colors array if needed
UPDATE public.products
SET colors = array_replace(colors, 'Atelier Choice', 'Default')
WHERE 'Atelier Choice' = ANY(colors);

