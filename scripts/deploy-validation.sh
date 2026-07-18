#!/bin/bash
set -e

echo "?? [Deploy Validation] Starting deployment-readiness pipeline..."

# 1. Apply database migrations
echo "Step 1: Applying database migrations..."
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "?? SUPABASE_DB_URL is not set. Skipping DB migration push step."
else
  npx supabase db push --db-url "$SUPABASE_DB_URL"
  echo "? Migrations applied successfully."
fi

# 2. Reload PostgREST schema cache
echo "Step 2: Refreshing Supabase schema cache..."
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "?? SUPABASE_DB_URL not configured. Skipping raw schema reload query."
else
  npx supabase db execute --db-url "$SUPABASE_DB_URL" --query "NOTIFY pgrst, 'reload schema';"
  echo "? PostgREST schema cache reload signal dispatched."
fi

# 3. Build the application code
echo "Step 3: Compiling application and verifying types..."
npm run build --no-lint || (echo "? Build failed. Aborting deployment." && exit 1)
echo "? Compilation successful."

# 4. Execute the Schema Validation Health Check
echo "Step 4: Executing database health check (schema validation)..."
node -e "
  const { checkDatabase } = require('./dist/lib/health');
  checkDatabase().then(res => {
    if (res.status !== 'healthy') {
      console.error('? Database health check failed:', res.error);
      process.exit(1);
    }
    console.log('? Database health check passed (All critical columns are verified in the schema cache).');
    process.exit(0);
  }).catch(err => {
    console.error('? Diagnostic runtime error:', err);
    process.exit(1);
  });
" || (echo "? Schema validation failed. PostgREST cache is out of sync." && exit 1)

# 5. Run E2E Smoke Tests
echo "Step 5: Running E2E smoke tests..."
npx playwright test e2e/test-checkout.spec.ts --project=chromium || (echo "? E2E checkout smoke test failed. Rolling back..." && exit 1)

echo "?? [Deploy Validation] Deployment-readiness checks PASSED! Safe to route production traffic."

# To reload PostgREST cache on hosted Supabase:
# Run in Supabase SQL editor:
# NOTIFY pgrst, 'reload schema';
