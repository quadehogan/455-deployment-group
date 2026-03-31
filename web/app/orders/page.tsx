import { PageShell } from "@/components/page-shell";

export default function OrdersPage() {
  return (
    <PageShell title="Order history">
      <p>
        Skeleton: list orders for the selected customer. Each row can link to a
        detail page for line items.
      </p>
    </PageShell>
  );
}
