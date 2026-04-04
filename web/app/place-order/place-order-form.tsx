"use client";

import { useState, useTransition } from "react";
import { placeOrderAction } from "@/app/actions/place-order";
import {
  productLabel,
  type ProductRow,
} from "@/lib/queries/shop";

export function PlaceOrderForm({
  customerId,
  products,
}: {
  customerId: number;
  products: ProductRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const defaultPid = products[0]?.product_id ?? 0;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const productId = Number(fd.get("product"));
    const qty = Number(fd.get("qty"));
    if (!Number.isFinite(productId) || productId < 1) {
      setError("Choose a product.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Invalid quantity.");
      return;
    }
    startTransition(async () => {
      const r = await placeOrderAction({
        customerId,
        productId,
        quantity: qty,
      });
      if (r.ok) {
        setMessage(`Order #${r.orderId} placed.`);
      } else {
        setError(r.error);
      }
    });
  }

  if (products.length === 0) {
    return (
      <p className="text-muted">No products in the database yet.</p>
    );
  }

  return (
    <>
      <form onSubmit={submit} className="form-stack">
        <div>
          <label htmlFor="product" className="field-label">
            Product
          </label>
          <select
            id="product"
            name="product"
            className="field-input"
            defaultValue={defaultPid}
            disabled={pending}
          >
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {productLabel(p)}
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
            name="qty"
            type="number"
            min={1}
            className="field-input"
            defaultValue={1}
            disabled={pending}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Placing…" : "Place order"}
        </button>
      </form>

      {message && <p className="message-box">{message}</p>}
      {error && <p className="message-box">{error}</p>}
    </>
  );
}
