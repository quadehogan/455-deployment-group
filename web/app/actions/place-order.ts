"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  ORDERS_HAS_FULFILLED,
  ORDERS_TIME_COL,
  ORDERS_TOTAL_COL,
} from "@/lib/schema";

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

export type PlaceOrderResult =
  | { ok: true; orderId: number }
  | { ok: false; error: string };

export async function placeOrderAction(input: {
  customerId: number;
  productId: number;
  quantity: number;
}): Promise<PlaceOrderResult> {
  const { customerId, productId, quantity } = input;
  if (quantity < 1 || !Number.isFinite(quantity)) {
    return { ok: false, error: "Invalid quantity" };
  }

  const tc = ident(ORDERS_TIME_COL);
  const tot = ident(ORDERS_TOTAL_COL);

  try {
    const result = await db.begin(async (sql: any) => {
      const [product] = await sql`
        SELECT * FROM products WHERE product_id = ${productId}
      `;
      if (!product || typeof product !== "object") {
        throw new Error("Product not found");
      }

      const row = product as Record<string, unknown>;
      const unit = Number(
        row.unit_price ?? row.price ?? row.unitPrice ?? 0,
      );
      if (!Number.isFinite(unit) || unit < 0) {
        throw new Error("Invalid product price");
      }

      const lineTotal = unit * quantity;

      const [{ next_id }] = await sql`
        SELECT COALESCE(MAX(order_id), 0) + 1 AS next_id FROM orders
      `;
      const orderId = Number(next_id);

      if (ORDERS_HAS_FULFILLED) {
        await sql.unsafe(
          `INSERT INTO orders (order_id, customer_id, ${tc}, ${tot}, fulfilled)
           VALUES (${orderId}, ${customerId}, NOW(), ${lineTotal}, 0)`,
        );
      } else {
        await sql.unsafe(
          `INSERT INTO orders (order_id, customer_id, ${tc}, ${tot})
           VALUES (${orderId}, ${customerId}, NOW(), ${lineTotal})`,
        );
      }

      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (${orderId}, ${productId}, ${quantity}, ${unit})
      `;

      return { orderId };
    });

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    revalidatePath("/warehouse/priority");
    return { ok: true, orderId: result.orderId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Order failed";
    return { ok: false, error: msg };
  }
}
