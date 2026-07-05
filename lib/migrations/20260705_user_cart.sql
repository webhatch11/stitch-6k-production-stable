CREATE TABLE IF NOT EXISTS public.user_cart (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'Default',
  image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 
    CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, size, color)
);

ALTER TABLE public.user_cart 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_select_own" 
  ON public.user_cart FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cart_insert_own" 
  ON public.user_cart FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cart_update_own" 
  ON public.user_cart FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cart_delete_own" 
  ON public.user_cart FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_cart_user_id
  ON public.user_cart(user_id);
