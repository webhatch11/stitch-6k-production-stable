-- SQL Migration: Financial Integrity Remediation
-- Date: 2026-07-21 (Targeting 2026-07-22 version sequence)

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add Unique Constraints on Idempotency Keys to prevent double-processing at the DB layer
-- Ensure p_idempotency_key is unique in wallet_transactions and loyalty_transactions
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS uq_wallet_transactions_idempotency_key;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT uq_wallet_transactions_idempotency_key UNIQUE (idempotency_key);

ALTER TABLE public.loyalty_transactions DROP CONSTRAINT IF EXISTS uq_loyalty_transactions_idempotency_key;
ALTER TABLE public.loyalty_transactions ADD CONSTRAINT uq_loyalty_transactions_idempotency_key UNIQUE (idempotency_key);

-- 2. Add Database-Level CHECK Constraints for non-negative values
-- Ensure no negative amounts can be entered into ledgers
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_non_negative_amounts;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_non_negative_amounts CHECK (
    total >= 0 AND 
    wallet_paid >= 0 AND 
    gateway_paid >= 0 AND
    refund_amount >= 0
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_template_version INTEGER DEFAULT 1;


ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS chk_wallet_transactions_non_negative;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT chk_wallet_transactions_non_negative CHECK (
    amount >= 0 AND
    type IN ('credit', 'debit')
);

ALTER TABLE public.loyalty_transactions DROP CONSTRAINT IF EXISTS chk_loyalty_transactions_non_negative;
ALTER TABLE public.loyalty_transactions ADD CONSTRAINT chk_loyalty_transactions_non_negative CHECK (
    points >= 0 AND
    type IN ('credit', 'debit')
);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_non_negative_amount;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_non_negative_amount CHECK (
    amount >= 0
);

-- 3. Create Append-Only Financial Ledger Table with Tracing Metadata
CREATE TABLE IF NOT EXISTS public.financial_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'order_created', 'payment_captured', 'wallet_debit', 'wallet_credit', 
        'refund_issued', 'loyalty_earned', 'loyalty_reversed', 'shipping_charged', 'credit_note_issued'
    )),
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    source_entity_type TEXT NOT NULL, -- e.g., 'payment', 'refund', 'credit_note', 'wallet_transaction', 'loyalty_transaction'
    source_entity_id UUID,            -- UUID of the referenced record (nullable for orders using text primary key)
    source_entity_text_id TEXT,       -- Fallback text-based ID for text primary keys (e.g. order_id, payment_id)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast reporting and auditing
CREATE INDEX IF NOT EXISTS idx_financial_ledger_order_id ON public.financial_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_event_type ON public.financial_ledger(event_type);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_source ON public.financial_ledger(source_entity_type, source_entity_id);

-- 4. Create Statutory GST Credit Note and Credit Note Item Tables
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number TEXT UNIQUE NOT NULL,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    return_request_id UUID REFERENCES public.return_requests(id) ON DELETE SET NULL,
    original_invoice_id TEXT NOT NULL,
    original_invoice_date DATE NOT NULL,
    taxable_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (taxable_amount >= 0),
    cgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
    sgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
    igst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
    refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (refund_amount >= 0),
    reason_code TEXT,
    issued_by TEXT NOT NULL DEFAULT 'system',
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id),
    order_line_id TEXT NOT NULL, -- UUID or text identifier for the original item line snapshot
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    gst_rate NUMERIC(5,2) NOT NULL CHECK (gst_rate >= 0),
    taxable_value NUMERIC(10,2) NOT NULL CHECK (taxable_value >= 0),
    cgst NUMERIC(10,2) NOT NULL CHECK (cgst >= 0),
    sgst NUMERIC(10,2) NOT NULL CHECK (sgst >= 0),
    igst NUMERIC(10,2) NOT NULL CHECK (igst >= 0),
    hsn TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Enforce uniqueness to prevent duplicate credits on the same returned line item
    CONSTRAINT uq_credit_note_items_line UNIQUE (credit_note_id, order_line_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_order ON public.credit_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_return ON public.credit_notes(return_request_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn ON public.credit_note_items(credit_note_id);

-- Sequence for credit note numbering
CREATE SEQUENCE IF NOT EXISTS public.credit_note_number_seq START WITH 1;

-- Function to generate a Credit Note atomically
CREATE OR REPLACE FUNCTION public.create_credit_note_atomic(
    p_order_id TEXT,
    p_return_request_id UUID,
    p_original_invoice_id TEXT,
    p_original_invoice_date DATE,
    p_taxable NUMERIC,
    p_cgst NUMERIC,
    p_sgst NUMERIC,
    p_igst NUMERIC,
    p_refund NUMERIC,
    p_reason_code TEXT,
    p_issued_by TEXT,
    p_items JSONB
)
RETURNS JSON AS $$
DECLARE
    v_seq_val INTEGER;
    v_cn_number TEXT;
    v_cn_id UUID;
    v_item RECORD;
    v_item_id UUID;
BEGIN
    -- Check if credit note already exists for this return_request_id
    SELECT id, credit_note_number INTO v_cn_id, v_cn_number 
    FROM public.credit_notes 
    WHERE return_request_id = p_return_request_id;
    
    IF FOUND THEN
        RETURN json_build_object('success', true, 'credit_note_id', v_cn_id, 'credit_note_number', v_cn_number, 'status', 'already_exists');
    END IF;

    -- Generate sequence number
    SELECT nextval('public.credit_note_number_seq') INTO v_seq_val;
    v_cn_number := '6K-CN-2026-' || lpad(v_seq_val::text, 6, '0');

    -- Insert Master Credit Note
    INSERT INTO public.credit_notes (
        credit_note_number, order_id, return_request_id, original_invoice_id, 
        original_invoice_date, taxable_amount, cgst_amount, sgst_amount, 
        igst_amount, refund_amount, reason_code, issued_by, status
    ) VALUES (
        v_cn_number, p_order_id, p_return_request_id, p_original_invoice_id,
        p_original_invoice_date, p_taxable, p_cgst, p_sgst, 
        p_igst, p_refund, p_reason_code, p_issued_by, 'issued'
    ) RETURNING id INTO v_cn_id;

    -- Insert Credit Note Items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id TEXT, order_line_id TEXT, sku TEXT, quantity INTEGER, 
        gst_rate NUMERIC, taxable_value NUMERIC, cgst NUMERIC, sgst NUMERIC, 
        igst NUMERIC, hsn TEXT, reason TEXT
    ) LOOP
        INSERT INTO public.credit_note_items (
            credit_note_id, product_id, order_line_id, sku, quantity, 
            gst_rate, taxable_value, cgst, sgst, igst, hsn, reason
        ) VALUES (
            v_cn_id, v_item.product_id, v_item.order_line_id, v_item.sku, v_item.quantity,
            v_item.gst_rate, v_item.taxable_value, v_item.cgst, v_item.sgst, v_item.igst, v_item.hsn, v_item.reason
        );
    END LOOP;

    -- Record in Financial Ledger
    INSERT INTO public.financial_ledger (
        order_id, event_type, amount, source_entity_type, source_entity_id, metadata
    ) VALUES (
        p_order_id, 'credit_note_issued', p_refund, 'credit_note', v_cn_id, 
        json_build_object('credit_note_number', v_cn_number, 'return_request_id', p_return_request_id)
    );

    RETURN json_build_object('success', true, 'credit_note_id', v_cn_id, 'credit_note_number', v_cn_number, 'status', 'created');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Override confirm_order_and_process_payments_atomic to integrate financial ledger writes
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

  -- 8a. Log to Financial Ledger (order_created, payment_captured, wallet_debit, shipping_charged)
  INSERT INTO public.financial_ledger (order_id, event_type, amount, source_entity_type, source_entity_text_id)
  VALUES (p_order_id, 'order_created', v_order.total, 'order', p_order_id);

  INSERT INTO public.financial_ledger (order_id, event_type, amount, source_entity_type, source_entity_text_id)
  VALUES (p_order_id, 'payment_captured', v_order.total, 'payment', p_payment_id);

  IF v_order.shipping_amount > 0 THEN
    INSERT INTO public.financial_ledger (order_id, event_type, amount, source_entity_type, source_entity_text_id)
    VALUES (p_order_id, 'shipping_charged', v_order.shipping_amount, 'order', p_order_id);
  END IF;

  IF p_wallet_deduction > 0 THEN
    INSERT INTO public.financial_ledger (order_id, event_type, amount, source_entity_type, source_entity_text_id)
    VALUES (p_order_id, 'wallet_debit', p_wallet_deduction, 'wallet_transaction', 'wallet-order-' || p_order_id);
  END IF;

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
