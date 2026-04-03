"""ETL job: joins orders + customers + shipments, engineers features, writes modeling_orders table."""
import pandas as pd
from sqlalchemy import create_engine
from config import DATABASE_URL
from utils_db import pg_conn
from feature_engineering import add_features, MODELING_COLS

def build_modeling_table():
    # Pull raw data: orders joined with customers, shipments, and aggregated order_items
    with pg_conn() as conn:
        df = pd.read_sql("""
            SELECT
                o.order_id,
                o.customer_id,
                o.order_datetime,
                o.order_total,
                oi.num_items,
                oi.avg_item_value,
                s.late_delivery AS label_late_delivery,
                c.birthdate
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id
            JOIN shipments s ON s.order_id = o.order_id
            LEFT JOIN (
                SELECT
                    order_id,
                    SUM(quantity) AS num_items,
                    AVG(unit_price) AS avg_item_value
                FROM order_items
                GROUP BY order_id
            ) oi ON oi.order_id = o.order_id
        """, conn)

    # Engineer features using shared logic
    df = add_features(df)

    # Keep only modeling columns, drop rows missing the label
    df_model = df[MODELING_COLS].dropna(subset=["label_late_delivery"])

    # Write to Supabase (replace = safe re-run, no duplicates)
    engine = create_engine(DATABASE_URL)
    df_model.to_sql("modeling_orders", engine, if_exists="replace", index=False)

    return len(df_model)

if __name__ == "__main__":
    n = build_modeling_table()
    print(f"Warehouse updated. modeling_orders rows: {n}")
