/**
 * Demo data only. Replace with Supabase queries using the same shapes.
 * Keep `CUSTOMERS` ids in sync everywhere we filter by `customer_id`.
 */

export const CUSTOMERS = [
  { id: 1, name: "Jayden Brown" },
  { id: 2, name: "Alec Neish" },
  { id: 3, name: "Quade Hogan" },
  { id: 4, name: "Dallin Alder" },
];

/** Orders per customer — mirrors `orders` filtered by `customer_id`. */
export const MOCK_ORDERS: Record<
  number,
  { orderId: number; placedAt: string; total: string }[]
> = {
  1: [
    { orderId: 101, placedAt: "2025-03-01", total: "$42.00" },
    { orderId: 102, placedAt: "2025-03-15", total: "$18.50" },
  ],
  2: [{ orderId: 201, placedAt: "2025-02-20", total: "$99.00" }],
  3: [],
  4: [
    { orderId: 401, placedAt: "2025-01-10", total: "$7.25" },
    { orderId: 402, placedAt: "2025-03-28", total: "$56.00" },
  ],
};

/** Line items per `order_id` — mirrors `order_items` + product names. */
export const MOCK_ORDER_LINES: Record<
  string,
  { product: string; qty: number; lineTotal: string }[]
> = {
  "101": [
    { product: "Notebook", qty: 2, lineTotal: "$24.00" },
    { product: "Pen set", qty: 1, lineTotal: "$18.00" },
  ],
  "102": [{ product: "Sticker pack", qty: 3, lineTotal: "$18.50" }],
  "201": [{ product: "Desk lamp", qty: 1, lineTotal: "$99.00" }],
  "401": [{ product: "Coffee mug", qty: 1, lineTotal: "$7.25" }],
  "402": [
    { product: "USB cable", qty: 2, lineTotal: "$20.00" },
    { product: "Mouse pad", qty: 1, lineTotal: "$36.00" },
  ],
};

/**
 * Top-of-queue style rows — mirrors the Chapter 17 join on
 * orders + customers + order_predictions (unfulfilled, sorted by probability).
 */
export const MOCK_PRIORITY_QUEUE: {
  orderId: number;
  customerName: string;
  lateDeliveryProbability: number;
  orderTimestamp: string;
}[] = [
  {
    orderId: 305,
    customerName: "Alec Neish",
    lateDeliveryProbability: 0.91,
    orderTimestamp: "2025-03-29T10:00:00",
  },
  {
    orderId: 102,
    customerName: "Jayden Brown",
    lateDeliveryProbability: 0.72,
    orderTimestamp: "2025-03-15T14:30:00",
  },
  {
    orderId: 401,
    customerName: "Dallin Alder",
    lateDeliveryProbability: 0.45,
    orderTimestamp: "2025-01-10T09:00:00",
  },
];

/** Fake catalog rows for the “place order” form. */
export const MOCK_PRODUCTS = [
  { id: 1, name: "Notebook", price: "$12.00" },
  { id: 2, name: "Pen set", price: "$18.00" },
  { id: 3, name: "Sticker pack", price: "$6.00" },
];
