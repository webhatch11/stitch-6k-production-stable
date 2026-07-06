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
