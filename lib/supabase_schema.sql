-- Stitch 6K Heritage + GEN-Z Streetwear - Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor to set up all tables
--

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: profiles (custom users schema linked to Supabase Auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    wallet_balance NUMERIC DEFAULT 2500,
    loyalty_points INTEGER DEFAULT 500,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5. Table: user_addresses (user shipping/billing address book)
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  phone          TEXT DEFAULT '',
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT DEFAULT '',
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  postal_code    TEXT NOT NULL,
  country        TEXT DEFAULT 'India',
  is_default     BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
  ON public.user_addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_default
  ON public.user_addresses (user_id) WHERE is_default = true;

-- 2. Table: products (main inventory catalog)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY, -- SKU Reference
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC NOT NULL,
    compare_price NUMERIC DEFAULT 0,
    category TEXT NOT NULL,
    image TEXT,
    images TEXT[] DEFAULT '{}',
    is_new BOOLEAN DEFAULT true,
    stock INTEGER DEFAULT 0,
    description TEXT,
    is_atelier_exclusive BOOLEAN DEFAULT false,
    is_genz BOOLEAN DEFAULT false,
    
    -- Sizing Stock Levels Matrix
    size_stock_s INTEGER DEFAULT 0,
    size_stock_m INTEGER DEFAULT 0,
    size_stock_l INTEGER DEFAULT 0,
    size_stock_xl INTEGER DEFAULT 0,
    size_stock_xxl INTEGER DEFAULT 0,
    
    -- Tax, Discounts, & Margins
    base_price NUMERIC,
    gst_rate NUMERIC DEFAULT 12,
    discount_rate NUMERIC DEFAULT 0,
    custom_badge TEXT DEFAULT '',
    featured BOOLEAN DEFAULT false,
    bestseller BOOLEAN DEFAULT false,
    material TEXT DEFAULT '',
    colors TEXT[] DEFAULT '{}',
    ratings NUMERIC DEFAULT 5.0,
    
    -- Spec Sheets
    spec_fabric TEXT,
    spec_fit TEXT,
    spec_collar TEXT,
    spec_sleeve TEXT,
    spec_care TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: product_variants (relational apparel variant inventory)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL CHECK (size IN ('S', 'M', 'L', 'XL', 'XXL')),
    color TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table: coupons (promo validation rules)
CREATE TABLE IF NOT EXISTS public.coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percent', 'flat')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: orders (sales transactions records)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, -- ORD-XXXX
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer TEXT NOT NULL,
    date TEXT NOT NULL,
    total NUMERIC NOT NULL,
    status TEXT NOT NULL,
    items TEXT[] DEFAULT '{}',
    original_total NUMERIC NOT NULL,
    coupon_discount NUMERIC DEFAULT 0,
    coupon_code TEXT,
    wallet_paid NUMERIC DEFAULT 0,
    gateway_paid NUMERIC DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    points_discount NUMERIC DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    shiprocket_id TEXT DEFAULT '',
    idempotency_key TEXT UNIQUE,
    
    -- Returns & Refunds Details
    return_reason TEXT,
    return_details TEXT,
    return_image TEXT,
    refund_option TEXT,
    return_request_date TEXT,
    return_date TEXT,
    return_reject_reason TEXT,
    quality_check_passed BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table: wallet_transactions (balances ledger log)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Table: loyalty_transactions (points ledger log)
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Automated Supabase Auth Trigger Profile Creator
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
    2500, -- welcome balance credit
    500   -- welcome points reward
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed base coupons
INSERT INTO public.coupons (id, code, discount, type, active) VALUES 
('CPN-1', 'HERITAGE10', 10, 'percent', true),
('CPN-2', 'LAUNCH500', 500, 'flat', true)
ON CONFLICT (code) DO NOTHING;

-- 9. Table: order_status_history (immutable audit log for order state changes)
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'system'
);

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_usage INTEGER;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS min_cart_value NUMERIC;

-- 10. Atomic Wallet Debit
CREATE OR REPLACE FUNCTION wallet_atomic_debit(p_user_id UUID, p_amount NUMERIC, p_idempotency_key TEXT, p_desc TEXT)
RETURNS JSON AS $$
DECLARE
    v_balance NUMERIC;
    v_new_balance NUMERIC;
    v_tx_id TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = p_idempotency_key) THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate transaction');
    END IF;

    SELECT wallet_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    IF v_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance');
    END IF;

    v_new_balance := v_balance - p_amount;
    
    UPDATE profiles SET wallet_balance = v_new_balance WHERE id = p_user_id;

    v_tx_id := 'WTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT;
    
    INSERT INTO wallet_transactions (id, user_id, date, amount, type, description, idempotency_key)
    VALUES (
        v_tx_id, 
        p_user_id, 
        to_char(NOW(), 'DD Mon YYYY'), 
        p_amount, 
        'debit', 
        p_desc, 
        p_idempotency_key
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql;

-- 11. Atomic Wallet Credit
CREATE OR REPLACE FUNCTION wallet_atomic_credit(p_user_id UUID, p_amount NUMERIC, p_idempotency_key TEXT, p_desc TEXT)
RETURNS JSON AS $$
DECLARE
    v_balance NUMERIC;
    v_new_balance NUMERIC;
    v_tx_id TEXT;
BEGIN
    IF p_idempotency_key IS NOT NULL AND EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = p_idempotency_key) THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate transaction');
    END IF;

    SELECT wallet_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    v_new_balance := v_balance + p_amount;
    UPDATE profiles SET wallet_balance = v_new_balance WHERE id = p_user_id;

    v_tx_id := 'WTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT;
    
    INSERT INTO wallet_transactions (id, user_id, date, amount, type, description, idempotency_key)
    VALUES (
        v_tx_id, 
        p_user_id, 
        to_char(NOW(), 'DD Mon YYYY'), 
        p_amount, 
        'credit', 
        p_desc, 
        p_idempotency_key
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql;

-- 12. Atomic Loyalty Debit
CREATE OR REPLACE FUNCTION loyalty_atomic_debit(p_user_id UUID, p_points INTEGER, p_idempotency_key TEXT, p_desc TEXT)
RETURNS JSON AS $$
DECLARE
    v_balance INTEGER;
    v_new_balance INTEGER;
    v_tx_id TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM loyalty_transactions WHERE idempotency_key = p_idempotency_key) THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate transaction');
    END IF;

    SELECT loyalty_points INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    IF v_balance < p_points THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient loyalty points');
    END IF;

    v_new_balance := v_balance - p_points;
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

-- 13. Atomic Loyalty Credit
CREATE OR REPLACE FUNCTION loyalty_atomic_credit(p_user_id UUID, p_points INTEGER, p_idempotency_key TEXT, p_desc TEXT)
RETURNS JSON AS $$
DECLARE
    v_balance INTEGER;
    v_new_balance INTEGER;
    v_tx_id TEXT;
BEGIN
    IF p_idempotency_key IS NOT NULL AND EXISTS (SELECT 1 FROM loyalty_transactions WHERE idempotency_key = p_idempotency_key) THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate transaction');
    END IF;

    SELECT loyalty_points INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    v_new_balance := v_balance + p_points;
    UPDATE profiles SET loyalty_points = v_new_balance WHERE id = p_user_id;

    v_tx_id := 'LTX-' || floor(extract(epoch from clock_timestamp()) * 1000)::TEXT;
    
    INSERT INTO loyalty_transactions (id, user_id, date, points, type, description, idempotency_key)
    VALUES (
        v_tx_id, 
        p_user_id, 
        to_char(NOW(), 'DD Mon YYYY'), 
        p_points, 
        'credit', 
        p_desc, 
        p_idempotency_key
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql;

-- 14. Atomic Coupon Increment
CREATE OR REPLACE FUNCTION coupon_atomic_increment(p_code TEXT)
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

    IF v_coupon.expiry_date IS NOT NULL AND v_coupon.expiry_date < NOW() THEN
        RETURN json_build_object('success', false, 'error', 'Coupon has expired');
    END IF;

    IF v_coupon.max_usage IS NOT NULL AND COALESCE(v_coupon.usage_count, 0) >= v_coupon.max_usage THEN
        RETURN json_build_object('success', false, 'error', 'Coupon usage limit reached');
    END IF;

    UPDATE coupons SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = UPPER(p_code);
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 15. Atomic Inventory Reservation
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'fulfilled', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT
);

CREATE OR REPLACE FUNCTION reserve_inventory_atomic(p_product_slug TEXT, p_quantity INTEGER, p_expires_mins INTEGER, p_session TEXT)
RETURNS JSON AS $$
DECLARE
    v_product products%ROWTYPE;
    v_active_reservations INTEGER;
    v_available_stock INTEGER;
BEGIN
    SELECT * INTO v_product FROM products WHERE slug = p_product_slug FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Product not found');
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_active_reservations 
    FROM inventory_reservations 
    WHERE product_id = v_product.id AND status = 'reserved' AND expires_at > NOW();

    v_available_stock := COALESCE(v_product.stock, 0) - v_active_reservations;

    IF v_available_stock < p_quantity THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient inventory');
    END IF;

    INSERT INTO inventory_reservations (product_id, quantity, expires_at, session_id)
    VALUES (v_product.id, p_quantity, NOW() + (p_expires_mins || ' minutes')::interval, p_session);

    RETURN json_build_object('success', true, 'remaining_available', v_available_stock - p_quantity);
END;
$$ LANGUAGE plpgsql;

-- 16a. Inventory Audit Logs Table (required by deduct_variant_stock and restore_variant_stock)
CREATE TABLE IF NOT EXISTS public.inventory_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity_changed INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deduction', 'restoration', 'adjustment')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_variant ON public.inventory_audit_logs(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_created ON public.inventory_audit_logs(created_at DESC);

-- 16. Atomic Variant Inventory Operations
CREATE OR REPLACE FUNCTION deduct_variant_stock(p_product_id TEXT, p_size TEXT, p_color TEXT, p_quantity INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_variant product_variants%ROWTYPE;
BEGIN
    SELECT * INTO v_variant FROM product_variants 
    WHERE product_id = p_product_id AND size = p_size AND color = p_color 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_variant.stock < p_quantity THEN
        RETURN FALSE;
    END IF;

    UPDATE product_variants SET stock = stock - p_quantity WHERE id = v_variant.id;
    
    INSERT INTO inventory_audit_logs (variant_id, quantity_changed, type, reason)
    VALUES (v_variant.id, -p_quantity, 'deduction', 'Checkout order deduction');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_variant_stock(p_product_id TEXT, p_size TEXT, p_color TEXT, p_quantity INTEGER)
RETURNS VOID AS $$
DECLARE
    v_variant product_variants%ROWTYPE;
BEGIN
    SELECT * INTO v_variant FROM product_variants 
    WHERE product_id = p_product_id AND size = p_size AND color = p_color 
    FOR UPDATE;
    
    IF FOUND THEN
        UPDATE product_variants SET stock = stock + p_quantity WHERE id = v_variant.id;
        
        INSERT INTO inventory_audit_logs (variant_id, quantity_changed, type, reason)
        VALUES (v_variant.id, p_quantity, 'restoration', 'Order cancelled restoration');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 17. Atomic Variant Inventory Reservation
ALTER TABLE public.inventory_reservations ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.inventory_reservations ADD COLUMN IF NOT EXISTS color TEXT;

CREATE OR REPLACE FUNCTION reserve_variant_inventory_atomic(p_product_id TEXT, p_size TEXT, p_color TEXT, p_quantity INTEGER, p_expires_mins INTEGER, p_session TEXT)
RETURNS JSON AS $$
DECLARE
    v_variant product_variants%ROWTYPE;
    v_active_reservations INTEGER;
    v_available_stock INTEGER;
BEGIN
    SELECT * INTO v_variant FROM product_variants 
    WHERE product_id = p_product_id AND size = p_size AND color = p_color 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Variant not found');
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_active_reservations 
    FROM inventory_reservations 
    WHERE product_id = p_product_id AND size = p_size AND color = p_color AND status = 'reserved' AND expires_at > NOW();

    v_available_stock := COALESCE(v_variant.stock, 0) - v_active_reservations;

    IF v_available_stock < p_quantity THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient inventory');
    END IF;

    INSERT INTO inventory_reservations (product_id, size, color, quantity, expires_at, session_id)
    VALUES (p_product_id, p_size, p_color, p_quantity, NOW() + (p_expires_mins || ' minutes')::interval, p_session);

    RETURN json_build_object('success', true, 'remaining_available', v_available_stock - p_quantity);
END;
$$ LANGUAGE plpgsql;

-- 18. Phase 3 Updates: Razorpay Integration Tables

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_order_id TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'CREATED',
    method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Phase 4 Updates: Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user ON public.loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);

-- 20. Logistics & Tracking Tables
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    shiprocket_order_id TEXT,
    shipment_id TEXT,
    awb_code TEXT UNIQUE,
    courier_name TEXT,
    status TEXT NOT NULL,
    etd TIMESTAMPTZ,
    weight NUMERIC,
    dimensions_length INTEGER DEFAULT 30,
    dimensions_width INTEGER DEFAULT 22,
    dimensions_height INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    activity TEXT NOT NULL,
    location TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_awb ON public.shipments(awb_code);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON public.shipment_events(shipment_id);

-- 21. Database Sequence for Sequential Order Numbers
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.get_next_order_number()
RETURNS TEXT AS $$
DECLARE
    v_seq_val INTEGER;
BEGIN
    SELECT nextval('public.order_number_seq') INTO v_seq_val;
    RETURN 'STK-2026-' || lpad(v_seq_val::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 22. Payment Audit Logs Table
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Order Events Timeline Table
CREATE TABLE IF NOT EXISTS public.order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter check constraint on inventory reservations if present
ALTER TABLE public.inventory_reservations DROP CONSTRAINT IF EXISTS inventory_reservations_status_check;
ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_reservations_status_check CHECK (status IN ('reserved', 'fulfilled', 'cancelled', 'ACTIVE', 'FULFILLED', 'RELEASED', 'EXPIRED'));

-- Alter orders table to store full JSON cart items
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_items JSONB DEFAULT '[]';

-- Alter orders table to store delivery address at checkout time (issue #8)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_snapshot JSONB;

-- 24. Batch Variant Inventory Reservation (N+1 query solution)
CREATE OR REPLACE FUNCTION reserve_variant_inventory_batch_atomic(p_items JSONB, p_expires_mins INTEGER, p_session TEXT)
RETURNS JSON AS $$
DECLARE
    item RECORD;
    v_variant RECORD;
    v_active_reservations INTEGER;
    v_available_stock INTEGER;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_product_id TEXT;
    v_size TEXT;
    v_color TEXT;
    v_quantity INTEGER;
BEGIN
    -- Temporary table to hold and sort items to prevent deadlocks
    CREATE TEMP TABLE temp_items (
        product_id TEXT,
        size TEXT,
        color TEXT,
        quantity INTEGER
    ) ON COMMIT DROP;

    -- Insert JSON items into temp table
    INSERT INTO temp_items
    SELECT 
        (value->>'product_id')::TEXT,
        (value->>'size')::TEXT,
        (value->>'color')::TEXT,
        (value->>'quantity')::INTEGER
    FROM jsonb_array_elements(p_items);

    -- Loop to lock and validate sorted items
    FOR item IN 
        SELECT * FROM temp_items ORDER BY product_id, size, color
    LOOP
        v_product_id := item.product_id;
        v_size := item.size;
        v_color := item.color;
        v_quantity := item.quantity;

        -- Lock row
        SELECT * INTO v_variant FROM product_variants 
        WHERE product_id = v_product_id AND size = v_size AND color = v_color 
        FOR UPDATE;
        
        IF NOT FOUND THEN
            v_errors := array_append(v_errors, 'Variant not found: ' || v_product_id || ' (' || v_size || '/' || v_color || ')');
            CONTINUE;
        END IF;

        -- Get active reservations
        SELECT COALESCE(SUM(quantity), 0) INTO v_active_reservations 
        FROM inventory_reservations 
        WHERE product_id = v_product_id AND size = v_size AND color = v_color AND status = 'reserved' AND expires_at > NOW();

        v_available_stock := COALESCE(v_variant.stock, 0) - v_active_reservations;

        IF v_available_stock < v_quantity THEN
            v_errors := array_append(v_errors, 'Insufficient inventory for: ' || v_product_id || ' (' || v_size || '/' || v_color || '). Available: ' || v_available_stock || ', Requested: ' || v_quantity);
        END IF;
    END LOOP;

    -- If errors exist, return failure without inserting reservations (transaction rolls back)
    IF array_length(v_errors, 1) > 0 THEN
        RETURN json_build_object('success', false, 'errors', v_errors);
    END IF;

    -- Insert reservations if all checks pass
    FOR item IN SELECT * FROM temp_items LOOP
        INSERT INTO inventory_reservations (product_id, size, color, quantity, expires_at, session_id)
        VALUES (item.product_id, item.size, item.color, item.quantity, NOW() + (p_expires_mins || ' minutes')::interval, p_session);
    END LOOP;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 25. Database Aggregate Calculations for Admin Dashboard (Performance optimization)
CREATE OR REPLACE FUNCTION get_dashboard_aggregates()
RETURNS JSON AS $$
DECLARE
    v_total_orders INTEGER;
    v_total_revenue NUMERIC;
    v_cash_revenue NUMERIC;
    v_credit_revenue NUMERIC;
    v_total_stock NUMERIC;
    v_wallet_liability NUMERIC;
    v_inventory_count INTEGER;
BEGIN
    -- Active orders are those that are not Returned and not FAILED and not EXPIRED
    SELECT 
        COALESCE(COUNT(id), 0),
        COALESCE(SUM(total), 0),
        COALESCE(SUM(gateway_paid), 0),
        COALESCE(SUM(wallet_paid), 0)
    INTO 
        v_total_orders,
        v_total_revenue,
        v_cash_revenue,
        v_credit_revenue
    FROM public.orders
    WHERE status != 'Returned' AND status != 'FAILED' AND status != 'EXPIRED';

    -- Wallet liability is the sum of wallet balance across all users
    SELECT COALESCE(SUM(wallet_balance), 0) INTO v_wallet_liability FROM public.profiles;

    -- Total products in inventory (inventory count)
    SELECT COALESCE(COUNT(id), 0) INTO v_inventory_count FROM public.products;

    -- Total sum of stock of all variants (total stock)
    SELECT COALESCE(SUM(stock), 0) INTO v_total_stock FROM public.product_variants;

    RETURN json_build_object(
        'totalOrders', v_total_orders,
        'totalRevenue', v_total_revenue,
        'cashRevenue', v_cash_revenue,
        'creditRevenue', v_credit_revenue,
        'inventoryCount', v_inventory_count,
        'totalStock', v_total_stock,
        'walletLiability', v_wallet_liability,
        'conversion', '4.2%'
    );
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 15. Schema Migrations (Additions for variant stock management)
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS reserved_stock INTEGER 
NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0);

ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 16. Return Constraints & Performance Composite Indexes (2026-07-09 Audit)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_return_fields;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_return_fields CHECK (
    (status NOT IN ('Return Requested', 'Returned', 'Return Rejected')) OR 
    (return_reason IS NOT NULL AND refund_option IS NOT NULL AND return_request_date IS NOT NULL)
);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_return_reject;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_return_reject CHECK (
    (status <> 'Return Rejected') OR (return_reject_reason IS NOT NULL)
);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_refund_option;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_refund_option CHECK (
    refund_option IS NULL OR refund_option IN ('wallet', 'original_source')
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id_status ON public.orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_product_variants_lookup ON public.product_variants (product_id, size, color);
