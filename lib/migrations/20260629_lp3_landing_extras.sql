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
