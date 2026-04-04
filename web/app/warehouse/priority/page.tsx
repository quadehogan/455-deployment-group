import Link from "next/link";
import { getPriorityQueue } from "@/lib/queries/priority-queue";

/**
 * Late delivery priority queue: orders with predictions, sorted by probability.
 * Uses raw SQL via `DATABASE_URL` (see `lib/db.ts`).
 */
export default async function WarehousePriorityPage() {
  let rows: Awaited<ReturnType<typeof getPriorityQueue>> = [];
  let loadError: string | null = null;
  try {
    rows = await getPriorityQueue();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load queue";
  }

  return (
    <main className="page-wide">
      <h1 className="page-heading">Late delivery priority queue</h1>
      <p className="text-muted-block">
        Orders with predictions, sorted by{" "}
        <code className="inline-code">late_delivery_probability</code> (highest
        first).
      </p>

      {loadError && (
        <p className="message-box" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && rows.length === 0 && (
        <p className="text-muted">
          No scored orders yet. Run inference (jobs or Run scoring) so{" "}
          <code className="inline-code">order_predictions</code> has rows.
        </p>
      )}

      {!loadError && rows.length > 0 && (
        <ul className="stack">
          {rows.map((row) => (
            <li key={row.order_id}>
              <div className="order-line">
                <span>
                  <Link href={`/orders/${row.order_id}`} className="link">
                    Order #{row.order_id}
                  </Link>
                  {" · "}
                  {row.customer_name || "—"}
                </span>
                <span>
                  P(late) {(row.late_delivery_probability ?? 0).toFixed(2)}
                  {" · "}
                  {row.order_time != null
                    ? String(row.order_time)
                    : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="footer-hint">
        After inference runs, refresh this page.{" "}
        <Link href="/scoring" className="link">
          Run scoring
        </Link>
      </p>
    </main>
  );
}
