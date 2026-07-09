-- Migration: Add wallet_balance hard ceiling limit to profiles table (2026-07-09 Audit)
-- Apply via Supabase CLI or SQL Editor. All statements are idempotent.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_wallet_balance;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_wallet_balance CHECK (
    wallet_balance >= 0 AND wallet_balance <= 100000
);
