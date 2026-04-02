"use client";
// Dashboard shows counts and recent orders for whoever is in the `customer_id` cookie.

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCustomerIdFromCookie } from "@/lib/customer-cookie";
import { CUSTOMERS, MOCK_ORDERS } from "@/lib/mock-data";

export default function DashboardPage() {
  const [ready, setReady] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);

  useEffect(() => {
    setCustomerId(readCustomerIdFromCookie());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="page">
        <h1 className="page-heading">Dashboard</h1>
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  if (customerId === null) {
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

  const name = CUSTOMERS.find((c) => c.id === customerId)?.name ?? "Customer";
  const orders = MOCK_ORDERS[customerId] ?? [];
  // “Recent” = last 3 for demo; real app would ORDER BY date LIMIT 3.
  const recent = orders.slice(-3).reverse();

  // Parse dollar totals for a fake “total spend” (sum of mock strings — demo only).
  const totalSpend = orders
    .reduce((sum, o) => sum + Number.parseFloat(o.total.replace(/[^0-9.]/g, "") || "0"), 0)
    .toFixed(2);

  return (
    <main className="page">
      <h1 className="page-heading">Dashboard</h1>
      <p className="text-muted-block">
        Signed in as <strong>{name}</strong> (demo — no password).
      </p>

      {/* Summary cards: replace with SQL aggregates later */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{orders.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total spend (demo)</div>
          <div className="stat-value">${totalSpend}</div>
        </div>
      </div>

      <h2 className="section-heading">Recent orders</h2>
      {recent.length === 0 ? (
        <p className="text-muted">No orders yet.</p>
      ) : (
        <ul className="stack">
          {recent.map((o) => (
            <li key={o.orderId}>
              <Link href={`/orders/${o.orderId}`} className="link-card-soft">
                #{o.orderId} · {o.placedAt} · {o.total}
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
