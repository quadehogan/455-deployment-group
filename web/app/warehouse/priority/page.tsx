import Link from "next/link";
import { MOCK_PRIORITY_QUEUE } from "@/lib/mock-data";

/**
 * Late delivery priority queue: top unfulfilled orders by predicted late probability.
 * Demo uses static rows; real app runs the SQL from `frontend.md` (LIMIT 50).
 */
export default function WarehousePriorityPage() {
  return (
    <main className="page-wide">
      <h1 className="page-heading">Late delivery priority queue</h1>
      <p className="text-muted-block">
        Unfulfilled orders sorted by{" "}
        <code className="inline-code">late_delivery_probability</code> descending (demo
        data).
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>P(late)</th>
              <th>Order time</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PRIORITY_QUEUE.map((row) => (
              <tr key={row.orderId}>
                <td>
                  <Link href={`/orders/${row.orderId}`} className="link">
                    #{row.orderId}
                  </Link>
                </td>
                <td>{row.customerName}</td>
                <td>{row.lateDeliveryProbability.toFixed(2)}</td>
                <td>{row.orderTimestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="footer-hint">
        After inference runs, refresh this page to see updated scores.{" "}
        <Link href="/scoring" className="link">
          Run scoring
        </Link>
      </p>
    </main>
  );
}
