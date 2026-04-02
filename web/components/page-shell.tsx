import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  children: ReactNode;
};

export function PageShell({ title, children }: PageShellProps) {
  return (
    <main className="shell">
      <h1 className="shell-title">{title}</h1>
      <div className="shell-body">{children}</div>
    </main>
  );
}
