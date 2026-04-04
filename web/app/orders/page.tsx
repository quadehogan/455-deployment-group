import Link from "next/link";
import { cookies } from "next/headers";
import {
  listOrdersForCustomer,
  orderTime,
  orderTotal,
} from "@/lib/queries/shop";

export default async function OrdersPage() {
  const raw = (await cookies()).get("customer_id")?.value;
  const customerId = raw != null ? Number.parseInt(raw, 10) : NaN;

  if (raw == null || Number.isNaN(customerId)) {
    return (
      <main className="page">
        <h1 className="page-heading">Order history</h1>
        <p className="text-muted">
          No customer selected.{" "}
          <Link href="/select-customer" className="link">
            Choose a customer
          </Link>
          .
        </p>
      </main>
    );
  }

  const orders = await listOrdersForCustomer(customerId);

  return (
    <main className="page">
      <h1 className="page-heading">Order history</h1>

      {orders.length === 0 ? (
        <p className="text-muted">No orders yet for this customer.</p>
      ) : (
        <ul className="stack">
          {orders.map((o) => (
            <li key={o.order_id}>
              <Link href={`/orders/${o.order_id}`} className="link-card">
                <span className="order-title">Order #{o.order_id}</span>
                <span className="order-meta">
                  {" "}
                  · {orderTime(o) || "—"} · ${orderTotal(o).toFixed(2)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
