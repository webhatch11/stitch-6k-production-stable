-- Issue #5: Fix broken dollar-quoting on 3 variant inventory functions
-- and create the inventory_audit_logs table they depend on.
--
-- Root cause: deduct_variant_stock and restore_variant_stock were missing
-- $$ delimiters entirely (AS followed directly by DECLARE).
-- reserve_variant_inventory_atomic used $$$ (three dollar signs) instead of $$.
-- All three also referenced inventory_audit_logs which had no CREATE TABLE.
--
-- All functions are SECURITY DEFINER so they can write to inventory_audit_logs
-- which is protected by admin-only RLS. SET search_path = public prevents
-- search_path injection attacks.

-- ---------------------------------------------------------------------------
-- a. inventory_audit_logs table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity_changed INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deduction', 'restoration', 'adjustment')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_variant
  ON public.inventory_audit_logs(variant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_created
  ON public.inventory_audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- b. RLS on inventory_audit_logs  [C — ADMIN-ONLY]
--    Follows the same pattern as payment_audit_logs in issue #4 migration.
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_audit_logs_select_admin" ON public.inventory_audit_logs;
CREATE POLICY "inventory_audit_logs_select_admin"
  ON public.inventory_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- c. deduct_variant_stock — fixed dollar-quoting + SECURITY DEFINER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deduct_variant_stock(
    p_product_id TEXT,
    p_size TEXT,
    p_color TEXT,
    p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ---------------------------------------------------------------------------
-- d. restore_variant_stock — fixed dollar-quoting + SECURITY DEFINER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_variant_stock(
    p_product_id TEXT,
    p_size TEXT,
    p_color TEXT,
    p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ---------------------------------------------------------------------------
-- e. reserve_variant_inventory_atomic — fixed $$$ → $$ + SECURITY DEFINER
--    Signature unchanged: matches the call in
--    tests/concurrency/test_atomic_operations.ts and lib/services/inventory.ts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reserve_variant_inventory_atomic(
    p_product_id TEXT,
    p_size TEXT,
    p_color TEXT,
    p_quantity INTEGER,
    p_expires_mins INTEGER,
    p_session TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE product_id = p_product_id
      AND size = p_size
      AND color = p_color
      AND status = 'reserved'
      AND expires_at > NOW();

    v_available_stock := COALESCE(v_variant.stock, 0) - v_active_reservations;

    IF v_available_stock < p_quantity THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient inventory');
    END IF;

    INSERT INTO inventory_reservations (product_id, size, color, quantity, expires_at, session_id)
    VALUES (p_product_id, p_size, p_color, p_quantity,
            NOW() + (p_expires_mins || ' minutes')::interval, p_session);

    RETURN json_build_object('success', true, 'remaining_available', v_available_stock - p_quantity);
END;
$$;
