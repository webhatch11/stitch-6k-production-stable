-- SQL Migration: Production Relational Schema for Item-Level Returns, Refund Ledger & Reverse Logistics

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Master Return Requests Table (UUID PK)
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_code TEXT UNIQUE NOT NULL DEFAULT 'RET-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'Return Requested', -- Return Requested, Return Approved, Return Pickup Scheduled, Return in Transit, Return Received, Return QC Pending, Return QC Passed, Return QC Failed, Refunded, Return Rejected
  refund_option TEXT NOT NULL DEFAULT 'wallet', -- wallet, original_source, bank
  reason TEXT NOT NULL,
  details TEXT,
  image_url TEXT,
  shiprocket_return_order_id TEXT,
  return_awb TEXT UNIQUE,
  pickup_scheduled_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  qc_completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Detail Return Request Items Table (UUID PK)
CREATE TABLE IF NOT EXISTS public.return_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL, -- Immutable Order Line Item ID
  product_id TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'Default',
  quantity INT NOT NULL CHECK (quantity > 0),
  item_price NUMERIC(10,2) NOT NULL,
  pro_rata_discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  pro_rata_points NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  net_refund_amount NUMERIC(10,2) NOT NULL,
  qc_status TEXT DEFAULT 'PENDING', -- PENDING, PASSED, FAILED
  qc_fail_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dedicated Financial Refund Ledger Table (UUID PK)
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_code TEXT UNIQUE NOT NULL DEFAULT 'RFD-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  return_request_id UUID REFERENCES public.return_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  gateway_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_refund_amount NUMERIC(10,2) NOT NULL,
  gateway_refund_id TEXT, -- Razorpay refund ID
  status TEXT NOT NULL DEFAULT 'PROCESSED', -- PENDING, PROCESSED, FAILED
  reason TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized Database Indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON public.return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_awb ON public.return_requests(return_awb);
CREATE INDEX IF NOT EXISTS idx_return_request_items_req_id ON public.return_request_items(return_request_id);
CREATE INDEX IF NOT EXISTS idx_return_request_items_item_id ON public.return_request_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_return_req_id ON public.refunds(return_request_id);
