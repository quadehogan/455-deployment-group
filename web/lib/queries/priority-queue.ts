import { db } from "@/lib/db";
import {
  ORDERS_HAS_FULFILLED,
  ORDERS_TIME_COL,
  ORDERS_TOTAL_COL,
} from "@/lib/schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCustomerName, type CustomerRow } from "@/lib/queries/shop";

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

export type PriorityQueueRow = {
  order_id: number;
  order_time: string | null;
  order_total: number | null;
  customer_id: number;
  customer_name: string | null;
  late_delivery_probability: number;
  predicted_late_delivery: number | null;
  prediction_timestamp: string | null;
};

export async function getPriorityQueue(): Promise<PriorityQueueRow[]> {
  const tc = ident(ORDERS_TIME_COL);
  const tot = ident(ORDERS_TOTAL_COL);
  const fulfilledSql = ORDERS_HAS_FULFILLED ? "AND o.fulfilled = 0" : "";

  const rows = await db.unsafe(
    `
    SELECT
      o.order_id,
      o.${tc} AS order_time,
      o.${tot} AS order_total,
      o.customer_id,
      p.late_delivery_probability::float8 AS late_delivery_probability,
      p.predicted_late_delivery,
      p.prediction_timestamp
    FROM orders o
    JOIN order_predictions p ON p.order_id = o.order_id
    WHERE 1=1 ${fulfilledSql}
    ORDER BY
      p.late_delivery_probability DESC NULLS LAST,
      o.${tc} ASC
    LIMIT 50
    `,
  );
  const raw = rows as unknown as Omit<PriorityQueueRow, "customer_name">[];

  const ids = [
    ...new Set(
      raw.map((r) => Number(r.customer_id)).filter((id) => !Number.isNaN(id)),
    ),
  ];

  const byId = new Map<number, CustomerRow>();
  if (ids.length > 0) {
    const supabase = createServerSupabase();
    const { data: custs, error } = await supabase
      .from("customers")
      .select("*")
      .in("customer_id", ids);
    if (error) throw new Error(error.message);
    for (const c of (custs ?? []) as CustomerRow[]) {
      byId.set(Number(c.customer_id), c);
    }
  }

  return raw.map((r) => {
    const cid = Number(r.customer_id);
    const row = byId.get(cid);
    return {
      ...r,
      customer_name: row
        ? formatCustomerName(row)
        : formatCustomerName({ customer_id: cid } as CustomerRow),
    };
  });
}
