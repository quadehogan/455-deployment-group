"""Training job: reads modeling_orders, trains logistic regression, saves artifacts."""
import json
from datetime import datetime
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.linear_model import LogisticRegression

from config import ARTIFACTS_DIR, MODEL_PATH, MODEL_METADATA_PATH, METRICS_PATH
from utils_db import pg_conn
from feature_engineering import FEATURE_COLS

MODEL_VERSION = "1.0.0"

def train_and_save():
    # Read the warehouse table
    with pg_conn() as conn:
        df = pd.read_sql("SELECT * FROM modeling_orders", conn)

    label_col = "label_late_delivery"
    X = df[FEATURE_COLS]
    y = df[label_col].astype(int)

    # 80/20 stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Preprocessing: median impute all numeric features
    numeric_pipe = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    preprocessor = ColumnTransformer(
        transformers=[("num", numeric_pipe, FEATURE_COLS)],
        remainder="drop"
    )

    # Full pipeline: preprocess then classify
    model = Pipeline([
        ("prep", preprocessor),
        ("clf",  LogisticRegression(max_iter=500, n_jobs=-1))
    ])

    model.fit(X_train, y_train)

    # Evaluate on test set
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy":        float(accuracy_score(y_test, y_pred)),
        "f1":              float(f1_score(y_test, y_pred)),
        "roc_auc":         float(roc_auc_score(y_test, y_prob)),
        "row_count_train": int(len(X_train)),
        "row_count_test":  int(len(X_test))
    }

    # Save model + metadata + metrics
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, str(MODEL_PATH))

    metadata = {
        "model_version":   MODEL_VERSION,
        "trained_at_utc":  datetime.utcnow().isoformat(),
        "feature_list":    FEATURE_COLS,
        "label":           label_col,
        "warehouse_table": "modeling_orders",
        "warehouse_rows":  int(len(df))
    }

    with open(MODEL_METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"accuracy={metrics['accuracy']:.3f}  f1={metrics['f1']:.3f}  roc_auc={metrics['roc_auc']:.3f}")

if __name__ == "__main__":
    train_and_save()
