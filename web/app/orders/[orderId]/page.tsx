import Link from "next/link";
import { getOrderLineItems, productLabel } from "@/lib/queries/shop";

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const oid = Number.parseInt(orderId, 10);
  if (Number.isNaN(oid)) {
    return (
      <main className="page">
        <h1 className="page-heading">Order</h1>
        <p className="text-muted">Invalid order id.</p>
      </main>
    );
  }

  const rows = await getOrderLineItems(oid);

  return (
    <main className="page">
      <h1 className="page-heading">Order #{orderId}</h1>
      <p className="text-muted-block">Line items from the database.</p>

      {rows.length === 0 ? (
        <p className="text-muted">No line items for this order.</p>
      ) : (
        <ul className="stack">
          {rows.map(({ line, product }, i) => {
            const qty = Number(line.quantity ?? line.qty ?? 0);
            const unit = Number(line.unit_price ?? line.price ?? 0);
            return (
              <li key={`${line.product_id}-${i}`} className="order-line">
                <span>
                  {(product ? productLabel(product) : `Product #${line.product_id}`)}{" "}
                  × {qty}
                </span>
                <span>${(qty * unit).toFixed(2)}</span>
              </li>
            );
          })}
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
