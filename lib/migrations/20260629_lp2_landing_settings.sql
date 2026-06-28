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
