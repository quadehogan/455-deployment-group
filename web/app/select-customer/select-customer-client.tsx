"use client";

import { useRouter } from "next/navigation";
import {
  formatCustomerName,
  type CustomerRow,
} from "@/lib/queries/shop";

export function SelectCustomerButtons({
  customers,
}: {
  customers: CustomerRow[];
}) {
  const router = useRouter();

  function pick(customerId: number) {
    document.cookie = `customer_id=${customerId}; path=/; max-age=2592000; SameSite=Lax`;
    router.push("/dashboard");
  }

  return (
    <ul className="stack">
      {customers.map((c) => (
        <li key={c.customer_id}>
          <button
            type="button"
            className="customer-btn"
            onClick={() => pick(c.customer_id)}
          >
            {formatCustomerName(c)}
          </button>
        </li>
      ))}
    </ul>
  );
}
