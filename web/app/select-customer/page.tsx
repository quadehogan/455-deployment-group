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
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Select Customer</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Select a Customer
      </p>
      {/* One button per customer; click runs pick() with that customer’s id. */}
      <ul className="space-y-2">
        {CUSTOMERS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
