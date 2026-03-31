import { PageShell } from "@/components/page-shell";

export default function WarehousePriorityPage() {
  return (
    <PageShell title="Late delivery priority queue">
      <p>
        Skeleton: top 50 unfulfilled orders by{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          late_delivery_probability
        </code>{" "}
        (joining <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">orders</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">customers</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">order_predictions</code>
        ).
      </p>
      <p className="mt-4">
        Use the Run scoring page to trigger inference and refresh this view once
        the backend is connected.
      </p>
    </PageShell>
  );
}
