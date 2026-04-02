"use client";
// This page runs in the browser so we can set cookies and navigate after a click.

import { useRouter } from "next/navigation";
import { CUSTOMERS } from "@/lib/mock-data";

export default function SelectCustomerPage() {
  // Programmatic navigation (same as <Link> but after we set the cookie).
  const router = useRouter();

  // Remember which customer the user is acting as, then go to the dashboard.
  function pick(id: number) {
    // max-age=2592000 ≈ 30 days; path=/ makes the cookie available on every route.
    document.cookie = `customer_id=${id}; path=/; max-age=2592000`;
    router.push("/dashboard");
  }

  return (
    <main className="page">
      <h1 className="page-heading">Select Customer</h1>
      <p className="text-muted-block">Select a Customer</p>
      {/* One button per customer; click runs pick() with that customer’s id. */}
      <ul className="stack">
        {CUSTOMERS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="customer-btn"
              onClick={() => pick(c.id)}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
