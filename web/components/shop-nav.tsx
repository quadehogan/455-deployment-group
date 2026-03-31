import Link from "next/link";

const links = [
  { href: "/select-customer", label: "Select customer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/place-order", label: "Place order" },
  { href: "/orders", label: "Order history" },
  { href: "/warehouse/priority", label: "Priority queue" },
  { href: "/scoring", label: "Run scoring" },
] as const;

export function ShopNav() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
        <Link
          href="/select-customer"
          className="font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Shop (IS 455)
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
