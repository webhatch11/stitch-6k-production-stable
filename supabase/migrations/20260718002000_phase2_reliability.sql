-- Phase 2: Payment Reliability & Order Lifecycle

-- 1. Ensure exactly-once processing with UNIQUE constraints
-- The razorpay_payment_id must be unique across all orders
ALTER TABLE public.orders ADD CONSTRAINT unique_razorpay_payment_id UNIQUE (razorpay_payment_id);

-- Shiprocket order ID should be unique to prevent duplicate dispatches, ignoring NULLs
CREATE UNIQUE INDEX IF NOT EXISTS unique_shiprocket_order_id ON public.orders(shiprocket_order_id) WHERE shiprocket_order_id IS NOT NULL AND shiprocket_order_id != '';

-- Shiprocket AWB should be unique, ignoring NULLs
CREATE UNIQUE INDEX IF NOT EXISTS unique_shiprocket_awb ON public.orders(shiprocket_id) WHERE shiprocket_id IS NOT NULL AND shiprocket_id != '';

-- 2. Add payment_processing_state to orders to track BullMQ exactly-once execution
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_processing_state JSONB DEFAULT '{}';

-- 3. Update order_status_history for comprehensive audit logging
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS trigger_source TEXT;
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS reason TEXT;

-- 4. Create an atomic claim RPC for the payment processor
CREATE OR REPLACE FUNCTION atomic_claim_payment(p_order_id TEXT, p_payment_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_order orders%ROWTYPE;
BEGIN
    -- Lock the row
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- If already paid (status is Paid, Accepted, etc. - anything other than Payment Pending or FAILED)
    IF v_order.status != 'Payment Pending' AND v_order.status != 'FAILED' THEN
        RETURN json_build_object('success', true, 'message', 'Order already claimed', 'status', v_order.status);
    END IF;

    -- Claim it
    UPDATE orders 
    SET 
        status = 'Paid',
        payment_status = 'Paid',
        razorpay_payment_id = p_payment_id
    WHERE id = p_order_id;

    RETURN json_build_object('success', true, 'message', 'Claimed successfully', 'status', 'Paid');
EXCEPTION WHEN unique_violation THEN
    -- If another process set the same razorpay_payment_id and it violated constraint
    RETURN json_build_object('success', true, 'message', 'Duplicate payment ID prevented', 'status', 'Paid');
END;
$$ LANGUAGE plpgsql;
