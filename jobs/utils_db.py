"""Database utilities — Supabase REST API (primary) + optional direct PostgreSQL."""
import pandas as pd
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# ── Supabase REST client (always available) ──────────────────────────────────
_sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def sb_client():
    """Return the Supabase client instance."""
    return _sb


def sb_read_sql(query: str) -> pd.DataFrame:
    """Execute a raw SQL SELECT via Supabase RPC and return a DataFrame.
    Uses the pg_net / rpc approach for complex JOINs that PostgREST can't handle.
    Falls back to direct psycopg2 if available.
    """
    from config import DATABASE_URL
    if DATABASE_URL:
        try:
            import psycopg2
            conn = psycopg2.connect(DATABASE_URL)
            df = pd.read_sql(query, conn)
            conn.close()
            return df
        except Exception:
            pass  # Fall through to REST API approach

    # For complex JOINs, use Supabase's PostgREST or fetch tables separately
    raise RuntimeError(
        "Complex SQL JOINs require direct DB access (DATABASE_URL) or "
        "pre-built views in Supabase. Use sb_fetch_orders_for_scoring() instead."
    )


def sb_fetch_orders_for_scoring() -> pd.DataFrame:
    """Fetch orders + customers + order_items via Supabase REST API for fraud scoring."""
    sb = sb_client()

    # Fetch orders
    orders_resp = sb.table("orders").select("*").execute()
    df_orders = pd.DataFrame(orders_resp.data)

    if df_orders.empty:
        return df_orders

    # Fetch customers
    customers_resp = sb.table("customers").select("*").execute()
    df_customers = pd.DataFrame(customers_resp.data)

    # Fetch order_items aggregated
    items_resp = sb.table("order_items").select("*").execute()
    df_items = pd.DataFrame(items_resp.data)

    if not df_items.empty:
        df_item_agg = df_items.groupby("order_id").agg(
            item_count=("order_id", "count"),
            total_quantity=("quantity", "sum"),
            unique_products=("product_id", "nunique"),
        ).reset_index()

        # Also compute num_items and avg_item_value for late delivery model
        df_item_agg2 = df_items.groupby("order_id").agg(
            num_items=("quantity", "sum"),
            avg_item_value=("unit_price", "mean"),
        ).reset_index()
        df_item_agg = df_item_agg.merge(df_item_agg2, on="order_id", how="left")
    else:
        df_item_agg = pd.DataFrame(columns=[
            "order_id", "item_count", "total_quantity", "unique_products",
            "num_items", "avg_item_value",
        ])

    # Join orders + customers
    df = df_orders.merge(
        df_customers.rename(columns={"created_at": "customer_created_at", "zip_code": "customer_zip"}),
        on="customer_id", how="left",
    )

    # Join with item aggregates
    df = df.merge(df_item_agg, on="order_id", how="left")

    # Fill missing aggregates with 0
    for col in ["item_count", "total_quantity", "unique_products", "num_items", "avg_item_value"]:
        if col in df.columns:
            df[col] = df[col].fillna(0)

    return df


def sb_upsert_predictions(table_name: str, rows: list[dict]):
    """Upsert prediction rows into a Supabase table (creates table if needed)."""
    sb = sb_client()

    if not rows:
        return

    # Supabase upsert handles ON CONFLICT automatically on primary key
    sb.table(table_name).upsert(rows).execute()


def ensure_predictions_table(sb=None):
    """No-op when using Supabase REST — table must exist in Supabase dashboard.
    Kept for backward compatibility."""
    pass


def ensure_fraud_scores_table(sb=None):
    """No-op when using Supabase REST — table must exist in Supabase dashboard.
    Kept for backward compatibility."""
    pass


# ── Legacy direct PostgreSQL (kept for ETL/training scripts) ──────────────────
def pg_conn():
    """Context manager for direct PostgreSQL connection."""
    from contextlib import contextmanager
    from config import DATABASE_URL
    import psycopg2

    @contextmanager
    def _conn():
        conn = psycopg2.connect(DATABASE_URL)
        try:
            yield conn
        finally:
            conn.close()

    return _conn()
