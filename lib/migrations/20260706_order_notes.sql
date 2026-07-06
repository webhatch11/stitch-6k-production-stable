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
