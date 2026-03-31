# Chapter 17: Deploying ML Pipelines — Implementation Guide

## Core Philosophy

Deployment is not about intelligence — it is about **integration**. A model is useful only when its predictions influence real decisions. The embedded deployment pattern keeps ML logic completely separate from application code: the app reads predictions from a table just like any other data.

Four principles govern every deployment decision:
- **Reliability** — the pipeline runs consistently and can be re-run without side effects
- **Repeatability** — the same inputs always produce the same outputs
- **Traceability** — every model artifact is versioned and its training context is recorded
- **Separation of concerns** — ETL, training, and inference are independent jobs

---

## Architecture Overview

```
App (web/mobile)
    ↓ reads/writes
Operational DB (shop.db)   ←── inference writes predictions back here
    ↓ ETL
Analytical DB / Warehouse (warehouse.db)
    ↓ training reads
Training job
    ↓ produces
model.sav + model_metadata.json + metrics.json
    ↓ inference loads
Inference job
```

The app never touches ML code. It only queries the `order_predictions` table. Predictions are written there by the inference job, which runs on a schedule.

---

## Project Folder Layout

```
project/
  data/
    shop.db          ← operational database (transactional)
    warehouse.db     ← analytical database (modeling-ready)
  artifacts/
    late_delivery_model.sav
    model_metadata.json
    metrics.json
  jobs/
    config.py
    utils_db.py
    etl_build_warehouse.py
    train_model.py
    run_inference.py
```

---

## Shared Configuration (`jobs/config.py`)

All jobs import paths from one place. This ensures every job agrees on where files live and prevents path drift.

```python
# jobs/config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_DIR      = PROJECT_ROOT / "data"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"

OP_DB_PATH = DATA_DIR / "shop.db"
WH_DB_PATH = DATA_DIR / "warehouse.db"

MODEL_PATH          = ARTIFACTS_DIR / "late_delivery_model.sav"
MODEL_METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"
METRICS_PATH        = ARTIFACTS_DIR / "metrics.json"
```

---

## Database Utilities (`jobs/utils_db.py`)

Shared helpers keep database code consistent across all three jobs. The context manager guarantees connections are always closed.

```python
# jobs/utils_db.py
import sqlite3
from contextlib import contextmanager

@contextmanager
def sqlite_conn(db_path):
    conn = sqlite3.connect(str(db_path))
    try:
        yield conn
    finally:
        conn.close()

def ensure_predictions_table(conn):
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS order_predictions (
        order_id INTEGER PRIMARY KEY,
        late_delivery_probability REAL,
        predicted_late_delivery INTEGER,
        prediction_timestamp TEXT
    )
    """)
    conn.commit()
```

---

## Job 1: ETL — Build the Warehouse (`jobs/etl_build_warehouse.py`)

Reads from the operational DB, denormalizes to one modeling row per order, engineers features, drops rows missing the label, and writes to warehouse.db.

```python
# jobs/etl_build_warehouse.py
import pandas as pd
from datetime import datetime
from config import OP_DB_PATH, WH_DB_PATH
from utils_db import sqlite_conn

def build_modeling_table():
    with sqlite_conn(OP_DB_PATH) as conn:
        query = """
        SELECT
            o.order_id,
            o.customer_id,
            o.num_items,
            o.total_value,
            o.avg_weight,
            o.order_timestamp,
            o.late_delivery AS label_late_delivery,
            c.gender,
            c.birthdate
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        """
        df = pd.read_sql(query, conn)

    # Parse dates
    df["order_timestamp"] = pd.to_datetime(df["order_timestamp"], errors="coerce")
    df["birthdate"]       = pd.to_datetime(df["birthdate"],       errors="coerce")

    # Feature engineering — must be IDENTICAL to inference logic
    now_year = datetime.now().year
    df["customer_age"] = now_year - df["birthdate"].dt.year
    df["order_dow"]    = df["order_timestamp"].dt.dayofweek
    df["order_month"]  = df["order_timestamp"].dt.month

    modeling_cols = [
        "order_id", "customer_id",
        "num_items", "total_value", "avg_weight",
        "customer_age", "order_dow", "order_month",
        "label_late_delivery"
    ]

    df_model = df[modeling_cols].dropna(subset=["label_late_delivery"])

    with sqlite_conn(WH_DB_PATH) as wh_conn:
        df_model.to_sql("modeling_orders", wh_conn,
                        if_exists="replace", index=False)

    return len(df_model)

if __name__ == "__main__":
    row_count = build_modeling_table()
    print(f"Warehouse updated. modeling_orders rows: {row_count}")
```

**Feature engineering rules:**
- `customer_age` = current year − birth year (integer approximation)
- `order_dow` = day of week (0=Monday … 6=Sunday)
- `order_month` = calendar month (1–12)
- Rows missing `label_late_delivery` are dropped before writing to warehouse

---

## Job 2: Train the Model (`jobs/train_model.py`)

Reads from the warehouse, builds a `ColumnTransformer` + `LogisticRegression` pipeline, evaluates on a held-out test set, and saves three artifacts.

```python
# jobs/train_model.py
import json
from datetime import datetime
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.linear_model import LogisticRegression

from config import WH_DB_PATH, ARTIFACTS_DIR, MODEL_PATH, MODEL_METADATA_PATH, METRICS_PATH
from utils_db import sqlite_conn

MODEL_VERSION = "1.0.0"

def train_and_save():
    with sqlite_conn(WH_DB_PATH) as conn:
        df = pd.read_sql("SELECT * FROM modeling_orders", conn)

    label_col    = "label_late_delivery"
    feature_cols = [c for c in df.columns if c != label_col]
    X = df[feature_cols]
    y = df[label_col].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # --- Pipeline definition ---
    numeric_features     = ["num_items", "total_value", "avg_weight",
                            "customer_age", "order_dow", "order_month"]
    categorical_features = []   # extend if you add categorical columns

    numeric_pipe = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median"))
    ])
    categorical_pipe = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot",  OneHotEncoder(handle_unknown="ignore"))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipe,     numeric_features),
            ("cat", categorical_pipe, categorical_features)
        ],
        remainder="drop"
    )

    clf   = LogisticRegression(max_iter=500)
    model = Pipeline(steps=[
        ("prep", preprocessor),
        ("clf",  clf)
    ])

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy":        float(accuracy_score(y_test, y_pred)),
        "f1":              float(f1_score(y_test, y_pred)),
        "roc_auc":         float(roc_auc_score(y_test, y_prob)),
        "row_count_train": int(len(X_train)),
        "row_count_test":  int(len(X_test))
    }

    # --- Save artifacts ---
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, str(MODEL_PATH))

    metadata = {
        "model_version":   MODEL_VERSION,
        "trained_at_utc":  datetime.utcnow().isoformat(),
        "feature_list":    feature_cols,
        "label":           label_col,
        "warehouse_table": "modeling_orders",
        "warehouse_rows":  int(len(df))
    }

    with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete.")
    print(f"Saved model:    {MODEL_PATH}")
    print(f"Saved metadata: {MODEL_METADATA_PATH}")
    print(f"Saved metrics:  {METRICS_PATH}")

if __name__ == "__main__":
    train_and_save()
```

### What Gets Saved

| File | Contents |
|---|---|
| `late_delivery_model.sav` | Full sklearn Pipeline (preprocessor + classifier) via joblib |
| `model_metadata.json` | Version, timestamp, feature list, label, warehouse table, row count |
| `metrics.json` | accuracy, F1, ROC-AUC, train/test row counts |

### ColumnTransformer Pattern

```
Input DataFrame
    ├── numeric columns  → SimpleImputer(median)  → passthrough
    └── categorical cols → SimpleImputer(mode) → OneHotEncoder
                   ↓
           LogisticRegression
```

`remainder="drop"` silently ignores any columns not listed in transformers — including `order_id` and `customer_id`, which should never be model features.

---

## Job 3: Run Inference (`jobs/run_inference.py`)

Loads the saved model and generates predictions for **unfulfilled orders only** (`WHERE fulfilled = 0`). Writes predictions back to `order_predictions` in the operational DB.

```python
# jobs/run_inference.py
import pandas as pd
import joblib
from datetime import datetime

from config import OP_DB_PATH, MODEL_PATH
from utils_db import sqlite_conn, ensure_predictions_table

def run_inference():
    model = joblib.load(str(MODEL_PATH))

    with sqlite_conn(OP_DB_PATH) as conn:
        query = """
        SELECT
            o.order_id,
            o.num_items,
            o.total_value,
            o.avg_weight,
            o.order_timestamp,
            c.birthdate
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.fulfilled = 0
        """
        df_live = pd.read_sql(query, conn)

    # Feature engineering — MUST match ETL exactly
    df_live["order_timestamp"] = pd.to_datetime(df_live["order_timestamp"], errors="coerce")
    df_live["birthdate"]       = pd.to_datetime(df_live["birthdate"],       errors="coerce")

    now_year = datetime.now().year
    df_live["customer_age"] = now_year - df_live["birthdate"].dt.year
    df_live["order_dow"]    = df_live["order_timestamp"].dt.dayofweek
    df_live["order_month"]  = df_live["order_timestamp"].dt.month

    feature_cols = ["num_items", "total_value", "avg_weight",
                    "customer_age", "order_dow", "order_month"]
    X_live = df_live[feature_cols]

    probs = model.predict_proba(X_live)[:, 1]
    preds = model.predict(X_live)

    ts = datetime.utcnow().isoformat()
    out_rows = [
        (int(oid), float(p), int(yhat), ts)
        for oid, p, yhat in zip(df_live["order_id"], probs, preds)
    ]

    with sqlite_conn(OP_DB_PATH) as conn:
        ensure_predictions_table(conn)
        cur = conn.cursor()
        cur.executemany("""
        INSERT OR REPLACE INTO order_predictions
            (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
        VALUES (?, ?, ?, ?)
        """, out_rows)
        conn.commit()

    print(f"Inference complete. Predictions written: {len(out_rows)}")

if __name__ == "__main__":
    run_inference()
```

### Critical: Feature Parity

Training and inference must apply **identical** feature logic. The safest pattern is to put the feature engineering function in a shared module (`feature_engineering.py`) and import it from both `etl_build_warehouse.py` and `run_inference.py`. Divergence between training features and inference features is one of the most common production bugs.

### Why `predict_proba` instead of `predict`

Binary `predict` gives 0/1 only. Probability scores (`predict_proba[:, 1]`) let the application sort and filter by confidence level — far more useful for operational decision-making like a priority queue.

---

## Inference → Application Flow

The inference job writes to `order_predictions`. The application never runs ML code — it just queries a table.

```sql
-- App query: priority queue of unfulfilled orders
SELECT
    o.order_id,
    o.order_timestamp,
    o.total_value,
    o.fulfilled,
    c.customer_id,
    c.first_name || ' ' || c.last_name AS customer_name,
    p.late_delivery_probability,
    p.predicted_late_delivery,
    p.prediction_timestamp
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_predictions p ON p.order_id = o.order_id
WHERE o.fulfilled = 0
ORDER BY
    p.late_delivery_probability DESC,
    o.order_timestamp ASC
LIMIT 50;
```

This query drives a "warehouse priority queue" — orders most likely to be late rise to the top so warehouse staff can process them first.

---

## Scheduling the Jobs

### Recommended Schedule

| Job | Frequency | Rationale |
|---|---|---|
| `etl_build_warehouse.py` | Nightly at 1:00 AM | Rebuild modeling table from latest data |
| `train_model.py` | Nightly at 1:10 AM | Retrain on fresh warehouse (after ETL) |
| `run_inference.py` | Every 5 minutes | Keep predictions fresh as new orders arrive |

### Cron (Mac / Linux)

Edit with `crontab -e`. Use absolute paths. If using a virtual environment, activate it explicitly.

```bash
# Nightly ETL at 1:00am
0 1 * * *  cd /path/to/project && /path/to/venv/bin/python jobs/etl_build_warehouse.py >> logs/etl.log 2>&1

# Nightly training at 1:10am
10 1 * * * cd /path/to/project && /path/to/venv/bin/python jobs/train_model.py >> logs/train.log 2>&1

# Inference every 5 minutes
*/5 * * * * cd /path/to/project && /path/to/venv/bin/python jobs/run_inference.py >> logs/infer.log 2>&1
```

Cron format: `minute hour day-of-month month day-of-week`

### Windows

Use Windows Task Scheduler to run the same commands on a repeating trigger. The concept is identical — a timed process executes your script.

### In-Process Schedulers (for demos / student projects)

| Platform | Library | Notes |
|---|---|---|
| Python | APScheduler | Runs functions on a schedule inside the Python process |
| Node.js | node-cron | Simple cron-style scheduling inside a Node app |
| Node.js | background worker | More robust for production |
| ASP.NET/C# | Quartz.NET / Hangfire | Background jobs with dashboards |

OS-level scheduling (cron / Task Scheduler) is the most reliable pattern for production. In-process schedulers are convenient for demos.

---

## App Integration Summary

The web application only needs to:
1. Read the `order_predictions` table (written by the inference job)
2. Optionally provide a "Run Scoring" button that triggers `python jobs/run_inference.py` as a subprocess and reloads the priority queue page

The app does **not** import sklearn, joblib, or any ML library. This is the separation-of-concerns principle in practice.

### Vibe-Code App Spec (Next.js recommended)

The full app has these pages, all driven by `shop.db`:

| Route | Purpose |
|---|---|
| `/select-customer` | Choose a customer to act as (stores `customer_id` in cookie) |
| `/dashboard` | Customer summary — order count, total spend, recent orders |
| `/place-order` | Add new order + line items using a DB transaction |
| `/orders` | Order history for selected customer |
| `/orders/[order_id]` | Line items for a specific order |
| `/warehouse/priority` | Priority queue table (uses the join query above) |
| `/scoring` | "Run Scoring" button — spawns inference job, shows status |

**Database contract:** The app uses only existing tables (`customers`, `orders`, `order_items`, `products`, `order_predictions`). It never creates new tables or runs ML code.

---

## Pipeline Design: Decision Table

| Question | Answer |
|---|---|
| Where does training data come from? | `warehouse.db → modeling_orders` (built by ETL) |
| Where do predictions go? | `shop.db → order_predictions` (written by inference) |
| What does the app query? | `order_predictions` joined to `orders` and `customers` |
| How are model artifacts versioned? | `MODEL_VERSION` string + `trained_at_utc` in metadata JSON |
| How do training and inference share feature logic? | Identical code in ETL and inference (ideally a shared module) |
| How is the model stored? | `joblib.dump()` → `.sav` file; loaded with `joblib.load()` |
| What if a feature is missing at inference time? | `SimpleImputer` inside the pipeline handles it automatically |

---

## Implementation Checklist

- [ ] `jobs/config.py` created with all paths derived from `PROJECT_ROOT`
- [ ] `jobs/utils_db.py` has `sqlite_conn` context manager and `ensure_predictions_table`
- [ ] ETL job reads operational DB, engineers features, writes `modeling_orders` to warehouse
- [ ] Feature engineering logic is **identical** in ETL and inference scripts
- [ ] Training job uses `ColumnTransformer` with separate numeric and categorical pipelines
- [ ] `remainder="drop"` on `ColumnTransformer` to exclude ID columns from model input
- [ ] Three artifacts saved: `.sav` model, `model_metadata.json`, `metrics.json`
- [ ] `ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)` called before saving artifacts
- [ ] Inference queries only `WHERE fulfilled = 0` (unfulfilled orders)
- [ ] Inference uses `predict_proba[:, 1]` for probability scores, not just `predict`
- [ ] Inference writes `INSERT OR REPLACE` so re-runs don't create duplicate rows
- [ ] Jobs scheduled: ETL nightly → training nightly (after ETL) → inference every 5 min
- [ ] App queries `order_predictions` table; no ML code in app layer
- [ ] Priority queue sorts by `late_delivery_probability DESC`
