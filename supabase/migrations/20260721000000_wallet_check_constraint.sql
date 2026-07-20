-- SQL Migration: Add database integrity constraints for wallet balances and razorpay order uniqueness

-- 1. Ensure wallet balance cannot drop below zero at database DDL level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_wallet_balance_non_negative'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT check_wallet_balance_non_negative CHECK (wallet_balance >= 0);
  END IF;
END $$;

-- 2. Add partial unique index on orders.razorpay_order_id to prevent duplicate payment order IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_order_id_unique 
ON public.orders(razorpay_order_id) 
WHERE razorpay_order_id IS NOT NULL AND razorpay_order_id <> '';
