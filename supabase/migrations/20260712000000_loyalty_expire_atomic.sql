-- =============================================================================
-- Migration: Atomic loyalty-points expiry (per-user)
-- Date: 2026-07-12
-- Run in: Supabase SQL Editor
-- Depends on: 20260711_loyalty_expiry_and_bugfixes.sql
--             (expires_at / expired_processed columns must already exist)
--
-- Replaces the nightly sweep's non-atomic read-modify-write with a single
-- locked transaction per user. Fixes:
--   L-1  double-deduction: expired rows are CLAIMED via UPDATE ... RETURNING in
--        the same statement that sums them, so a retried/concurrent sweep sums
--        0 for already-processed rows and deducts nothing.
--   L-2  lost-update race: the profile row is locked (SELECT ... FOR UPDATE) and
--        the balance is decremented inside the same transaction, so a concurrent
--        checkout credit/debit cannot be overwritten.
--   (L-3 backlog draining is handled in the worker, which loops over users.)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.loyalty_atomic_expire_user(
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_balance     INTEGER;
    v_expired     INTEGER;
    v_deduction   INTEGER;
    v_new_balance INTEGER;
    v_tx_id       TEXT;
BEGIN
    -- Lock the profile row to serialize with concurrent credit/debit RPCs.
    SELECT loyalty_points INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Atomically claim this user's expired, unswept credit rows and sum them.
    -- Marking them expired_processed in the SAME statement makes the sweep
    -- idempotent: a retry or a second worker sees them already processed and
    -- sums 0, so no points are deducted twice.
    WITH claimed AS (
        UPDATE loyalty_transactions
        SET expired_processed = NOW()
        WHERE user_id           = p_user_id
          AND type              = 'credit'
          AND expires_at        IS NOT NULL
          AND expires_at        <= NOW()
          AND expired_processed  IS NULL
        RETURNING points
    )
    SELECT COALESCE(SUM(points), 0) INTO v_expired FROM claimed;

    IF v_expired <= 0 THEN
        RETURN json_build_object('success', true, 'deducted', 0, 'new_balance', v_balance);
    END IF;

    -- Never drive the stored balance below zero (spending already excludes
    -- expired points, so the stored balance may be lower than v_expired).
    v_deduction   := LEAST(v_expired, v_balance);
    v_new_balance := v_balance - v_deduction;

    UPDATE profiles SET loyalty_points = v_new_balance WHERE id = p_user_id;

    IF v_deduction > 0 THEN
        v_tx_id := 'LTX-EXP-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT;
        INSERT INTO loyalty_transactions (id, user_id, date, points, type, description)
        VALUES (
            v_tx_id,
            p_user_id,
            to_char(NOW(), 'DD Mon YYYY'),
            v_deduction,
            'debit',
            v_deduction || ' points expired (12-month validity)'
        );
    END IF;

    RETURN json_build_object('success', true, 'deducted', v_deduction, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql;
