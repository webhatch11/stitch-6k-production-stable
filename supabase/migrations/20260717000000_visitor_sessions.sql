-- Mutable visitor/session state belongs in its own table.
-- page_views remains an append-only event log.

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  session_id TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_page TEXT,
  cart_count INTEGER NOT NULL DEFAULT 0 CHECK (cart_count >= 0),
  cart_value NUMERIC NOT NULL DEFAULT 0 CHECK (cart_value >= 0),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT visitor_sessions_session_id_unique UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen
  ON public.visitor_sessions (last_seen);

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

-- All writes are performed by server routes using the Supabase service role.
-- No anon/authenticated INSERT or UPDATE policy is intentionally created.

-- Remove the legacy broad policy if the earlier page_views migration was run.
DROP POLICY IF EXISTS "page_views_update_public" ON public.page_views;
