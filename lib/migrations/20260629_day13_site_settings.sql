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
