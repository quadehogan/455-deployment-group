import { PageShell } from "@/components/page-shell";

export default function ScoringPage() {
  return (
    <PageShell title="Run scoring">
      <p>
        Skeleton: button that triggers the ML inference job (same behavior as{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          jobs/run_inference.py
        </code>
        ), then refreshes the priority queue. On Vercel this usually calls a
        separate worker or API — not Python inside the Next.js process.
      </p>
    </PageShell>
  );
}
