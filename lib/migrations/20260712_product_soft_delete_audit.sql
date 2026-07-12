-- Migration: Product Soft Delete, Deletion Scheduling & Audit Logging
-- Applies metadata columns to product table and creates the permanent audit logs table.

-- 1. Add scheduled deletion timestamp to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS scheduled_permanent_deletion_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create product audit logs table (kept forever, does not cascade-delete)
CREATE TABLE IF NOT EXISTS public.product_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL CHECK (action IN ('soft_delete', 'restore', 'permanent_delete')),
    product_id TEXT NOT NULL,
    product_title TEXT NOT NULL,
    admin_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_user_email TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance auditing
CREATE INDEX IF NOT EXISTS idx_product_audit_logs_product ON public.product_audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_logs_created ON public.product_audit_logs(created_at DESC);
