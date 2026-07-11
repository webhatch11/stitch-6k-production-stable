-- =============================================================================
-- Migration: Loyalty Points Expiry System + Bug Fixes
-- Date: 2026-07-11
-- Run in: Supabase SQL Editor / CLI
-- Description:
--   1. Add expires_at + expired_processed columns to loyalty_transactions
--   2. Replace loyalty_atomic_credit -- add expires_at param, 500k ceiling cap
--   3. Replace loyalty_atomic_debit  -- subtract expired-but-unswept balance
--   4. Remove welcome bonus (new users start at 0 points)
--   5. Add loyalty_points ceiling constraint (max 500,000)
--   6. Add performance indexes for expiry queries
-- =============================================================================

-- 1A. Add expires_at column (tracks when each credit batch expires)
ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 1B. Add expired_processed column (set by the nightly expiry sweep job)
ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS expired_processed TIMESTAMPTZ;

-- 1C. Backfill expires_at for all existing credit rows (12 months from earned date)
UPDATE public.loyalty_transactions
SET expires_at = created_at + INTERVAL '12 months'
WHERE type = 'credit'
  AND expires_at IS NULL;
-- Debit rows remain NULL (they don't expire, they are spent amounts)

-- =============================================================================
-- 2. Replace loyalty_atomic_credit — adds expires_at param + 500k ceiling
-- =============================================================================
CREATE OR REPLACE FUNCTION public.loyalty_atomic_credit(
  p_user_id         UUID,
  p_points          INTEGER,
  p_idempotency_key TEXT,
  p_desc            TEXT,
  p_expires_at      TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_balance     INTEGER;
    v_new_balance INTEGER;
    v_tx_id       TEXT;
    v_expiry      TIMESTAMPTZ;
BEGIN
    -- Idempotency guard
    IF p_idempotency_key IS NOT NULL AND EXISTS (
      SELECT 1 FROM loyalty_transactions WHERE idempotency_key = p_idempotency_key
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate transaction');
    END IF;

    SELECT loyalty_points INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    v_new_balance := v_balance + p_points;

    -- Hard ceiling: loyalty points cannot exceed 500,000
    IF v_new_balance > 500000 THEN
        v_new_balance := 500000;
    END IF;

    UPDATE profiles SET loyalty_points = v_new_balance WHERE id = p_user_id;

    v_tx_id  := 'LTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT;
    -- Default expiry = 12 months from now if caller does not supply one
    v_expiry := COALESCE(p_expires_at, NOW() + INTERVAL '12 months');

    INSERT INTO loyalty_transactions (id, user_id, date, points, type, description, idempotency_key, expires_at)
    VALUES (
        v_tx_id,
        p_user_id,
        to_char(NOW(), 'DD Mon YYYY'),
        p_points,
        'credit',
        p_desc,
        p_idempotency_key,
        v_expiry
    );

    RETURN json_build_object(
      'success', true,
      'new_balance', v_new_balance,
      'expires_at', v_expiry
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. Replace loyalty_atomic_debit — checks effective (non-expired) balance
-- =============================================================================
CREATE OR REPLACE FUNCTION public.loyalty_atomic_debit(
  p_user_id         UUID,
  p_points          INTEGER,
  p_idempotency_key TEXT,
  p_desc            TEXT
)
RETURNS JSON AS $$
DECLARE
    v_stored_balance    INTEGER;
    v_expired_unswept   INTEGER;
    v_effective_balance INTEGER;
    v_new_balance       INTEGER;
    v_tx_id             TEXT;
BEGIN
    -- Idempotency guard
    IF EXISTS (SELECT 1 FROM loyalty_transactions WHERE idempotency_key = p_idempotency_key) THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate transaction');
    END IF;

    SELECT loyalty_points INTO v_stored_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Sum of expired credit transactions that haven't been swept yet by the nightly job
    SELECT COALESCE(SUM(points), 0) INTO v_expired_unswept
    FROM loyalty_transactions
    WHERE user_id          = p_user_id
      AND type             = 'credit'
      AND expires_at       IS NOT NULL
      AND expires_at       <= NOW()
      AND expired_processed IS NULL;

    -- Effective spendable balance = stored balance minus unswept expired points
    v_effective_balance := GREATEST(0, v_stored_balance - v_expired_unswept);

    IF v_effective_balance < p_points THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient valid loyalty points');
    END IF;

    v_new_balance := v_stored_balance - p_points;
    UPDATE profiles SET loyalty_points = v_new_balance WHERE id = p_user_id;

    v_tx_id := 'LTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT;
    INSERT INTO loyalty_transactions (id, user_id, date, points, type, description, idempotency_key)
    VALUES (
        v_tx_id,
        p_user_id,
        to_char(NOW(), 'DD Mon YYYY'),
        p_points,
        'debit',
        p_desc,
        p_idempotency_key
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. Remove welcome points — new users start at 0 loyalty points
--    (Admin gifting module coming with CRM in 3 months)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, role, wallet_balance, loyalty_points)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New Customer'),
    new.email,
    new.phone,
    'customer',
    2500,  -- welcome wallet credit retained
    0      -- NO welcome loyalty points (coming with CRM module)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update schema column default
ALTER TABLE public.profiles ALTER COLUMN loyalty_points SET DEFAULT 0;

-- =============================================================================
-- 5. Loyalty points hard ceiling constraint (max 500,000)
-- =============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_loyalty_points;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_loyalty_points
  CHECK (loyalty_points >= 0 AND loyalty_points <= 500000);

-- =============================================================================
-- 6. Performance indexes for expiry sweep queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_expiry
  ON public.loyalty_transactions (user_id, expires_at)
  WHERE type = 'credit' AND expired_processed IS NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type_expiry
  ON public.loyalty_transactions (expires_at)
  WHERE type = 'credit' AND expired_processed IS NULL AND expires_at IS NOT NULL;
