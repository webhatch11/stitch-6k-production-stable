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

## Required Database Migrations
Database changes, schema modifications, and custom stored procedures/functions (RPCs) are managed natively via the standard Supabase CLI migrations system located in `supabase/migrations/`.

To apply all migrations to your environment, use the standard Supabase CLI command from the repository root:

```bash
# Push migrations to the linked remote database
supabase db push
```

If you are setting up a local development environment:
```bash
# Reset local database and apply all migrations and seeds
supabase db reset
```

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
- `BREVO_FROM_EMAIL`

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
- [ ] All required RPCs verified in Supabase
- [ ] Database migrations applied successfully via `supabase db push`
- [ ] Upstash/Redis request quota limit verified and not exceeded
- [ ] Real Shiprocket credentials set in environment variables
- [ ] Razorpay webhook URL updated to production `/api/webhooks/razorpay` in Dashboard
- [ ] Shiprocket webhook URL updated to production `/api/webhooks/shiprocket` in Dashboard
