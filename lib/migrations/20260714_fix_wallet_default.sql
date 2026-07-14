-- Fix default wallet balance from 2500 to 0
-- New users should start with 0 wallet balance
-- Welcome bonus (if any) should be credited 
-- explicitly after registration, not as a default
ALTER TABLE public.profiles 
ALTER COLUMN wallet_balance 
SET DEFAULT 0;
