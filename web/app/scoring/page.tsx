"use client";
// This button does not run Python on Vercel — it only simulates “scoring done” for the UI.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ScoringPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  function runScoring() {
    // Production: call an API route or worker that runs `jobs/run_inference.py`.
    setStatus(
      "Demo: inference would run here and write to `order_predictions`. Then refresh the warehouse queue.",
    );
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Run scoring</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Triggers the same job as <code className="text-xs">run_inference.py</code> (not wired in
        this demo).
      </p>

      <button
        type="button"
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        onClick={runScoring}
      >
        Run scoring (demo)
      </button>

      {status && (
        <p className="mt-4 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-600">
          {status}
        </p>
      )}

      <p className="mt-6 text-sm">
        <Link href="/warehouse/priority" className="underline">
          View priority queue
        </Link>
      </p>
    </main>
  );
}
