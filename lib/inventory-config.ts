/**
 * INVENTORY CONFIGURATION — Single Source of Truth
 *
 * All stock threshold logic across the application MUST import from here.
 * Never hardcode stock thresholds directly in components or services.
 *
 * Changing a value here automatically updates every consumer.
 */

/**
 * Products with a total variant-derived stock AT or BELOW this value
 * are flagged as "Low Stock" across the storefront and admin panels.
 */
export const LOW_STOCK_THRESHOLD = 10;

/**
 * Per-size stock AT or BELOW this value shows a warning dot
 * on the size selection button on the product detail page.
 */
export const LOW_STOCK_SIZE_THRESHOLD = 5;

/**
 * Per-size stock AT or BELOW this value triggers the urgent red
 * warning banner: "Only X left in size Y! Order soon."
 */
export const URGENT_STOCK_THRESHOLD = 3;

/**
 * Redis / in-memory cache TTL (seconds) for individual product slug lookups.
 * Must be LESS THAN the Next.js ISR `revalidate` value (currently 60 s)
 * so that Redis is never the stale layer blocking an ISR regeneration.
 */
export const PRODUCT_CACHE_TTL_SECS = 55;

/**
 * Redis / in-memory cache TTL (seconds) for product list queries
 * (admin ledger, storefront listing pages, etc.).
 */
export const PRODUCT_LIST_CACHE_TTL_SECS = 55;

/**
 * Maximum discount amount (INR) allowed on percentage coupons.
 * Prevents over-discounting on luxury orders.
 */
export const MAX_COUPON_DISCOUNT_INR = 5000;
