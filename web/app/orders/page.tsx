"use client";
// Client page: we read `customer_id` from `document.cookie` (set on /select-customer).

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCustomerIdFromCookie } from "@/lib/customer-cookie";
import { MOCK_ORDERS } from "@/lib/mock-data";

export default function OrdersPage() {
  // After `ready`, we know the cookie has been read (avoids SSR/flash issues).
  const [ready, setReady] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);

  useEffect(() => {
    setCustomerId(readCustomerIdFromCookie());
    setReady(true);
  }, []);

  const orders = customerId != null ? (MOCK_ORDERS[customerId] ?? []) : [];

  if (!ready) {
    return (
      <main className="page">
        <h1 className="page-heading">Order history</h1>
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="page-heading">Order history</h1>

      {customerId === null && (
        <p className="text-muted">
          No customer selected.{" "}
          <Link href="/select-customer" className="link">
            Choose a customer
          </Link>
          .
        </p>
      )}

      {customerId !== null && orders.length === 0 && (
        <p className="text-muted">No orders yet for this customer.</p>
      )}

      {customerId !== null && orders.length > 0 && (
        <ul className="stack">
          {orders.map((o) => (
            <li key={o.orderId}>
              {/* `/orders/[orderId]` can show line items for this order later */}
              <Link href={`/orders/${o.orderId}`} className="link-card">
                <span className="order-title">Order #{o.orderId}</span>
                <span className="order-meta">
                  {" "}
                  · {o.placedAt} · {o.total}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
