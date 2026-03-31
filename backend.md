# Backend Implementation Guide

## Your Responsibility

You own everything except the Next.js page UI. Specifically:

- Supabase schema and data migration
- Python ML pipeline jobs (`jobs/`)
- Cron scheduling
- The Next.js API route that the "Run Scoring" button calls

The Next.js app pages are the frontend team's concern. You only need to deliver working data in Supabase tables and one API route.

---

## Backend Tech Stack

| Layer | Tool |
|---|---|
| Database | Supabase (PostgreSQL) |
| Python runtime | Python 3.10+ in a virtual environment |
| DB connection (Python) | `psycopg2-binary`, `sqlalchemy` |
| ML pipeline | `pandas`, `scikit-learn`, `joblib` |
| Env vars | `python-dotenv` |
| Job scheduling | Local cron (Mac) |
| Scoring API route | Next.js App Router API route (`web/app/api/score/route.ts`) |

---

## Folder Structure

```
deployment/
  artifacts/
    late_delivery_model.sav
    model_metadata.json
    metrics.json
  jobs/
    config.py
    utils_db.py
    feature_engineering.py      ← shared feature logic (see Phase 1)
    etl_build_warehouse.py
    train_model.py
    run_inference.py
  logs/
  web/                          ← Next.js app lives here
    app/
      api/
        score/
          route.ts              ← scoring API route (see Phase 5)
  .env.local                    ← never commit
  .env.example                  ← commit this
  .gitignore
```

---

## Phase 0: Supabase + Project Setup

### 0.1 — Create the Supabase project

1. Log into [supabase.com](https://supabase.com) and create a new project (e.g., `shop-ml`).
2. Go to **Settings → API** and copy:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Go to **Settings → Database** and copy the **Connection string** (URI format). This is your `DATABASE_URL`.

### 0.2 — Local environment

```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install pandas scikit-learn joblib psycopg2-binary sqlalchemy python-dotenv
```

Create `.env.local` in the project root (never commit this):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

Create `.env.example` (commit this):

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
DATABASE_URL=
```

Add to `.gitignore`:

```
.env.local
artifacts/*.sav
logs/
__pycache__/
.venv/
```

> **Note:** Commit `artifacts/model_metadata.json` and `artifacts/metrics.json` but you may optionally exclude the `.sav` binary with a `.gitignore` rule. The PLAN commits all three — follow the team decision.

### 0.3 — Migrate shop data into Supabase

Export each table from `shop.db` to CSV, then import via the Supabase Table Editor UI.

Tables required: `customers`, `orders`, `order_items`, `products`

Alternatively, write a one-time `migrate.py`:

```python
import sqlite3
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).resolve().parent / ".env.local")
engine = create_engine(os.environ["DATABASE_URL"])
sqlite = sqlite3.connect("shop.db")

for table in ["customers", "orders", "order_items", "products"]:
    df = pd.read_sql(f"SELECT * FROM {table}", sqlite)
    df.to_sql(table, engine, if_exists="replace", index=False)
    print(f"{table}: {len(df)} rows migrated")

sqlite.close()
```

Run it once from the project root:

```bash
python migrate.py
```

### 0.4 — Create `jobs/config.py`

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")

PROJECT_ROOT  = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"

MODEL_PATH          = ARTIFACTS_DIR / "late_delivery_model.sav"
MODEL_METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"
METRICS_PATH        = ARTIFACTS_DIR / "metrics.json"

DATABASE_URL = os.environ["DATABASE_URL"]
```

### 0.5 — Create `jobs/utils_db.py`

```python
import psycopg2
from contextlib import contextmanager
from config import DATABASE_URL

@contextmanager
def pg_conn():
    conn = psycopg2.connect(DATABASE_URL)
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
        prediction_timestamp TIMESTAMPTZ
    )
    """)
    conn.commit()
```

### Phase 0 Checklist

- [ ] `python -c "import sys; sys.path.insert(0,'jobs'); from utils_db import pg_conn; pg_conn().__enter__(); print('connected')"` — prints `connected`
- [ ] Supabase Table Editor shows `customers`, `orders`, `order_items`, `products` with rows
- [ ] Row counts match `shop.db`
- [ ] `git status` does not show `.env.local`
- [ ] `git status` shows `.env.example` committed

---

## Phase 1: ETL — Build the Warehouse

### 1.1 — Create the shared feature engineering module

**Create `jobs/feature_engineering.py`** — this is the single place where feature logic lives. Both ETL and inference import from here, guaranteeing they always apply identical transformations.

```python
from datetime import datetime
import pandas as pd

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame with order_timestamp and birthdate columns.
    Adds customer_age, order_dow, order_month in place.
    Returns the modified DataFrame.
    """
    df = df.copy()
    df["order_timestamp"] = pd.to_datetime(df["order_timestamp"], errors="coerce")
    df["birthdate"]       = pd.to_datetime(df["birthdate"],       errors="coerce")

    now_year = datetime.now().year
    df["customer_age"] = now_year - df["birthdate"].dt.year
    df["order_dow"]    = df["order_timestamp"].dt.dayofweek
    df["order_month"]  = df["order_timestamp"].dt.month

    return df

FEATURE_COLS = [
    "num_items", "total_value", "avg_weight",
    "customer_age", "order_dow", "order_month"
]

MODELING_COLS = [
    "order_id", "customer_id",
    "num_items", "total_value", "avg_weight",
    "customer_age", "order_dow", "order_month",
    "label_late_delivery"
]
```

### 1.2 — Create `jobs/etl_build_warehouse.py`

```python
import pandas as pd
from sqlalchemy import create_engine
from config import DATABASE_URL
from utils_db import pg_conn
from feature_engineering import add_features, MODELING_COLS

def build_modeling_table():
    with pg_conn() as conn:
        df = pd.read_sql("""
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
        """, conn)

    df = add_features(df)
    df_model = df[MODELING_COLS].dropna(subset=["label_late_delivery"])

    engine = create_engine(DATABASE_URL)
    df_model.to_sql("modeling_orders", engine, if_exists="replace", index=False)

    return len(df_model)

if __name__ == "__main__":
    n = build_modeling_table()
    print(f"Warehouse updated. modeling_orders rows: {n}")
```

Run from the project root:

```bash
cd jobs && python etl_build_warehouse.py
```

### Phase 1 Checklist

- [ ] Script runs without error and prints a row count > 0
- [ ] `modeling_orders` exists in Supabase Table Editor
- [ ] Columns: `order_id`, `customer_id`, `num_items`, `total_value`, `avg_weight`, `customer_age`, `order_dow`, `order_month`, `label_late_delivery`
- [ ] `SELECT COUNT(*) FROM modeling_orders WHERE label_late_delivery IS NULL` → 0
- [ ] Re-running the script produces the same row count (no duplicates)

---

## Phase 2: Training — Train and Save the Model

### 2.1 — Create `jobs/train_model.py`

```python
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

from config import ARTIFACTS_DIR, MODEL_PATH, MODEL_METADATA_PATH, METRICS_PATH
from utils_db import pg_conn
from feature_engineering import FEATURE_COLS

MODEL_VERSION = "1.0.0"

def train_and_save():
    with pg_conn() as conn:
        df = pd.read_sql("SELECT * FROM modeling_orders", conn)

    label_col = "label_late_delivery"
    X = df[FEATURE_COLS]
    y = df[label_col].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_pipe = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    preprocessor = ColumnTransformer(
        transformers=[("num", numeric_pipe, FEATURE_COLS)],
        remainder="drop"
    )

    model = Pipeline([
        ("prep", preprocessor),
        ("clf",  LogisticRegression(max_iter=500, n_jobs=-1))
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
```

Run:

```bash
cd jobs && python train_model.py
```

Then commit the artifacts:

```bash
git add artifacts/
git commit -m "Add trained model artifacts v1.0.0"
```

### Phase 2 Checklist

- [ ] Script runs without error and prints metrics
- [ ] `artifacts/late_delivery_model.sav`, `artifacts/model_metadata.json`, `artifacts/metrics.json` all exist
- [ ] `python -c "import joblib; m = joblib.load('artifacts/late_delivery_model.sav'); print(type(m))"` → `<class 'sklearn.pipeline.Pipeline'>`
- [ ] ROC-AUC > 0.5; no NaN values in output
- [ ] `model_metadata.json` has `trained_at_utc`, `feature_list`, `warehouse_rows` populated
- [ ] `git log --oneline` shows the artifacts commit

---

## Phase 3: Inference — Score Live Orders

### 3.1 — Create `jobs/run_inference.py`

```python
import pandas as pd
import joblib
from datetime import datetime

from config import MODEL_PATH
from utils_db import pg_conn, ensure_predictions_table
from feature_engineering import add_features, FEATURE_COLS

def run_inference():
    model = joblib.load(str(MODEL_PATH))

    with pg_conn() as conn:
        df_live = pd.read_sql("""
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
        """, conn)

    df_live = add_features(df_live)
    X_live  = df_live[FEATURE_COLS]

    probs = model.predict_proba(X_live)[:, 1]
    preds = model.predict(X_live)

    ts = datetime.utcnow()  # psycopg2 maps Python datetime → TIMESTAMPTZ natively
    out_rows = [
        (int(oid), float(p), int(yhat), ts)
        for oid, p, yhat in zip(df_live["order_id"], probs, preds)
    ]

    with pg_conn() as conn:
        ensure_predictions_table(conn)
        cur = conn.cursor()
        cur.executemany("""
        INSERT INTO order_predictions
            (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (order_id) DO UPDATE SET
            late_delivery_probability = EXCLUDED.late_delivery_probability,
            predicted_late_delivery   = EXCLUDED.predicted_late_delivery,
            prediction_timestamp      = EXCLUDED.prediction_timestamp
        """, out_rows)
        conn.commit()

    print(f"Inference complete. Predictions written: {len(out_rows)}")

if __name__ == "__main__":
    run_inference()
```

Run:

```bash
cd jobs && python run_inference.py
```

### Phase 3 Checklist

- [ ] Script runs without error and prints `Predictions written: N` where N > 0
- [ ] `order_predictions` exists in Supabase Table Editor
- [ ] `SELECT MIN(late_delivery_probability), MAX(late_delivery_probability) FROM order_predictions` → both between 0.0 and 1.0
- [ ] Re-running the script keeps the same row count (upsert, not insert)
- [ ] Priority queue query returns rows sorted by probability DESC:
  ```sql
  SELECT o.order_id, c.first_name, p.late_delivery_probability
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  JOIN order_predictions p ON p.order_id = o.order_id
  WHERE o.fulfilled = 0
  ORDER BY p.late_delivery_probability DESC
  LIMIT 10;
  ```

---

## Phase 4: Cron Scheduling

### 4.1 — Set up cron jobs

Find the absolute path to your virtual environment's Python:

```bash
which python   # run this while the venv is active
# e.g. /Users/yourname/project/.venv/bin/python
```

Find the absolute path to your project root:

```bash
pwd
# e.g. /Users/yourname/project/deployment
```

Open crontab:

```bash
crontab -e
```

Add these three entries (replace paths with your actual paths):

```
# Nightly ETL at 1:00am
0 1 * * *  cd /Users/yourname/project/deployment/jobs && /Users/yourname/project/deployment/.venv/bin/python etl_build_warehouse.py >> /Users/yourname/project/deployment/logs/etl.log 2>&1

# Nightly training at 1:10am (after ETL finishes)
10 1 * * * cd /Users/yourname/project/deployment/jobs && /Users/yourname/project/deployment/.venv/bin/python train_model.py >> /Users/yourname/project/deployment/logs/train.log 2>&1

# Inference every 5 minutes
*/5 * * * * cd /Users/yourname/project/deployment/jobs && /Users/yourname/project/deployment/.venv/bin/python run_inference.py >> /Users/yourname/project/deployment/logs/infer.log 2>&1
```

> `config.py` loads `.env.local` via `python-dotenv` using an absolute path, so cron jobs pick up credentials automatically as long as `cd` sets the correct working directory.

### Phase 4 Checklist

- [ ] `crontab -l` shows all three entries
- [ ] Run each script manually one more time to confirm no path issues
- [ ] After up to 5 minutes: `tail logs/infer.log` shows `Inference complete. Predictions written: N`
- [ ] `logs/etl.log`, `logs/train.log`, `logs/infer.log` all exist
- [ ] `grep -i error logs/infer.log` returns nothing

---

## Phase 5: Scoring API Route

The `/scoring` page (built by the frontend team) needs a backend API route to trigger inference on demand.

**Important Vercel limitation:** Vercel cannot execute local Python scripts. The `/scoring` button works in local development only. In production, scoring is handled automatically by the cron job. The API route should communicate this clearly when deployed.

### 5.1 — Create `web/app/api/score/route.ts`

> The Next.js app lives in `web/`, so `process.cwd()` resolves to `web/` at runtime.
> Go up one level (`..`) to reach the project root where `.venv/` and `jobs/` live.

```typescript
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

export async function POST() {
  // This only works in local development.
  // In production (Vercel), scoring is handled by the cron job.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "Scoring runs automatically via cron in production." },
      { status: 200 }
    );
  }

  // process.cwd() is web/ — step up to project root for Python + jobs
  const projectRoot = path.resolve(process.cwd(), "..");
  const pythonPath  = path.join(projectRoot, ".venv", "bin", "python");
  const scriptPath  = path.join(projectRoot, "jobs", "run_inference.py");

  return new Promise((resolve) => {
    execFile(pythonPath, [scriptPath], { cwd: path.join(projectRoot, "jobs") }, (error, stdout, stderr) => {
      if (error) {
        console.error("Inference error:", stderr);
        resolve(NextResponse.json({ error: stderr }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ message: stdout.trim() }, { status: 200 }));
      }
    });
  });
}
```

The frontend team's `/scoring` page should call `POST /api/score` and display the response message.

---

## Running Scripts: Quick Reference

All Python jobs must be run from the `jobs/` directory so that relative imports (`from config import ...`) resolve correctly:

```bash
# From the project root:
cd jobs && python etl_build_warehouse.py
cd jobs && python train_model.py
cd jobs && python run_inference.py
```

Or set `PYTHONPATH`:

```bash
PYTHONPATH=jobs python jobs/etl_build_warehouse.py
```

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Shared `feature_engineering.py` | Guarantees ETL and inference apply identical transformations; avoids drift |
| `feature_engineering.FEATURE_COLS` imported in `train_model.py` | The model is always trained on exactly the features inference will supply |
| Upsert in inference | Re-running is safe; no duplicate rows |
| Scoring API returns 200 in production | Vercel cannot exec Python — cron handles it; avoid misleading 500 errors |
| `cd jobs &&` in cron | Keeps imports simple; `config.py` loads `.env.local` by absolute path so this is safe |
