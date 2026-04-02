import Link from "next/link";
import { MOCK_ORDER_LINES } from "@/lib/mock-data";

type Props = {
  params: Promise<{ orderId: string }>;
};

/**
 * Order detail: line items for one `order_id`.
 * Server component — no cookie needed; we only need the URL param.
 */
export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const lines = MOCK_ORDER_LINES[orderId] ?? [];

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Order #{orderId}</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Line items (demo — from mock data keyed by order id).
      </p>

      {lines.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No line items in the demo for this order.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((row, i) => (
            <li
              key={`${row.product}-${i}`}
              className="flex justify-between rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              <span>
                {row.product} × {row.qty}
              </span>
              <span>{row.lineTotal}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link href="/orders" className="underline">
          ← Back to order history
        </Link>
      </p>
    </main>
  );
}
