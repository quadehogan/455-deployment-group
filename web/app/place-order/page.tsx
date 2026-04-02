"use client";
// Demo form: in production you’d INSERT into `orders` + `order_items` in one transaction.

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCustomerIdFromCookie } from "@/lib/customer-cookie";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

export default function PlaceOrderPage() {
  const [ready, setReady] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [productId, setProductId] = useState(MOCK_PRODUCTS[0]?.id ?? 1);
  const [qty, setQty] = useState(1);
  // Shown after a fake submit — no database write yet.
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCustomerId(readCustomerIdFromCookie());
    setReady(true);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(
      `Demo only: would place ${qty}× product #${productId} for customer #${customerId}. Hook up Supabase to persist.`,
    );
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-xl font-semibold">Place order</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </main>
    );
  }

  if (customerId === null) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-xl font-semibold">Place order</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/select-customer" className="underline">
            Choose a customer
          </Link>{" "}
          first.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Place order</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Customer #{customerId}. Pick a product and quantity.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="product" className="mb-1 block text-sm font-medium">
            Product
          </label>
          <select
            id="product"
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={productId}
            onChange={(e) => setProductId(Number(e.target.value))}
          >
            {MOCK_PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.price})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qty" className="mb-1 block text-sm font-medium">
            Quantity
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Place order (demo)
        </button>
      </form>

      {message && (
        <p className="mt-4 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-600">
          {message}
        </p>
      )}
    </main>
  );
}
