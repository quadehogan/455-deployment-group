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
      <main className="page">
        <h1 className="page-heading">Place order</h1>
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  if (customerId === null) {
    return (
      <main className="page">
        <h1 className="page-heading">Place order</h1>
        <p className="text-muted">
          <Link href="/select-customer" className="link">
            Choose a customer
          </Link>{" "}
          first.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="page-heading">Place order</h1>
      <p className="text-muted-block">
        Customer #{customerId}. Pick a product and quantity.
      </p>

      <form onSubmit={submit} className="form-stack">
        <div>
          <label htmlFor="product" className="field-label">
            Product
          </label>
          <select
            id="product"
            className="field-input"
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
          <label htmlFor="qty" className="field-label">
            Quantity
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            className="field-input"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </div>
        <button type="submit" className="btn-primary">
          Place order (demo)
        </button>
      </form>

      {message && <p className="message-box">{message}</p>}
    </main>
  );
}
