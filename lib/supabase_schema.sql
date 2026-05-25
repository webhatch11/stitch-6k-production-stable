-- Stitch 6K Heritage - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor to set up all tables

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: coupons
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percent', 'flat')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, -- SKU Reference
    title TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    images TEXT[] DEFAULT '{}',
    is_new BOOLEAN DEFAULT true,
    stock INTEGER DEFAULT 0,
    description TEXT,
    is_atelier_exclusive BOOLEAN DEFAULT false,
    
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
    
    -- Spec Sheets
    spec_fabric TEXT,
    spec_fit TEXT,
    spec_collar TEXT,
    spec_sleeve TEXT,
    spec_care TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, -- ORD-XXXX
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

-- 4. Table: wallet_transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: loyalty_transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table: account_balances
-- Tracks active values for prototype wallet/loyalty points simulation
CREATE TABLE IF NOT EXISTS account_balances (
    key TEXT PRIMARY KEY, -- 'wallet_balance' or 'loyalty_points'
    value NUMERIC NOT NULL
);

-- Seed initial default balances if they do not exist
INSERT INTO account_balances (key, value) VALUES 
('wallet_balance', 2500),
('loyalty_points', 500)
ON CONFLICT (key) DO NOTHING;

-- Seed default coupons
INSERT INTO coupons (id, code, discount, type, active) VALUES 
('CPN-1', 'HERITAGE10', 10, 'percent', true),
('CPN-2', 'LAUNCH500', 500, 'flat', true)
ON CONFLICT (code) DO NOTHING;

-- Seed initial catalog products
INSERT INTO products (
    id, title, price, category, image, images, is_new, stock, description, is_atelier_exclusive,
    size_stock_s, size_stock_m, size_stock_l, size_stock_xl, size_stock_xxl,
    base_price, gst_rate, discount_rate, spec_fabric, spec_fit, spec_collar, spec_sleeve, spec_care
) VALUES 
(
    'seed-1', 'Classic White Oxford', 1299, 'Cotton', 
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800', 
    ARRAY['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800'], 
    true, 45, 'Immaculate tailoring in a standard weave.', false,
    10, 10, 10, 10, 5, 1160, 12, 0, '100% Oxford Cotton', 'Regular Fit', 'Classic Collar', 'Full Sleeves', 'Machine Wash Warm'
),
(
    'seed-2', 'Midnight Blue Poplin', 1450, 'Cotton', 
    'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800', 
    ARRAY['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800'], 
    true, 30, 'Comfortable organic poplin shirts in navy colorings.', false,
    5, 10, 10, 5, 0, 1295, 12, 0, '100% Poplin Cotton', 'Slim Fit', 'Button-Down Collar', 'Full Sleeves', 'Machine Wash Cold'
),
(
    'seed-3', 'Sage Green Heritage', 1699, 'Linen', 
    'https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800', 
    ARRAY['https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800'], 
    true, 15, 'Traditional dyed green linen weave shirts.', false,
    5, 5, 5, 0, 0, 1517, 12, 0, '100% Pure Linen', 'Atelier Fit', 'Band Collar', 'Full Sleeves', 'Hand Wash Cold'
)
ON CONFLICT (id) DO NOTHING;
