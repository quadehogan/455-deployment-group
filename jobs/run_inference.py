import pandas as pd
import joblib
from datetime import datetime
from sqlalchemy import create_engine
from psycopg2.extras import execute_values

from config import MODEL_PATH, DATABASE_URL
from utils_db import pg_conn, ensure_predictions_table
from feature_engineering import add_features, FEATURE_COLS

def run_inference():
    model = joblib.load(str(MODEL_PATH))

    engine = create_engine(DATABASE_URL)
    df_live = pd.read_sql("""
        SELECT
            o.order_id,
            o.order_datetime,
            o.order_total,
            oi.num_items,
            oi.avg_item_value,
            c.birthdate
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN (
            SELECT
                order_id,
                SUM(quantity) AS num_items,
                AVG(unit_price) AS avg_item_value
            FROM order_items
            GROUP BY order_id
        ) oi ON oi.order_id = o.order_id
    """, engine)

    df_live = add_features(df_live)
    X_live  = df_live[FEATURE_COLS]

    probs = model.predict_proba(X_live)[:, 1]
    preds = model.predict(X_live)

    ts = datetime.utcnow()
    out_rows = [
        (int(oid), float(p), int(yhat), ts)
        for oid, p, yhat in zip(df_live["order_id"], probs, preds)
    ]

    with pg_conn() as conn:
        ensure_predictions_table(conn)
        cur = conn.cursor()
        cur.execute("SET statement_timeout = 0")
        execute_values(cur, """
        INSERT INTO order_predictions
            (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
        VALUES %s
        ON CONFLICT (order_id) DO UPDATE SET
            late_delivery_probability = EXCLUDED.late_delivery_probability,
            predicted_late_delivery   = EXCLUDED.predicted_late_delivery,
            prediction_timestamp      = EXCLUDED.prediction_timestamp
        """, out_rows)
        conn.commit()

    print(f"Inference complete. Predictions written: {len(out_rows)}")

if __name__ == "__main__":
    run_inference()
