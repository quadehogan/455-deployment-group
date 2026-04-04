"""Shared fraud feature engineering -- must match notebook Phase 3 exactly."""
import pandas as pd

def engineer_fraud_features(df: pd.DataFrame) -> pd.DataFrame:
    """Apply the SAME feature transformations as training.
    This function replicates the notebook's engineer_features() (cell 57)
    so that inference features are byte-for-byte identical to training.
    """
    df = df.copy()

    # Date parsing
    df["order_datetime"]      = pd.to_datetime(df["order_datetime"],      errors="coerce")
    df["birthdate"]           = pd.to_datetime(df["birthdate"],           errors="coerce")
    df["customer_created_at"] = pd.to_datetime(df["customer_created_at"], errors="coerce")

    # Time-based features
    df["order_hour"]       = df["order_datetime"].dt.hour
    df["order_weekday"]    = df["order_datetime"].dt.dayofweek
    df["order_month"]      = df["order_datetime"].dt.month
    df["is_weekend"]       = (df["order_weekday"] >= 5).astype(int)

    # Customer derived features (hardcode 2026 to match training)
    df["customer_age"]     = 2026 - df["birthdate"].dt.year
    df["account_age_days"] = (df["order_datetime"] - df["customer_created_at"]).dt.days

    # Address + geo flags
    df["zip_mismatch"] = (df["billing_zip"] != df["shipping_zip"]).astype(int)
    df["ip_foreign"]   = (df["ip_country"] != "US").astype(int)

    # Drop raw date columns (model was not trained on these)
    df.drop(
        columns=["order_datetime", "birthdate", "customer_created_at"],
        errors="ignore",
        inplace=True,
    )

    return df


# SQL to pull raw order data from Supabase (PostgreSQL).
# Adapted from notebook cell 57 (SQLite) — identical column aliases.
FRAUD_INFERENCE_SQL = """
SELECT
    o.order_id, o.customer_id,
    o.order_datetime, o.billing_zip, o.shipping_zip, o.shipping_state,
    o.payment_method, o.device_type, o.ip_country,
    o.promo_used,
    o.order_subtotal, o.shipping_fee, o.tax_amount, o.order_total, o.risk_score,
    c.gender, c.birthdate, c.customer_segment, c.loyalty_tier, c.is_active,
    c.created_at  AS customer_created_at,
    c.zip_code    AS customer_zip,
    COALESCE(oi.item_count,   0) AS item_count,
    COALESCE(oi.total_qty,    0) AS total_quantity,
    COALESCE(oi.unique_prods, 0) AS unique_products
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN (
    SELECT order_id,
           COUNT(*)                    AS item_count,
           SUM(quantity)               AS total_qty,
           COUNT(DISTINCT product_id)  AS unique_prods
    FROM order_items
    GROUP BY order_id
) oi ON o.order_id = oi.order_id
ORDER BY o.order_id DESC
"""
