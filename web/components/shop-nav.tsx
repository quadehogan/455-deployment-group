import Link from "next/link";

const links = [
  { href: "/select-customer", label: "Select Customer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/place-order", label: "Place Order" },
  { href: "/orders", label: "Order History" },
  { href: "/warehouse/priority", label: "Priority Queue" },
  { href: "/scoring", label: "Run Scoring" },
] as const;

export function ShopNav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/select-customer" className="nav-brand">
          Shop (IS 455)
        </Link>
        <nav className="nav-links">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="nav-link">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
