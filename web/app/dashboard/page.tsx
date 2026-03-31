import { PageShell } from "@/components/page-shell";

export default function DashboardPage() {
  return (
    <PageShell title="Customer dashboard">
      <p>
        Skeleton: order summaries for the selected customer — order count, total
        spend, and recent orders (loaded from Supabase when wired up).
      </p>
    </PageShell>
  );
}
