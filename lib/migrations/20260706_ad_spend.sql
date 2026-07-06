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
