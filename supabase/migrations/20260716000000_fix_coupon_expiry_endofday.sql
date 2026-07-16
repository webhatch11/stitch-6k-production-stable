-- Migration: fix coupon_atomic_increment expiry check
-- Problem: expiry_date stored as midnight UTC silently rejects usage increments.
-- Fix: treat the expiry date as valid for the entire calendar day.

CREATE OR REPLACE FUNCTION public.coupon_atomic_increment(p_code TEXT)
RETURNS JSON AS $$
DECLARE
    v_coupon coupons%ROWTYPE;
BEGIN
    SELECT * INTO v_coupon FROM coupons WHERE code = UPPER(p_code) FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Coupon not found');
    END IF;

    IF NOT v_coupon.active THEN
        RETURN json_build_object('success', false, 'error', 'Coupon is inactive');
    END IF;

    -- Treat expiry_date as end of that calendar day (not midnight).
    IF v_coupon.expiry_date IS NOT NULL
       AND DATE_TRUNC('day', v_coupon.expiry_date) + INTERVAL '1 day' <= NOW() THEN
        RETURN json_build_object('success', false, 'error', 'Coupon has expired');
    END IF;

    IF v_coupon.max_usage IS NOT NULL AND COALESCE(v_coupon.usage_count, 0) >= v_coupon.max_usage THEN
        RETURN json_build_object('success', false, 'error', 'Coupon usage limit reached');
    END IF;

    UPDATE coupons SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = UPPER(p_code);

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Backfill: fix existing midnight expiry dates to end-of-day
UPDATE public.coupons
SET expiry_date = DATE_TRUNC('day', expiry_date) + INTERVAL '23 hours 59 minutes 59 seconds'
WHERE expiry_date IS NOT NULL
  AND EXTRACT(HOUR FROM expiry_date) = 0
  AND EXTRACT(MINUTE FROM expiry_date) = 0
  AND EXTRACT(SECOND FROM expiry_date) = 0;
