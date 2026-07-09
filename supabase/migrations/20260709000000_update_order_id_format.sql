-- ---------------------------------------------------------------------------
-- Migration: Update order ID format from STK-2026-XXXXXX to 6K-YYYY-NNNNN
--
-- New format: 6K-{YEAR}-{5-digit sequence}
-- Example:    6K-2026-00001
--
-- The sequence is global (not per-year) so it never resets,
-- guaranteeing uniqueness even across year boundaries.
-- ---------------------------------------------------------------------------

-- Step 1: Replace the get_next_order_number function with the new format
CREATE OR REPLACE FUNCTION public.get_next_order_number()
RETURNS TEXT AS $$
DECLARE
    v_seq_val INTEGER;
    v_year    TEXT;
BEGIN
    SELECT nextval('public.order_number_seq') INTO v_seq_val;
    SELECT to_char(NOW(), 'YYYY')              INTO v_year;
    RETURN '6K-' || v_year || '-' || lpad(v_seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Notes:
--   • The sequence (order_number_seq) already exists from the initial schema.
--     It continues from wherever it left off — no gaps, no duplicates.
--   • 5-digit zero-padding supports up to 99,999 orders before overflow.
--     Increase lpad width to 6 for 999,999 orders if ever needed.
--   • to_char(NOW(), 'YYYY') uses the server timezone. Supabase defaults to UTC.
--   • Old orders retain their STK-2026-XXXXXX IDs (no backfill needed).
--     New orders from this point forward will receive 6K-YYYY-NNNNN IDs.
-- ---------------------------------------------------------------------------
