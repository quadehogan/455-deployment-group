"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ScoringPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runScoring() {
    setError(null);
    setStatus(null);
    setPending(true);
    try {
      const res = await fetch("/api/score", { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setStatus(data.message ?? "Done.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page">
      <h1 className="page-heading">Run scoring</h1>
      <p className="text-muted-block">
        Triggers inference (local dev) or reports production cron behavior. Same
        job as <code className="inline-code">jobs/run_inference.py</code>.
      </p>

      <button
        type="button"
        className="btn-primary"
        onClick={runScoring}
        disabled={pending}
      >
        {pending ? "Running…" : "Run scoring"}
      </button>

      {status && <p className="message-box">{status}</p>}
      {error && <p className="message-box">{error}</p>}

      <p className="footer-links">
        <Link href="/warehouse/priority" className="link">
          View priority queue
        </Link>
      </p>
    </main>
  );
}
