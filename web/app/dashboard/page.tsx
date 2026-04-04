import Link from "next/link";
import { cookies } from "next/headers";
import {
  formatCustomerName,
  getCustomerById,
  listOrdersForCustomer,
  orderTime,
  orderTotal,
} from "@/lib/queries/shop";

export default async function DashboardPage() {
  const raw = (await cookies()).get("customer_id")?.value;
  const customerId = raw != null ? Number.parseInt(raw, 10) : NaN;

  if (raw == null || Number.isNaN(customerId)) {
    return (
      <main className="page">
        <h1 className="page-heading">Dashboard</h1>
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

  const customer = await getCustomerById(customerId);
  const orders = await listOrdersForCustomer(customerId);
  const name = customer ? formatCustomerName(customer) : `Customer #${customerId}`;
  const totalSpend = orders.reduce((s, o) => s + orderTotal(o), 0);
  const recent = orders.slice(0, 3);

  return (
    <main className="page">
      <h1 className="page-heading">Dashboard</h1>
      <p className="text-muted-block">
        Signed in as <strong>{name}</strong>.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{orders.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total spend</div>
          <div className="stat-value">${totalSpend.toFixed(2)}</div>
        </div>
      </div>

      <h2 className="section-heading">Recent orders</h2>
      {recent.length === 0 ? (
        <p className="text-muted">No orders yet.</p>
      ) : (
        <ul className="stack">
          {recent.map((o) => (
            <li key={o.order_id}>
              <Link
                href={`/orders/${o.order_id}`}
                className="link-card-soft"
              >
                #{o.order_id} · {orderTime(o) || "—"} · $
                {orderTotal(o).toFixed(2)}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="footer-links">
        <Link href="/orders" className="link">
          All orders
        </Link>
        {" · "}
        <Link href="/place-order" className="link">
          Place order
        </Link>
      </p>
    </main>
  );
}
