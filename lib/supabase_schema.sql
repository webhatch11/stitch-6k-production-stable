-- Stitch 6K Heritage + GEN-Z Streetwear - Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor to set up all tables

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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'system'
);
