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
