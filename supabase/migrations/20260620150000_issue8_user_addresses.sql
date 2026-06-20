-- user_addresses table — referenced in code (lib/db.ts) but missing
-- from schema until now. Adding here so issue #8 tests can run.
-- Pattern: USER-OWNED (matches the issue #4 RLS approach).

CREATE TABLE IF NOT EXISTS public.user_addresses (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  phone          TEXT DEFAULT '',
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT DEFAULT '',
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  postal_code    TEXT NOT NULL,
  country        TEXT DEFAULT 'India',
  is_default     BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
  ON public.user_addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_default
  ON public.user_addresses (user_id) WHERE is_default = true;

-- RLS — USER-OWNED pattern (matches issue #4 migration)
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_addresses_select_own" ON public.user_addresses;
CREATE POLICY "user_addresses_select_own"
  ON public.user_addresses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_addresses_insert_own" ON public.user_addresses;
CREATE POLICY "user_addresses_insert_own"
  ON public.user_addresses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_addresses_update_own" ON public.user_addresses;
CREATE POLICY "user_addresses_update_own"
  ON public.user_addresses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_addresses_delete_own" ON public.user_addresses;
CREATE POLICY "user_addresses_delete_own"
  ON public.user_addresses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
