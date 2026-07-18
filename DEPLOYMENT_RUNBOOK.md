# Stitch 6K — Production Deployment Runbook

**Version:** 1.0 · **Maintained by:** Engineering Lead  
**Applies to:** Every production deployment that includes database migrations or payment logic changes.

---

> [!IMPORTANT]
> This runbook is **mandatory** for every deployment. Do not skip steps. Each checkpoint must pass before proceeding to the next.

---

## Pre-Deployment Checklist

Before starting, confirm the following:

- [ ] All PRs merged to `main` and CI pipeline passes (TypeScript, schema validation, E2E).
- [ ] Migration SQL reviewed by at least one team member.
- [ ] Razorpay test keys active in `.env.local` for sandbox smoke test.
- [ ] Worker process (`npm run worker`) accessible and will be restarted post-deploy.

---

## Step 1 — Apply Database Migrations

### 1a. Push migrations to production

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

> **Hosted Supabase (no local Docker):** Apply migrations via the Supabase Dashboard → SQL Editor, or via the Supabase CLI linked to your production project.

### 1b. Verify migrations completed successfully

Open **Supabase Dashboard → Database → Migrations** and confirm the latest migration timestamp appears in the applied list.

Or run this query in the SQL Editor:

```sql
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY executed_at DESC
LIMIT 5;
```

**Expected:** The most recent migration file appears with a non-null `executed_at`.

> [!CAUTION]
> If any migration shows a failure or is missing, **stop immediately**. Do not proceed to Step 2. Roll back or re-apply the migration and confirm success before continuing.

---

## Step 2 — Refresh PostgREST Schema Cache

After every migration that adds new columns, the PostgREST API layer must reload its schema cache.  
**This is the step that previously caused the `PGRST204` payment failure bug.**

### 2a. Reload cache (hosted Supabase)

Open **Supabase Dashboard → SQL Editor** and run:

```sql
NOTIFY pgrst, 'reload schema';
```

This sends a reload signal to the PostgREST process. It is instantaneous and safe to run at any time.

### 2b. Verify the reload took effect

Wait 5 seconds, then run:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'payment_processing_state';
```

**Expected:** One row returned. If zero rows, the migration did not apply — revisit Step 1.

---

## Step 3 — Run Schema Validation Script

```bash
npx tsx scripts/validate-schema.ts
```

This script queries both `orders` and `payments` tables through the PostgREST API using the service role key and confirms every payment-critical column is visible in the schema cache.

**Expected output:**

```
[validate-schema] Verifying Supabase PostgREST schema cache...

[validate-schema] OK 'orders'   -- 13 critical columns confirmed in schema cache.
[validate-schema] OK 'payments' -- 8 critical columns confirmed in schema cache.

[validate-schema] ALL CHECKS PASSED -- safe to deploy application code.
```

> [!WARNING]
> If `SCHEMA GAP` appears in the output, **do not deploy**. The PostgREST cache did not reload correctly. Re-run Step 2a and retry this step.

---

## Step 4 — Deploy Application Code

Deploy the Next.js application to your hosting provider (Vercel, Railway, etc.):

```bash
git push origin main
# or trigger deployment via the hosting dashboard
```

Wait for the deployment to be marked **Live / Ready** before proceeding.

---

## Step 5 — Verify `/api/health`

Once the deployment is live, call the health endpoint:

```bash
curl -s https://your-domain.com/api/health | jq .
```

**Expected:** All critical services report `"status": "healthy"`. Pay particular attention to `database`:

```json
{
  "database": { "status": "healthy", "error": null },
  "redis":    { "status": "healthy" },
  "email":    { "status": "healthy" }
}
```

> [!WARNING]
> If `database` reports `"status": "unhealthy"` with a `PGRST204` message, the schema cache did not reload. Return to Step 2 and reload the schema before allowing production traffic.

---

## Step 6 — Razorpay Sandbox Payment Smoke Test

This is the **single most important end-to-end verification**. Perform it manually after every payment-related deployment.

### 6a. Place a test order via Razorpay

1. Open your production URL in an incognito browser window.
2. Add any product to the cart.
3. Proceed to checkout. Select a shipping address.
4. Choose **Pay with Razorpay** (not wallet).
5. Click **Pay Now**. The Razorpay modal must open.
6. Use Razorpay test card:
   - **Card number:** `4111 1111 1111 1111`
   - **Expiry:** Any future date
   - **CVV:** Any 3 digits
   - **OTP:** `1234`
7. Complete the payment.

**Expected UX:** After successful payment, the user is redirected to the **Order Confirmed** page (not Payment Declined).

### 6b. Record the order ID and payment ID

Note the `6K-RPO-XXXXX` order ID displayed on the Order Confirmed page.

---

## Step 7 — Verify Post-Payment State

Use the following SQL queries in the Supabase SQL Editor to verify every subsystem processed correctly. Replace `'YOUR-ORDER-ID'` with the order ID from Step 6b.

### 7a. Order created and payment verified

```sql
SELECT id, status, payment_status, razorpay_order_id, razorpay_payment_id
FROM orders
WHERE id = 'YOUR-ORDER-ID';
```

**Expected:**

| id | status | payment_status | razorpay_order_id | razorpay_payment_id |
|----|--------|---------------|-------------------|---------------------|
| 6K-RPO-XXXXX | Paid | Paid | order_XXXXX | pay_XXXXX |

---

### 7b. Webhook processed

```sql
SELECT id, status, razorpay_payment_id
FROM payments
WHERE order_id = 'YOUR-ORDER-ID';
```

**Expected:** `status = 'CAPTURED'` and `razorpay_payment_id` is populated.

---

### 7c. Inventory updated (stock deducted)

```sql
SELECT oi.product_id, oi.size, oi.quantity_reserved, v.stock
FROM order_items oi
JOIN variants v ON v.product_id = oi.product_id AND v.size = oi.size
WHERE oi.order_id = 'YOUR-ORDER-ID';
```

**Expected:** `quantity_reserved = 0` (reservation released after confirmed payment) and `stock` reflects deduction.

---

### 7d. Email queued

```sql
SELECT type, status, created_at
FROM email_logs
WHERE metadata->>'orderId' = 'YOUR-ORDER-ID'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** At least one row with `type = 'order_confirmation'` and `status = 'sent'` or `'queued'`.

---

### 7e. Recovery worker is idle

The payment recovery worker sweeps for stuck `Payment Pending` orders every 15 minutes. Verify your completed test order is **not** in its scan window:

```sql
SELECT id, status, created_at
FROM orders
WHERE status = 'Payment Pending'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

**Expected:** Zero rows. If your test order appears here, the payment verification failed silently and the recovery worker may cancel it.

---

### 7f. Idempotency verification — exactly-once guarantees

Immediately after confirming Steps 7a–7e, perform a duplicate-trigger test to validate that every post-payment side-effect fired **exactly once**.

#### 7f-i. Reload the Order Confirmed page

Refresh the Order Confirmed page 2–3 times. The page should render the same order without triggering any new actions.

#### 7f-ii. Verify no duplicate payments or orders

```sql
SELECT order_id, COUNT(*) AS payment_count
FROM payments
WHERE order_id = 'YOUR-ORDER-ID'
GROUP BY order_id;
```

**Expected:** Exactly `1` row with `payment_count = 1`.

```sql
SELECT idempotency_key, COUNT(*) AS order_count
FROM orders
WHERE idempotency_key = (
  SELECT idempotency_key FROM orders WHERE id = 'YOUR-ORDER-ID'
)
GROUP BY idempotency_key;
```

**Expected:** Exactly `1` row with `order_count = 1`. A count > 1 means the idempotency key failed.

#### 7f-iii. Verify no duplicate inventory deductions

```sql
SELECT product_id, size, SUM(quantity) AS total_deducted
FROM inventory_transactions
WHERE order_id = 'YOUR-ORDER-ID'
GROUP BY product_id, size;
```

**Expected:** Each (product, size) appears **once**. If any row shows `total_deducted > quantity_ordered`, deduction fired multiple times.

#### 7f-iv. Verify no duplicate emails

```sql
SELECT type, COUNT(*) AS send_count
FROM email_logs
WHERE metadata->>'orderId' = 'YOUR-ORDER-ID'
GROUP BY type;
```

**Expected:** `order_confirmation` appears at most once. Multiple rows indicate duplicate job execution.

#### 7f-v. Verify no duplicate loyalty or wallet credits

```sql
-- Loyalty: check for duplicate credit events
SELECT idempotency_key, COUNT(*) AS event_count
FROM loyalty_transactions
WHERE idempotency_key LIKE '%' || 'YOUR-ORDER-ID' || '%'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;

-- Wallet: check for duplicate credit events
SELECT idempotency_key, COUNT(*) AS event_count
FROM wallet_transactions
WHERE idempotency_key LIKE '%' || 'YOUR-ORDER-ID' || '%'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```

**Expected:** Zero rows returned from both queries.

> [!CAUTION]
> If any idempotency check fails, stop immediately. This indicates the BullMQ deduplication key or the atomic claim guard has been bypassed. Do not mark the deployment complete — investigate payment-processing.ts and the atomic_claim_payment RPC.

---

## Step 8 — Mark Deployment Complete

Only when **all** of the following are confirmed:

- [ ] Step 1: Migrations applied and verified.
- [ ] Step 2: PostgREST schema cache reloaded.
- [ ] Step 3: `validate-schema.ts` reports ALL CHECKS PASSED.
- [ ] Step 4: Application deployed and live.
- [ ] Step 5: `/api/health` returns `database: healthy`.
- [ ] Step 6: Razorpay sandbox payment completes successfully → Order Confirmed page.
- [ ] Step 7a: Order status = `Paid`, payment ID present.
- [ ] Step 7b: Payment record status = `CAPTURED`.
- [ ] Step 7c: Inventory stock updated.
- [ ] Step 7d: Order confirmation email queued/sent.
- [ ] Step 7e: Recovery worker queue is empty.
- [ ] Step 7f: All idempotency checks pass — zero duplicates across payments, orders, inventory, emails, loyalty, and wallet.

**Deployment is complete.**

---

## Rollback Decision Tree

Use this decision tree to determine the correct response to any deployment failure. **Never guess — always follow the tree.**

---

### Scenario A — Migration failed (Step 1)

> Migration did not apply cleanly. Application code has not been deployed yet.

**Actions:**
1. **Do not deploy application code.** The database is in an inconsistent state.
2. Check Supabase logs for the specific SQL error.
3. If the migration is partially applied, write a **forward-fix migration** (do not attempt a raw rollback — this risks data loss).
4. Apply the forward-fix migration and re-run Step 1.
5. Restart the runbook from Step 1 once migrations are clean.

**Traffic:** No impact — application code was not deployed. Existing production is untouched.

**Migration reversibility:**
- `ADD COLUMN IF NOT EXISTS` → Reversible with `DROP COLUMN`. Safe if no data was written.
- `CREATE INDEX` → Reversible with `DROP INDEX`. Always safe.
- `ADD CONSTRAINT` / `UNIQUE` → Reversible with `DROP CONSTRAINT`. Safe if no violations exist.
- Data migrations (UPDATE/INSERT) → **Not reversible.** Write a compensating migration instead.

---

### Scenario B — Schema validation failed (Step 3)

> Migrations applied but PostgREST cache did not reload. Application code has not been deployed yet.

**Actions:**
1. **Do not deploy application code.**
2. Run in Supabase SQL Editor: `NOTIFY pgrst, 'reload schema';`
3. Wait 10 seconds.
4. Re-run `npx tsx scripts/validate-schema.ts`.
5. If it now passes, proceed with Step 4 (deploy).
6. If it still fails after 3 reload attempts, contact Supabase support — the PostgREST process may need a restart via the dashboard.

**Traffic:** No impact — application code was not deployed.

---

### Scenario C — Deployment succeeded but `/api/health` failed (Step 5)

> Application is live but reports database or schema errors.

**Actions:**
1. **Halt production traffic immediately** if the error is `database: unhealthy` or `PGRST204`. Route traffic back to the previous deployment:
   - Vercel: Dashboard → Deployments → Previous → **Promote to Production**.
2. Re-run schema cache reload (Step 2) and `validate-schema.ts` (Step 3) against the production database.
3. Once health check passes on the previous build, investigate the new build's error before re-deploying.
4. **Do not roll back migrations** — database changes are forward-only. Only application code is reverted.

**Should traffic be stopped?** YES — a failing database health check means payment writes will fail silently.

---

### Scenario D — Health check passed but sandbox payment smoke test failed (Step 6 or 7)

> Application is live and healthy, but the end-to-end payment flow is broken.

**Sub-case D1 — Razorpay modal did not open:**
- Likely cause: `NEXT_PUBLIC_RAZORPAY_KEY_ID` is missing or wrong in the production environment.
- Action: Fix the environment variable. Redeploy. Re-run from Step 6. No rollback needed.

**Sub-case D2 — Modal opened but user was redirected to Payment Declined:**
- Likely cause: `razorpay_order_id` was not saved (PGRST204 regression) or HMAC signature mismatch.
- Action: **Halt production traffic** (promote previous deployment). Re-run schema validation. Investigate `/api/payments/verify` logs in Supabase.

**Sub-case D3 — Order Confirmed shown but DB state is wrong (7a–7e):**
- Likely cause: BullMQ worker not running, or webhook is not being received.
- Action: Restart the worker process (`npm run worker`). Check webhook URL registration in Razorpay dashboard. Do not roll back application.

**Sub-case D4 — Idempotency check failed (Step 7f):**
- Likely cause: `atomic_claim_payment` RPC was bypassed, or BullMQ job deduplication key was changed.
- Action: **Halt production traffic immediately.** This is a financial integrity failure. Investigate `payment-processing.ts` and the RPC. Do not resolve by re-running the runbook — this requires an engineering fix.

---

### When to stop production traffic

| Failure | Stop Traffic? |
|---------|---------------|
| Migration failed | No (app not deployed) |
| Schema validation failed | No (app not deployed) |
| Health check: database unhealthy | **Yes** |
| Health check: PGRST204 error | **Yes** |
| Smoke test: Razorpay modal fails | No (investigate env vars first) |
| Smoke test: Payment Declined after success | **Yes** |
| Idempotency check fails | **Yes** |

---

## Adding New Database Columns

When any developer adds a column in a migration that is immediately written by the application:

1. Append the column name to `ORDERS_CRITICAL_COLUMNS` or `PAYMENTS_CRITICAL_COLUMNS` in [`scripts/validate-schema.ts`](file:///c:/7s%20inter%20folder/stitch_6k_production_ready_v2/scripts/validate-schema.ts) in the **same PR as the migration**.
2. Add the column name to the `criticalColumns` array in [`lib/health.ts`](file:///c:/7s%20inter%20folder/stitch_6k_production_ready_v2/lib/health.ts) `checkDatabase()`.
3. Follow this runbook for the production deployment, paying special attention to Steps 2 and 3.

---

*Last updated: July 2026 · Payment Architecture: Production-Ready · Deployment Operations: Production-Ready*
