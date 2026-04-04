/**
 * Column names for migrated `shop.db` → Postgres.
 * Defaults match this repo's `jobs/` (order_datetime, order_total).
 * Override in `.env.local` if your migration uses Chapter 17 names instead.
 */
export const ORDERS_TIME_COL =
  process.env.ORDERS_TIME_COL ?? "order_datetime";
export const ORDERS_TOTAL_COL =
  process.env.ORDERS_TOTAL_COL ?? "order_total";
/** Set `ORDERS_HAS_FULFILLED=true` only if your `orders` table has a `fulfilled` column */
export const ORDERS_HAS_FULFILLED =
  process.env.ORDERS_HAS_FULFILLED === "true";
