CREATE OR REPLACE FUNCTION 
public.atomic_checkout_rollback(
  p_order_id TEXT,
  p_user_id UUID,
  p_wallet_amount NUMERIC,
  p_coupon_code TEXT
)
RETURNS JSON AS $$
BEGIN
  -- Restore wallet if debited
  IF p_wallet_amount > 0 THEN
    UPDATE profiles 
    SET wallet_balance = wallet_balance + p_wallet_amount
    WHERE id = p_user_id;
  END IF;
  
  -- Decrement coupon if used
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    UPDATE coupons
    SET usage_count = GREATEST(0, usage_count - 1)
    WHERE code = UPPER(p_coupon_code);
  END IF;
  
  -- Cancel the order
  UPDATE orders
  SET status = 'Failed',
      payment_status = 'FAILED'
  WHERE id = p_order_id;
  
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;
