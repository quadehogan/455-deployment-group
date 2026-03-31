import { PageShell } from "@/components/page-shell";

export default function SelectCustomerPage() {
  return (
    <PageShell title="Select customer">
      <p>
        Skeleton: list customers from the database and store{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          customer_id
        </code>{" "}
        in a cookie, then redirect to the dashboard. No signup or login.
      </p>
    </PageShell>
  );
}
