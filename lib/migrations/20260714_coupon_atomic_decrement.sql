CREATE OR REPLACE FUNCTION public.coupon_atomic_decrement(p_code TEXT)
RETURNS JSON AS $$
DECLARE
    v_coupon coupons%ROWTYPE;
BEGIN
    SELECT * INTO v_coupon 
    FROM coupons 
    WHERE code = UPPER(p_code) 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
          'success', false, 
          'error', 'Coupon not found'
        );
    END IF;

    IF COALESCE(v_coupon.usage_count, 0) <= 0 THEN
        RETURN json_build_object(
          'success', true,
          'note', 'Usage count already at zero'
        );
    END IF;

    UPDATE coupons 
    SET usage_count = GREATEST(0, COALESCE(usage_count, 0) - 1)
    WHERE code = UPPER(p_code);
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
