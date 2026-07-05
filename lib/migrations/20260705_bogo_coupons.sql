-- Add BOGO fields to coupons table
ALTER TABLE public.coupons 
  ADD COLUMN IF NOT EXISTS buy_quantity INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_quantity INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_discount_percent INTEGER DEFAULT NULL 
    CHECK (get_discount_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS buy_product_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_product_id TEXT DEFAULT NULL;

-- Update type check to include new types
ALTER TABLE public.coupons 
  DROP CONSTRAINT IF EXISTS coupons_type_check;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_type_check 
  CHECK (type IN (
    'percent',        -- X% off entire order
    'flat',           -- ₹X off entire order  
    'bogo_quantity',  -- Buy X qty get Y qty free
    'bogo_product',   -- Buy product X get Y at Z% off
    'spend_discount'  -- Spend ₹X get Y% off
  ));
