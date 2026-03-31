import { PageShell } from "@/components/page-shell";

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  return (
    <PageShell title={`Order ${orderId}`}>
      <p>
        Skeleton: line items for this order. Replace with data from{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          order_items
        </code>
        .
      </p>
    </PageShell>
  );
}
