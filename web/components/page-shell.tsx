import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  children: ReactNode;
};

export function PageShell({ title, children }: PageShellProps) {
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {title}
      </h1>
      <div className="text-zinc-700 dark:text-zinc-300">{children}</div>
    </main>
  );
}
