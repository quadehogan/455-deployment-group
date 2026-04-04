import { createServerSupabase } from "@/lib/supabase/server";
import {
  ORDERS_TIME_COL,
  ORDERS_TOTAL_COL,
} from "@/lib/schema";

/** Row from `customers` — column names vary by migration (e.g. `name` vs `first_name`/`last_name`). */
export type CustomerRow = {
  customer_id: number;
} & Record<string, unknown>;

function pickStr(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

export function formatCustomerName(c: CustomerRow): string {
  const r = c as Record<string, unknown>;
  const id = Number(c.customer_id);
  const fn = pickStr(r.first_name ?? r.firstname ?? r.fname);
  const ln = pickStr(r.last_name ?? r.lastname ?? r.lname);
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  const single = pickStr(r.name ?? r.customer_name ?? r.full_name);
  if (single) return single;
  return `Customer #${id}`;
}

export async function listCustomers(): Promise<CustomerRow[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("customer_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerRow[];
}

export type OrderRow = {
  order_id: number;
  customer_id: number;
  [key: string]: unknown;
};

export async function listOrdersForCustomer(
  customerId: number,
): Promise<OrderRow[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("order_id", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

export function orderTime(o: OrderRow): string {
  const v = o[ORDERS_TIME_COL];
  if (v == null) return "";
  return String(v);
}

export function orderTotal(o: OrderRow): number {
  const v = o[ORDERS_TOTAL_COL];
  return typeof v === "number" ? v : Number(v ?? 0);
}

export async function getCustomerById(
  customerId: number,
): Promise<CustomerRow | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CustomerRow | null;
}

export type ProductRow = {
  product_id: number;
  name?: string | null;
  product_name?: string | null;
  price?: number | null;
  unit_price?: number | null;
};

export async function listProducts(): Promise<ProductRow[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("products").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductRow[];
}

export function productLabel(p: ProductRow): string {
  const name =
    (p.name ?? p.product_name ?? `Product #${p.product_id}`) as string;
  const price = p.unit_price ?? p.price;
  const priceStr =
    price != null ? ` ($${Number(price).toFixed(2)})` : "";
  return `${name}${priceStr}`;
}

export type OrderLineRow = {
  order_id: number;
  product_id: number;
  quantity?: number;
  qty?: number;
  unit_price?: number;
  price?: number;
};

export async function getOrderLineItems(orderId: number): Promise<
  { line: OrderLineRow; product: ProductRow | null }[]
> {
  const supabase = createServerSupabase();
  const { data: items, error: e1 } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);
  if (e1) throw new Error(e1.message);
  const rows = (items ?? []) as OrderLineRow[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => Number(r.product_id)))];
  const { data: products, error: e2 } = await supabase
    .from("products")
    .select("*")
    .in("product_id", ids);
  if (e2) throw new Error(e2.message);
  const byId = new Map<number, ProductRow>();
  for (const p of (products ?? []) as ProductRow[]) {
    byId.set(p.product_id, p);
  }
  return rows.map((line) => ({
    line,
    product: byId.get(line.product_id) ?? null,
  }));
}
