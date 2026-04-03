"""Shared feature engineering logic -- used by both ETL and inference."""
from datetime import datetime
import pandas as pd

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame with order_datetime and birthdate columns.
    Adds customer_age, order_dow, order_month in place.
    Returns the modified DataFrame.
    """
    df = df.copy()
    df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
    df["birthdate"]      = pd.to_datetime(df["birthdate"],      errors="coerce")

    now_year = datetime.now().year
    df["customer_age"] = now_year - df["birthdate"].dt.year
    df["order_dow"]    = df["order_datetime"].dt.dayofweek
    df["order_month"]  = df["order_datetime"].dt.month

    return df

# Features the model trains on and inference supplies
FEATURE_COLS = [
    "num_items", "order_total", "avg_item_value",
    "customer_age", "order_dow", "order_month"
]

# Full set of columns written to the modeling_orders warehouse table
MODELING_COLS = [
    "order_id", "customer_id",
    "num_items", "order_total", "avg_item_value",
    "customer_age", "order_dow", "order_month",
    "label_late_delivery"
]
