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
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </main>
    );
  }

  if (customerId === null) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No customer selected.{" "}
          <Link href="/select-customer" className="underline">
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
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as <strong>{name}</strong> (demo — no password).
      </p>

      {/* Summary cards: replace with SQL aggregates later */}
      <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-zinc-300 p-3 dark:border-zinc-600">
          <div className="text-zinc-500 dark:text-zinc-400">Orders</div>
          <div className="text-lg font-semibold">{orders.length}</div>
        </div>
        <div className="rounded border border-zinc-300 p-3 dark:border-zinc-600">
          <div className="text-zinc-500 dark:text-zinc-400">Total spend (demo)</div>
          <div className="text-lg font-semibold">${totalSpend}</div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Recent orders
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No orders yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((o) => (
            <li key={o.orderId}>
              <Link
                href={`/orders/${o.orderId}`}
                className="block rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                #{o.orderId} · {o.placedAt} · {o.total}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link href="/orders" className="underline">
          All orders
        </Link>
        {" · "}
        <Link href="/place-order" className="underline">
          Place order
        </Link>
      </p>
    </main>
  );
}
