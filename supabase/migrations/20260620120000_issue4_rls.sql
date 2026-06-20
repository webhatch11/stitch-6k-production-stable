-- Issue #4: Row Level Security policies for all tables
-- Migration is idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
--
-- Access patterns:
--   A  USER-OWNED       USING (user_id = auth.uid() OR public.is_admin())
--   B  PUBLIC-READ      SELECT to anon+authenticated; writes to admin only
--   C  ADMIN-ONLY       SELECT/write restricted to public.is_admin()
--   D  SERVICE-ONLY     RLS enabled, zero policies → only service role can access
--
-- Tables in scope (17):
--   profiles, products, product_variants, coupons,
--   orders, wallet_transactions, loyalty_transactions,
--   order_status_history, inventory_reservations,
--   payments, payment_logs, webhook_logs,
--   shipments, shipment_events, tracking_logs,
--   payment_audit_logs, order_events
--
-- Out of scope (no CREATE TABLE in schema yet):
--   addresses, inventory_audit_logs

-- ---------------------------------------------------------------------------
-- 0. Helper: public.is_admin()
--    SECURITY DEFINER so it bypasses RLS when it queries profiles,
--    preventing infinite recursion in the profiles policies themselves.
--    SET search_path = public guards against search_path injection.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles  [A — USER-OWNED]
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- No INSERT policy: the handle_new_user trigger (SECURITY DEFINER) creates rows.
-- No DELETE policy: cascades from auth.users deletion via FK.

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (name, phone, email) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. products  [B — PUBLIC-READ]
-- ---------------------------------------------------------------------------

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
  ON public.products
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin"
  ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin"
  ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin"
  ON public.products
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. product_variants  [B — PUBLIC-READ]
--    Stock deductions happen via service role (deductStock server action).
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
CREATE POLICY "product_variants_select_public"
  ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_variants_insert_admin" ON public.product_variants;
CREATE POLICY "product_variants_insert_admin"
  ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_variants_update_admin" ON public.product_variants;
CREATE POLICY "product_variants_update_admin"
  ON public.product_variants
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_variants_delete_admin" ON public.product_variants;
CREATE POLICY "product_variants_delete_admin"
  ON public.product_variants
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. coupons  [D — SERVICE-ONLY]
--    All validation happens server-side via service role.
--    No policies → RLS default-deny blocks anon + authenticated.
-- ---------------------------------------------------------------------------

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. orders  [A — USER-OWNED]
--    INSERT/UPDATE/DELETE are server-side only (service role bypasses RLS).
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own"
  ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. wallet_transactions  [A — USER-OWNED, immutable ledger]
--    All inserts go through wallet_atomic_debit/credit (SECURITY DEFINER)
--    or service role. No client writes permitted.
-- ---------------------------------------------------------------------------

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_transactions_select_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_select_own"
  ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. loyalty_transactions  [A — USER-OWNED, immutable ledger]
-- ---------------------------------------------------------------------------

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_transactions_select_own" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions_select_own"
  ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. order_status_history  [A — USER-OWNED via join]
--    No direct user_id column; ownership derived from orders.user_id.
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_status_history_select_own" ON public.order_status_history;
CREATE POLICY "order_status_history_select_own"
  ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 9. inventory_reservations  [C — ADMIN-ONLY]
--    Internal reservation engine; customers have no reason to query this.
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_reservations_select_admin" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations_select_admin"
  ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "inventory_reservations_insert_admin" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations_insert_admin"
  ON public.inventory_reservations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "inventory_reservations_update_admin" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations_update_admin"
  ON public.inventory_reservations
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "inventory_reservations_delete_admin" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations_delete_admin"
  ON public.inventory_reservations
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10. payments  [D — SERVICE-ONLY]
--     Raw Razorpay records. Never accessed from browser.
--     No policies → default-deny for anon + authenticated.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 11. payment_logs  [C — ADMIN-ONLY]
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_logs_select_admin" ON public.payment_logs;
CREATE POLICY "payment_logs_select_admin"
  ON public.payment_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 12. webhook_logs  [C — ADMIN-ONLY]
-- ---------------------------------------------------------------------------

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_logs_select_admin" ON public.webhook_logs;
CREATE POLICY "webhook_logs_select_admin"
  ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 13. shipments  [A — USER-OWNED via join]
--     Ownership derived from orders.user_id via order_id FK.
-- ---------------------------------------------------------------------------

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipments_select_own" ON public.shipments;
CREATE POLICY "shipments_select_own"
  ON public.shipments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = shipments.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 14. shipment_events  [A — USER-OWNED via two-level join]
--     shipment_events → shipments → orders → user_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipment_events_select_own" ON public.shipment_events;
CREATE POLICY "shipment_events_select_own"
  ON public.shipment_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.shipments
      JOIN public.orders ON orders.id = shipments.order_id
      WHERE shipments.id = shipment_events.shipment_id
        AND orders.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 15. tracking_logs  [D — SERVICE-ONLY]
--     Raw Shiprocket API response payloads. Never shown to customers.
-- ---------------------------------------------------------------------------

ALTER TABLE public.tracking_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 16. payment_audit_logs  [C — ADMIN-ONLY]
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_audit_logs_select_admin" ON public.payment_audit_logs;
CREATE POLICY "payment_audit_logs_select_admin"
  ON public.payment_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 17. order_events  [A — USER-OWNED via join]
--     Ownership derived from orders.user_id via order_id FK.
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_events_select_own" ON public.order_events;
CREATE POLICY "order_events_select_own"
  ON public.order_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_events.order_id
        AND orders.user_id = auth.uid()
    )
  );
