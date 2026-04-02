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
    <main className="page">
      <h1 className="page-heading">Order #{orderId}</h1>
      <p className="text-muted-block">
        Line Items
      </p>

      {lines.length === 0 ? (
        <p className="text-muted">No Line Items</p>
      ) : (
        <ul className="stack">
          {lines.map((row, i) => (
            <li key={`${row.product}-${i}`} className="order-line">
              <span>
                {row.product} × {row.qty}
              </span>
              <span>{row.lineTotal}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="footer-links">
        <Link href="/orders" className="link">
          ← Back to order history
        </Link>
      </p>
    </main>
  );
}
