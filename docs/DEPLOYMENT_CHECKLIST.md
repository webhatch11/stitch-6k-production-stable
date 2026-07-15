# Stitch 6K Deployment Checklist

## Required SQL RPCs (must exist in Supabase)
Run this SQL query in the Supabase SQL Editor to verify all required RPC functions exist:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'get_next_order_sequence',
  'coupon_atomic_increment', 
  'coupon_atomic_decrement',
  'wallet_atomic_debit',
  'wallet_atomic_credit',
  'loyalty_atomic_credit',
  'loyalty_atomic_debit',
  'loyalty_atomic_expire_user',
  'atomic_checkout_rollback',
  'get_dashboard_aggregates'
)
ORDER BY routine_name;
```

**Expected Result:** 10 rows returned.
If any are missing, run the relevant migration file listed below to create it.

## Required Migrations (run in order)
Apply the database migrations in this exact order to build the schema, constraints, indexes, and custom RPC functions:

1. `lib/migrations/20260619181019_initial_schema.sql`
2. `lib/migrations/20260712_loyalty_expire_atomic.sql`
3. `lib/migrations/20260713_order_id_sequence.sql`
4. `lib/migrations/20260714_shipment_label_manifest.sql`
5. `lib/migrations/20260714_product_reorder_point.sql`
6. `lib/migrations/20260714_points_credit_status.sql`
7. `lib/migrations/20260714_coupon_atomic_decrement.sql`
8. `lib/migrations/20260714_fix_wallet_default.sql`
9. `lib/migrations/20260715_order_workflow.sql`
10. `lib/migrations/20260715_checkout_transaction.sql`

## Required Environment Variables
Configure the following keys in your production environment variables (e.g. `.env.local` or host dashboard):

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` *(Server-only; bypasses RLS)*

### Razorpay (Payments)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET` *(For validating capture webhooks)*

### Cloudinary (Media assets)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Upstash Redis (Rate limiting)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Redis / BullMQ (Background jobs)
- `REDIS_URL`

### Resend (Transactional Email)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Shiprocket (Shipping & Logistics)
- `SHIPROCKET_EMAIL`
- `SHIPROCKET_PASSWORD`
- `SHIPROCKET_PICKUP_LOCATION`
- `SHIPROCKET_WEBHOOK_TOKEN` *(Pre-shared key to validate tracking callbacks)*
- `SHIPROCKET_PICKUP_PINCODE`

### Admin Access
- `ADMIN_EMAILS` *(Comma-separated list of emails permitted to access /admindashboard)*

### Site Configuration
- `NEXT_PUBLIC_SITE_URL` *(Canonical URL, e.g. https://the6k.com)*

### Error Monitoring (Sentry)
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`

### Support & Store Details
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_SUPPORT_PHONE`
- `SHIPROCKET_PICKUP_PHONE`

### Feature Flags & Development Toggles
- `DISABLE_REDIS_CACHE` *(Set to true/false)*
- `ENABLE_DEV_TEST_ACTIONS` *(Must be false in production)*
- `IS_WORKER` *(Must be true ONLY on the background worker process; false on web process)*
- `NEXT_PUBLIC_ENABLE_MOCK_SHIPPING` *(Must be false in production)*

### Google Analytics & Advertising
- `NEXT_PUBLIC_GOOGLE_ADS_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_LABEL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `GA4_API_SECRET`
- `NEXT_PUBLIC_GTM_ID`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `META_CONVERSIONS_API_TOKEN`

## Pre-deploy Verification
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` passes with zero errors
- [ ] All 10 RPCs verified in Supabase
- [ ] All 10 migration files run in order
- [ ] Upstash/Redis request quota limit verified and not exceeded
- [ ] Real Shiprocket credentials set in environment variables
- [ ] Razorpay webhook URL updated to production `/api/webhooks/razorpay` in Dashboard
- [ ] Shiprocket webhook URL updated to production `/api/webhooks/shiprocket` in Dashboard
