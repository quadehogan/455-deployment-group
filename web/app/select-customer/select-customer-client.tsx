"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
  const gridRef = useRef<HTMLUListElement>(null);
  const [minColPx, setMinColPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const buttons = [
      ...root.querySelectorAll<HTMLButtonElement>(".customer-btn"),
    ];
    if (buttons.length === 0) {
      setMinColPx(null);
      return;
    }
    let max = 0;
    for (const btn of buttons) {
      max = Math.max(max, btn.scrollWidth);
    }
    setMinColPx(Math.ceil(max));
  }, [customers]);

  function pick(customerId: number) {
    document.cookie = `customer_id=${customerId}; path=/; max-age=2592000; SameSite=Lax`;
    router.push("/dashboard");
  }

  const gridStyle =
    minColPx != null
      ? ({
          gridTemplateColumns: `repeat(3, minmax(${minColPx}px, 1fr))`,
        } as const)
      : undefined;

  return (
    <div className="customer-select-wrap">
      <ul ref={gridRef} className="customer-select-grid" style={gridStyle}>
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
    </div>
  );
}
