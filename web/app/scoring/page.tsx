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
    <main className="page">
      <h1 className="page-heading">Run scoring</h1>
      <p className="text-muted-block">
        Triggers the same job as <code className="inline-code">run_inference.py</code> (not
        wired in this demo).
      </p>

      <button type="button" className="btn-primary" onClick={runScoring}>
        Run scoring (demo)
      </button>

      {status && <p className="message-box">{status}</p>}

      <p className="footer-links">
        <Link href="/warehouse/priority" className="link">
          View priority queue
        </Link>
      </p>
    </main>
  );
}
