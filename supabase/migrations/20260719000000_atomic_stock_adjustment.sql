-- Migration: 20260719000000_atomic_stock_adjustment.sql
-- Goal: Provide atomic, race-condition free, and idempotent variant stock adjustments.

-- 1. Atomic adjustment helper
CREATE OR REPLACE FUNCTION public.adjust_variant_stock_atomic(
    p_product_id TEXT,
    p_size TEXT,
    p_delta INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_variant_id UUID;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
BEGIN
    -- Try to lock variant row
    SELECT id, stock INTO v_variant_id, v_current_stock
    FROM product_variants
    WHERE product_id = p_product_id AND size = p_size
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        v_new_stock := GREATEST(0, v_current_stock + p_delta);
        UPDATE product_variants SET stock = v_new_stock WHERE id = v_variant_id;
        
        INSERT INTO inventory_audit_logs (variant_id, quantity_changed, type, reason)
        VALUES (v_variant_id, p_delta, 'adjustment', 'Manual adjustment');
        
        RETURN TRUE;
    ELSE
        -- Lock product row to prevent concurrent fallback writes
        SELECT stock INTO v_current_stock 
        FROM products 
        WHERE id = p_product_id 
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found', p_product_id;
        END IF;

        -- Static SQL updates for fallback columns to avoid dynamic execution overhead
        IF LOWER(p_size) = 's' THEN
            UPDATE products SET size_stock_s = GREATEST(0, COALESCE(size_stock_s, 0) + p_delta) WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'm' THEN
            UPDATE products SET size_stock_m = GREATEST(0, COALESCE(size_stock_m, 0) + p_delta) WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'l' THEN
            UPDATE products SET size_stock_l = GREATEST(0, COALESCE(size_stock_l, 0) + p_delta) WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'xl' THEN
            UPDATE products SET size_stock_xl = GREATEST(0, COALESCE(size_stock_xl, 0) + p_delta) WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'xxl' THEN
            UPDATE products SET size_stock_xxl = GREATEST(0, COALESCE(size_stock_xxl, 0) + p_delta) WHERE id = p_product_id;
        ELSE
            RAISE EXCEPTION 'Invalid size argument %', p_size;
        END IF;
        
        RETURN TRUE;
    END IF;
END;
$$;

-- 2. Atomic & Idempotent restock helper
CREATE OR REPLACE FUNCTION public.restock_variant_stock_atomic(
    p_product_id TEXT,
    p_size TEXT,
    p_color TEXT,
    p_quantity INTEGER,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_variant_id UUID;
    v_current_stock INTEGER;
BEGIN
    -- Try to lock variant row
    SELECT id, stock INTO v_variant_id, v_current_stock
    FROM product_variants
    WHERE product_id = p_product_id AND size = p_size AND color = p_color
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        -- Idempotency check: verify if we already processed this restock event
        IF EXISTS (
            SELECT 1 FROM inventory_audit_logs 
            WHERE variant_id = v_variant_id AND type = 'restoration' AND reason = p_reason
        ) THEN
            RETURN TRUE; -- Already processed, skip modification to avoid double restocking
        END IF;

        UPDATE product_variants SET stock = stock + p_quantity WHERE id = v_variant_id;
        
        INSERT INTO inventory_audit_logs (variant_id, quantity_changed, type, reason)
        VALUES (v_variant_id, p_quantity, 'restoration', p_reason);
        
        RETURN TRUE;
    ELSE
        -- Fallback to product table size_stock column
        SELECT stock INTO v_current_stock 
        FROM products 
        WHERE id = p_product_id 
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found', p_product_id;
        END IF;

        IF LOWER(p_size) = 's' THEN
            UPDATE products SET size_stock_s = COALESCE(size_stock_s, 0) + p_quantity WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'm' THEN
            UPDATE products SET size_stock_m = COALESCE(size_stock_m, 0) + p_quantity WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'l' THEN
            UPDATE products SET size_stock_l = COALESCE(size_stock_l, 0) + p_quantity WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'xl' THEN
            UPDATE products SET size_stock_xl = COALESCE(size_stock_xl, 0) + p_quantity WHERE id = p_product_id;
        ELSIF LOWER(p_size) = 'xxl' THEN
            UPDATE products SET size_stock_xxl = COALESCE(size_stock_xxl, 0) + p_quantity WHERE id = p_product_id;
        ELSE
            RAISE EXCEPTION 'Invalid size argument %', p_size;
        END IF;
        
        RETURN TRUE;
    END IF;
END;
$$;
