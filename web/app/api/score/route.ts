import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const FRAUD_API_URL =
  process.env.FRAUD_API_URL ??
  "https://fraud-detection-api-production-2465.up.railway.app";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export async function POST() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: "Supabase credentials not configured." },
      { status: 500 },
    );
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Fetch all orders joined with customers + order_item aggregates
  const { data: orders, error: ordersErr } = await sb
    .from("orders")
    .select("*");
  if (ordersErr) {
    return NextResponse.json(
      { error: `Failed to fetch orders: ${ordersErr.message}` },
      { status: 500 },
    );
  }

  const { data: customers } = await sb.from("customers").select("*");
  const { data: items } = await sb.from("order_items").select("*");

  // Build customer lookup
  const custMap = new Map(
    (customers ?? []).map((c) => [c.customer_id, c]),
  );

  // Build order_items aggregates
  const itemAgg = new Map<
    number,
    { item_count: number; total_quantity: number; unique_products: number }
  >();
  for (const item of items ?? []) {
    const agg = itemAgg.get(item.order_id) ?? {
      item_count: 0,
      total_quantity: 0,
      unique_products: new Set<number>(),
    };
    agg.item_count += 1;
    agg.total_quantity += item.quantity ?? 0;
    if (agg.unique_products instanceof Set) agg.unique_products.add(item.product_id);
    itemAgg.set(item.order_id, agg as any);
  }

  // 2. Score each order via the Railway fraud API
  let scored = 0;
  let errors = 0;
  const fraudRows: {
    order_id: number;
    fraud_probability: number;
    predicted_fraud: number;
    prediction_timestamp: string;
  }[] = [];

  for (const order of orders ?? []) {
    const cust = custMap.get(order.customer_id) ?? {};
    const agg = itemAgg.get(order.order_id);
    const uniqueProducts =
      agg?.unique_products instanceof Set
        ? agg.unique_products.size
        : (agg?.unique_products ?? 1);

    const payload = {
      customer_id: order.customer_id ?? 0,
      order_datetime: order.order_datetime ?? "",
      billing_zip: String(order.billing_zip ?? ""),
      shipping_zip: String(order.shipping_zip ?? ""),
      shipping_state: String(order.shipping_state ?? ""),
      payment_method: String(order.payment_method ?? ""),
      device_type: String(order.device_type ?? ""),
      ip_country: String(order.ip_country ?? ""),
      promo_used: order.promo_used ?? 0,
      order_subtotal: order.order_subtotal ?? 0,
      shipping_fee: order.shipping_fee ?? 0,
      tax_amount: order.tax_amount ?? 0,
      order_total: order.order_total ?? 0,
      risk_score: order.risk_score ?? 0,
      gender: String(cust.gender ?? ""),
      birthdate: String(cust.birthdate ?? ""),
      customer_segment: String(cust.customer_segment ?? ""),
      loyalty_tier: String(cust.loyalty_tier ?? ""),
      customer_created_at: String(cust.created_at ?? ""),
      customer_zip: String(cust.zip_code ?? ""),
      item_count: agg?.item_count ?? 1,
      total_quantity: agg?.total_quantity ?? 1,
      unique_products: uniqueProducts,
    };

    try {
      const resp = await fetch(`${FRAUD_API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        errors++;
        continue;
      }

      const result = await resp.json();
      fraudRows.push({
        order_id: order.order_id,
        fraud_probability: result.fraud_probability,
        predicted_fraud: result.predicted_fraud ? 1 : 0,
        prediction_timestamp: result.scored_at,
      });
      scored++;
    } catch {
      errors++;
    }
  }

  // 3. Upsert fraud scores into Supabase
  if (fraudRows.length > 0) {
    const { error: upsertErr } = await sb
      .from("order_fraud_scores")
      .upsert(fraudRows, { onConflict: "order_id" });

    if (upsertErr) {
      return NextResponse.json(
        {
          error: `Scored ${scored} orders but failed to save: ${upsertErr.message}`,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: `Scoring complete. ${scored} orders scored, ${errors} errors.`,
  });
}
