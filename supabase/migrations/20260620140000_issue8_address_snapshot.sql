-- Issue #8: Add address_snapshot JSONB column to orders.
-- Captures the full delivery address at checkout time so dispatch
-- never resolves by name-matching or falls back to any is_default
-- address in the system.
--
-- The snapshot includes all UserAddress fields plus the customer's
-- email (pulled from profiles at checkout for Shiprocket notifications).
-- Stored as JSONB so schema changes to UserAddress don't require
-- a migration — the snapshot is immutable at the time of purchase.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS address_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_address_snapshot_postal
  ON public.orders ((address_snapshot->>'postal_code'))
  WHERE address_snapshot IS NOT NULL;
