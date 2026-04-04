"""Inference job: scores orders via Railway fraud API (with local fallback)
+ local late-delivery model, reads/writes Supabase via REST API."""
import json
from datetime import datetime

import pandas as pd
import numpy as np
import joblib
import requests

from config import MODEL_PATH, FRAUD_MODEL_PATH, FRAUD_MODEL_METADATA_PATH, FRAUD_API_URL
from utils_db import sb_fetch_orders_for_scoring, sb_upsert_predictions
from feature_engineering import add_features, FEATURE_COLS
from fraud_feature_engineering import engineer_fraud_features


def run_late_delivery_inference():
    """Score all orders for late delivery probability, upsert into order_predictions."""
    model = joblib.load(str(MODEL_PATH))

    df_live = sb_fetch_orders_for_scoring()

    if df_live.empty:
        print("No orders to score for late delivery.")
        return 0

    df_live = add_features(df_live)

    # Ensure required columns exist
    for col in FEATURE_COLS:
        if col not in df_live.columns:
            df_live[col] = np.nan

    X_live = df_live[FEATURE_COLS]

    probs = model.predict_proba(X_live)[:, 1]
    preds = model.predict(X_live)
    ts = datetime.utcnow().isoformat()

    rows = [
        {
            "order_id": int(oid),
            "late_delivery_probability": round(float(p), 6),
            "predicted_late_delivery": int(yhat),
            "prediction_timestamp": ts,
        }
        for oid, p, yhat in zip(df_live["order_id"], probs, preds)
    ]

    sb_upsert_predictions("order_predictions", rows)
    return len(rows)


def _safe_int(val, default=0):
    """Convert to int, handling NaN/None."""
    if pd.isna(val):
        return default
    return int(val)


def _safe_float(val, default=0.0):
    """Convert to float, handling NaN/None."""
    if pd.isna(val):
        return default
    return float(val)


def _safe_str(val, default=""):
    """Convert to str, handling NaN/None."""
    if pd.isna(val):
        return default
    return str(val)


def _try_railway_api(df_live: pd.DataFrame) -> list[dict] | None:
    """Try scoring via Railway API. Returns list of result dicts, or None if API is down."""
    predict_url = f"{FRAUD_API_URL}/predict"

    # Quick health check first
    try:
        health = requests.get(f"{FRAUD_API_URL}/health", timeout=5)
        if health.status_code != 200:
            print("  Railway API unhealthy, falling back to local model.")
            return None
    except requests.RequestException:
        print("  Railway API unreachable, falling back to local model.")
        return None

    out_rows = []
    errors = 0
    for _, row in df_live.iterrows():
        payload = {
            "customer_id":        _safe_int(row.get("customer_id")),
            "order_datetime":     _safe_str(row.get("order_datetime")),
            "billing_zip":        _safe_str(row.get("billing_zip")),
            "shipping_zip":       _safe_str(row.get("shipping_zip")),
            "shipping_state":     _safe_str(row.get("shipping_state")),
            "payment_method":     _safe_str(row.get("payment_method")),
            "device_type":        _safe_str(row.get("device_type")),
            "ip_country":         _safe_str(row.get("ip_country")),
            "promo_used":         _safe_int(row.get("promo_used")),
            "order_subtotal":     _safe_float(row.get("order_subtotal")),
            "shipping_fee":       _safe_float(row.get("shipping_fee")),
            "tax_amount":         _safe_float(row.get("tax_amount")),
            "order_total":        _safe_float(row.get("order_total")),
            "risk_score":         _safe_float(row.get("risk_score")),
            "gender":             _safe_str(row.get("gender")),
            "birthdate":          _safe_str(row.get("birthdate")),
            "customer_segment":   _safe_str(row.get("customer_segment")),
            "loyalty_tier":       _safe_str(row.get("loyalty_tier")),
            "customer_created_at": _safe_str(row.get("customer_created_at")),
            "customer_zip":       _safe_str(row.get("customer_zip")),
            "item_count":         _safe_int(row.get("item_count"), 1),
            "total_quantity":     _safe_int(row.get("total_quantity"), 1),
            "unique_products":    _safe_int(row.get("unique_products"), 1),
        }

        try:
            resp = requests.post(predict_url, json=payload, timeout=10)
            resp.raise_for_status()
            result = resp.json()
            out_rows.append({
                "order_id": int(row["order_id"]),
                "fraud_probability": float(result["fraud_probability"]),
                "predicted_fraud": int(result["predicted_fraud"]),
                "prediction_timestamp": result["scored_at"],
            })
        except requests.RequestException:
            errors += 1
            if errors >= 3:
                print(f"  Too many API errors ({errors}), falling back to local model.")
                return None

    return out_rows


def _score_fraud_locally(df_live: pd.DataFrame) -> list[dict]:
    """Score fraud using the local fraud_model.sav artifact."""
    model = joblib.load(str(FRAUD_MODEL_PATH))

    with open(FRAUD_MODEL_METADATA_PATH) as f:
        metadata = json.load(f)
    feature_cols = metadata["feature_list"]

    df_feat = engineer_fraud_features(df_live)

    # Ensure all expected columns exist
    for col in feature_cols:
        if col not in df_feat.columns:
            df_feat[col] = np.nan

    X_live = df_feat[feature_cols]

    probs = model.predict_proba(X_live)[:, 1]
    preds = model.predict(X_live)
    ts = datetime.utcnow().isoformat()

    return [
        {
            "order_id": int(oid),
            "fraud_probability": round(float(p), 6),
            "predicted_fraud": int(yhat),
            "prediction_timestamp": ts,
        }
        for oid, p, yhat in zip(df_live["order_id"], probs, preds)
    ]


def run_fraud_inference():
    """Score all orders for fraud probability, upsert into order_fraud_scores.
    Tries Railway API first; falls back to local model if API is unavailable."""
    df_live = sb_fetch_orders_for_scoring()

    if df_live.empty:
        print("No orders to score for fraud.")
        return 0

    # Try Railway API first, fall back to local model
    out_rows = _try_railway_api(df_live)

    if out_rows is None:
        print("  Using local fraud_model.sav...")
        out_rows = _score_fraud_locally(df_live)

    if not out_rows:
        print("No fraud scores to write.")
        return 0

    sb_upsert_predictions("order_fraud_scores", out_rows)
    return len(out_rows)


if __name__ == "__main__":
    print("Running late delivery inference...")
    n_late = run_late_delivery_inference()
    print(f"Late delivery predictions written: {n_late}")

    print("\nRunning fraud inference...")
    n_fraud = run_fraud_inference()
    print(f"Fraud predictions written: {n_fraud}")
