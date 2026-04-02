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
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-xl font-semibold">Order history</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Order history</h1>

      {customerId === null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No customer selected.{" "}
          <Link href="/select-customer" className="underline">
            Choose a customer
          </Link>
          .
        </p>
      )}

      {customerId !== null && orders.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No orders yet for this customer.
        </p>
      )}

      {customerId !== null && orders.length > 0 && (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.orderId}>
              {/* `/orders/[orderId]` can show line items for this order later */}
              <Link
                href={`/orders/${o.orderId}`}
                className="block rounded border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <span className="font-medium">Order #{o.orderId}</span>
                <span className="text-zinc-600 dark:text-zinc-400">
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
