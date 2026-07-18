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

**Deployment is complete.**

---

## Rollback Procedure

If any step above fails in production after Step 4 (deploy):

1. **Revert the deployment** in your hosting dashboard (Vercel → Deployments → Previous deployment → Promote).
2. If payment data was written to the database, **do not roll back migrations** — only roll back application code.
3. Investigate the failure using the detailed logs in `/api/health` and Supabase logs.
4. Fix the root cause, re-run this runbook from Step 1.

---

## Adding New Database Columns

When any developer adds a column in a migration that is immediately written by the application:

1. Append the column name to `ORDERS_CRITICAL_COLUMNS` or `PAYMENTS_CRITICAL_COLUMNS` in [`scripts/validate-schema.ts`](file:///c:/7s%20inter%20folder/stitch_6k_production_ready_v2/scripts/validate-schema.ts) in the **same PR as the migration**.
2. Add the column name to the `criticalColumns` array in [`lib/health.ts`](file:///c:/7s%20inter%20folder/stitch_6k_production_ready_v2/lib/health.ts) `checkDatabase()`.
3. Follow this runbook for the production deployment, paying special attention to Steps 2 and 3.

---

*Last updated: July 2026 · Payment Architecture: Production-Ready*
