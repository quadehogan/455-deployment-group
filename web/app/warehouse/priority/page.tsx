import Link from "next/link";
import { MOCK_PRIORITY_QUEUE } from "@/lib/mock-data";

/**
 * Late delivery priority queue: top unfulfilled orders by predicted late probability.
 * Demo uses static rows; real app runs the SQL from `frontend.md` (LIMIT 50).
 */
export default function WarehousePriorityPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Late delivery priority queue</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Unfulfilled orders sorted by <code className="text-xs">late_delivery_probability</code>{" "}
        descending (demo data).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-600">
              <th className="py-2 pr-4 font-medium">Order</th>
              <th className="py-2 pr-4 font-medium">Customer</th>
              <th className="py-2 pr-4 font-medium">P(late)</th>
              <th className="py-2 font-medium">Order time</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PRIORITY_QUEUE.map((row) => (
              <tr
                key={row.orderId}
                className="border-b border-zinc-200 dark:border-zinc-700"
              >
                <td className="py-2 pr-4">
                  <Link href={`/orders/${row.orderId}`} className="underline">
                    #{row.orderId}
                  </Link>
                </td>
                <td className="py-2 pr-4">{row.customerName}</td>
                <td className="py-2 pr-4">{row.lateDeliveryProbability.toFixed(2)}</td>
                <td className="py-2">{row.orderTimestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        After inference runs, refresh this page to see updated scores.{" "}
        <Link href="/scoring" className="underline">
          Run scoring
        </Link>
      </p>
    </main>
  );
}
