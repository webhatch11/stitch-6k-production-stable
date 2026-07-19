-- Migration: Refactor Payment Architecture Transaction
-- Date: 2026-07-20

-- 1. Create Transactional Outbox Table
CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    deduplication_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
    attempts INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status 
ON public.outbox_events(status) 
WHERE status = 'PENDING';

-- 2. Create Thread-Safe Outbox Claim RPC (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_pending_outbox_events(p_limit INTEGER)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  payload JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH selected AS (
    SELECT oe.id
    FROM outbox_events oe
    WHERE oe.status = 'PENDING'
    ORDER BY oe.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox_events oe
  SET status = 'PROCESSING'
  FROM selected
  WHERE oe.id = selected.id
  RETURNING oe.id, oe.event_type, oe.payload;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Transactional Confirmation RPC
CREATE OR REPLACE FUNCTION public.confirm_order_and_process_payments_atomic(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_wallet_deduction NUMERIC,
  p_points_redeemed INTEGER,
  p_coupon_code TEXT,
  p_earned_points INTEGER,
  p_method TEXT
)
RETURNS JSON AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_balance NUMERIC;
  v_loyalty_balance INTEGER;
  v_payment_row payments%ROWTYPE;
  v_item JSONB;
  v_variant_id UUID;
  v_stock_qty INTEGER;
  v_coupon_record coupons%ROWTYPE;
  v_payment_id_uuid UUID;
  v_wallet_key TEXT;
  v_loyalty_key TEXT;
  v_dedup_key TEXT;
BEGIN
  -- 1. Lock order row
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- 2. Idempotency Check: If already processed, return success
  IF v_order.status = 'Paid' OR v_order.status = 'Paid via Wallet' THEN
    RETURN json_build_object('success', true, 'message', 'Order already processed', 'status', v_order.status);
  END IF;

  -- 3. Loop and deduct inventory stock
  FOR v_item IN SELECT jsonb_array_elements(v_order.cart_items) LOOP
    SELECT id, stock INTO v_variant_id, v_stock_qty FROM product_variants 
    WHERE product_id = (v_item->>'productId') 
      AND size = (v_item->>'size') 
      AND color = (v_item->>'color')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variant not found for product: %, size: %', v_item->>'productId', v_item->>'size';
    END IF;

    IF v_stock_qty < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Insufficient stock for product: %, size: %', v_item->>'productId', v_item->>'size';
    END IF;

    UPDATE product_variants SET stock = stock - (v_item->>'quantity')::INTEGER WHERE id = v_variant_id;

    INSERT INTO inventory_audit_logs (variant_id, quantity_changed, type, reason)
    VALUES (v_variant_id, -(v_item->>'quantity')::INTEGER, 'deduction', 'Order confirmation deduction (' || p_order_id || ')');
  END LOOP;

  -- Update reservation status to fulfilled
  UPDATE inventory_reservations SET status = 'fulfilled' WHERE session_id = v_order.idempotency_key;

  -- 4. Consume Coupon
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT * INTO v_coupon_record FROM coupons WHERE code = UPPER(p_coupon_code) FOR UPDATE;
    IF FOUND THEN
      IF v_coupon_record.max_usage IS NOT NULL AND v_coupon_record.usage_count >= v_coupon_record.max_usage THEN
        RAISE EXCEPTION 'Coupon usage limit exceeded';
      END IF;
      UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon_record.id;
    END IF;
  END IF;

  -- 5. Deduct Wallet Balance (using stable deterministic keys)
  IF p_wallet_deduction > 0 THEN
    v_wallet_key := 'wallet-order-' || p_order_id;
    IF NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = v_wallet_key) THEN
      SELECT wallet_balance INTO v_balance FROM profiles WHERE id = v_order.user_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found for wallet debit';
      END IF;
      IF v_balance < p_wallet_deduction THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
      END IF;
      UPDATE profiles SET wallet_balance = wallet_balance - p_wallet_deduction WHERE id = v_order.user_id;

      INSERT INTO wallet_transactions (id, user_id, date, amount, type, description, idempotency_key)
      VALUES (
        'WTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT,
        v_order.user_id,
        to_char(NOW(), 'DD Mon YYYY'),
        p_wallet_deduction,
        'debit',
        'Wallet payment for order #' || p_order_id,
        v_wallet_key
      );
    END IF;
  END IF;

  -- 6. Deduct Loyalty Points (using stable deterministic keys)
  IF p_points_redeemed > 0 THEN
    v_loyalty_key := 'loyalty-order-' || p_order_id;
    IF NOT EXISTS (SELECT 1 FROM loyalty_transactions WHERE idempotency_key = v_loyalty_key) THEN
      SELECT loyalty_points INTO v_loyalty_balance FROM profiles WHERE id = v_order.user_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found for loyalty debit';
      END IF;
      IF v_loyalty_balance < p_points_redeemed THEN
        RAISE EXCEPTION 'Insufficient loyalty points';
      END IF;
      UPDATE profiles SET loyalty_points = loyalty_points - p_points_redeemed WHERE id = v_order.user_id;

      INSERT INTO loyalty_transactions (id, user_id, date, points, type, description, idempotency_key)
      VALUES (
        'LTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT,
        v_order.user_id,
        to_char(NOW(), 'DD Mon YYYY'),
        p_points_redeemed,
        'debit',
        'Points redeemed for order #' || p_order_id,
        v_loyalty_key
      );
    END IF;
  END IF;

  -- 7. Update payments record
  IF p_method = 'razorpay' THEN
    SELECT * INTO v_payment_row FROM payments WHERE order_id = p_order_id;
    IF FOUND THEN
      UPDATE payments SET status = 'CAPTURED', razorpay_payment_id = p_payment_id WHERE id = v_payment_row.id;
      v_payment_id_uuid := v_payment_row.id;
    ELSE
      INSERT INTO payments (order_id, razorpay_payment_id, razorpay_order_id, amount, status, method)
      VALUES (p_order_id, p_payment_id, v_order.razorpay_order_id, v_order.total, 'CAPTURED', 'razorpay')
      RETURNING id INTO v_payment_id_uuid;
    END IF;

    INSERT INTO payment_logs (payment_id, previous_status, new_status, metadata)
    VALUES (v_payment_id_uuid, COALESCE(v_payment_row.status, 'CREATED'), 'CAPTURED', json_build_object('source', 'atomic_transaction', 'razorpay_payment_id', p_payment_id));
  END IF;

  -- 8. Mark order as PAID
  UPDATE orders 
  SET 
    status = CASE WHEN p_method = 'wallet' THEN 'Paid via Wallet' ELSE 'Paid' END,
    payment_status = 'Paid',
    razorpay_payment_id = CASE WHEN p_method = 'razorpay' THEN p_payment_id ELSE razorpay_payment_id END,
    points_earned = p_earned_points,
    points_credit_status = 'pending',
    points_credit_scheduled_at = (NOW() + interval '7 days')
  WHERE id = p_order_id;

  -- 9. Create Timeline Events and History logs
  INSERT INTO order_events (order_id, event, created_at)
  VALUES (p_order_id, 'Payment Successful', NOW()), (p_order_id, 'Order Placed', NOW());

  INSERT INTO order_status_history (order_id, status, metadata, updated_by, trigger_source, reason)
  VALUES (p_order_id, CASE WHEN p_method = 'wallet' THEN 'Paid via Wallet' ELSE 'Paid' END, json_build_object('status_changed_to', 'Paid'), 'system', 'System Verification', 'Payment confirmed via atomic transaction');

  INSERT INTO payment_audit_logs (order_id, previous_status, new_status, source)
  VALUES (p_order_id, 'Payment Pending', 'Paid', 'verification');

  -- 10. Write Transactional Outbox event with unique deduplication key
  v_dedup_key := 'payment_' || p_order_id || '_' || p_payment_id;
  INSERT INTO outbox_events (event_type, payload, deduplication_key)
  VALUES ('process_payment_side_effects', json_build_object('order_id', p_order_id, 'razorpay_payment_id', p_payment_id), v_dedup_key)
  ON CONFLICT (deduplication_key) DO NOTHING;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
