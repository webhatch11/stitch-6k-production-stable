-- Migration: 20260716_page_views_cart
-- Upgrades page_views to a session-keyed upsert table for live visitor + cart tracking.
-- Adds: last_seen, page, user_agent, ip_address, cart_items_count, cart_value
-- Adds unique constraint on session_id to support upsert on conflict.

-- 1. Add last_seen for ping-based "active session" tracking
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 2. Add page column (replaces path for upsert row, path kept for insert-per-view flow)
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS page TEXT DEFAULT NULL;

-- 3. Add device / IP metadata for the ping upsert
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT NULL;

ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL;

-- 4. Cart tracking columns
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS cart_items_count INTEGER DEFAULT 0;

ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS cart_value NUMERIC DEFAULT 0;

-- 5. Deduplicate existing rows: keep only the newest row per session_id
--    so we can safely add the unique constraint.
DELETE FROM public.page_views
WHERE id NOT IN (
  SELECT DISTINCT ON (session_id) id
  FROM public.page_views
  ORDER BY session_id, created_at DESC
);

-- 6. Unique constraint on session_id so we can UPSERT per ping
ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_session_id_unique;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_session_id_unique UNIQUE (session_id);

-- 7. Index on last_seen for fast live queries
CREATE INDEX IF NOT EXISTS idx_page_views_last_seen
  ON public.page_views (last_seen);

-- 8. Allow anonymous UPDATEs (for upsert from anon ping endpoint)
DROP POLICY IF EXISTS "page_views_update_public" ON public.page_views;
CREATE POLICY "page_views_update_public"
  ON public.page_views
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
