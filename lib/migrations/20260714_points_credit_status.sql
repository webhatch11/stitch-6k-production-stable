-- pending: points earned but not yet credited
-- credited: points credited to user balance
-- cancelled: order cancelled, points voided
-- expired: return window passed with return, points voided

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS points_credit_status TEXT DEFAULT 'pending'
CHECK (points_credit_status IN ('pending', 'credited', 'cancelled', 'expired'));

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS points_credit_scheduled_at TIMESTAMPTZ DEFAULT NULL;
