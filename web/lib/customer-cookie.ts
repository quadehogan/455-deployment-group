/**
 * Reads the `customer_id` cookie set on `/select-customer`.
 * Call from `useEffect` (or after click) so `document` exists — not during SSR.
 */
export function readCustomerIdFromCookie(): number | null {
  const match = document.cookie.match(/(?:^|;\s*)customer_id=(\d+)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}
