import Link from "next/link";
import { cookies } from "next/headers";
import { listProducts } from "@/lib/queries/shop";
import { PlaceOrderForm } from "./place-order-form";

export default async function PlaceOrderPage() {
  const raw = (await cookies()).get("customer_id")?.value;
  const customerId = raw != null ? Number.parseInt(raw, 10) : NaN;

  if (raw == null || Number.isNaN(customerId)) {
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

  const products = await listProducts();

  return (
    <main className="page">
      <h1 className="page-heading">Place order</h1>
      <p className="text-muted-block">
        Customer #{customerId}. Pick a product and quantity.
      </p>
      <PlaceOrderForm customerId={customerId} products={products} />
    </main>
  );
}
