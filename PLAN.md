# Chapter 17: Deploying ML Pipelines — Implementation Plan

## Core Philosophy

Deployment is not about intelligence — it is about **integration**. A model is useful only when its predictions influence real decisions. The embedded deployment pattern keeps ML logic completely separate from application code: the app reads predictions from a table just like any other data.

Four principles govern every deployment decision:
- **Reliability** — the pipeline runs consistently and can be re-run without side effects
- **Repeatability** — the same inputs always produce the same outputs
- **Traceability** — every model artifact is versioned and its training context is recorded
- **Separation of concerns** — ETL, training, and inference are independent jobs

---

## Tech Stack

| Layer | Tool |
|---|---|
| Operational DB | Supabase (PostgreSQL) |
| Analytical DB (warehouse) | Supabase (separate `modeling_orders` table) |
| ML jobs | Python (pandas, scikit-learn, joblib, psycopg2, sqlalchemy) |
| Model artifacts | Local `artifacts/` folder (committed to GitHub) |
| Job scheduling | Local cron (Mac) |
| Web app | Next.js (App Router) |
| DB client (app) | Supabase JS client (`@supabase/supabase-js`) |
| Hosting | Vercel (auto-deploy from GitHub) |

---

## Architecture Overview

```
App (Next.js on Vercel)
    ↓ reads/writes
Supabase (PostgreSQL)   ←── inference writes predictions back here
    ├── orders, customers, order_items, products  ← operational tables
    ├── modeling_orders                           ← warehouse table (built by ETL)
    └── order_predictions                         ← output table (written by inference)
    ↓ ETL reads operational tables
ETL job (etl_build_warehouse.py)
    ↓ writes modeling_orders
Training job (train_model.py)
    ↓ produces
artifacts/late_delivery_model.sav + model_metadata.json + metrics.json
    ↓ inference loads
Inference job (run_inference.py)
```

The app never touches ML code. It only queries the `order_predictions` table. Predictions are written there by the inference job, which runs on a schedule.

---

## Project Folder Layout

```
deployment/
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
  logs/
  .env.local          ← Supabase credentials (do NOT commit)
  .env.example        ← template with key names only (commit this)
  .gitignore
```

---

## Phase 0: Supabase + Project Setup

**Goal:** Live Supabase project with shop data loaded and Python jobs able to connect.

### Steps

- [ ] Log into Supabase, create a new project (e.g., `shop-ml`)
- [ ] Get credentials from Supabase dashboard → Settings → API:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `DATABASE_URL` (direct PostgreSQL connection string — for Python jobs)
- [ ] Create `.env.local` with those values (never commit this file)
- [ ] Create `.env.example` with empty placeholders and commit it
- [ ] Add `.env.local` to `.gitignore`
- [ ] Create folder structure: `artifacts/`, `jobs/`, `logs/`
- [ ] Install Python dependencies:
  ```bash
  pip install pandas scikit-learn joblib psycopg2-binary sqlalchemy python-dotenv
  ```
- [ ] Migrate `shop.db` data into Supabase:
  - Option A: Export each SQLite table to CSV → import via Supabase Table Editor
  - Option B: Write a one-time `migrate.py` script using `psycopg2` to read from SQLite and insert into Supabase
  - Tables needed: `customers`, `orders`, `order_items`, `products`
- [ ] Create `jobs/config.py`:
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
- [ ] Create `jobs/utils_db.py`:
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
          prediction_timestamp TEXT
      )
      """)
      conn.commit()
  ```

### Phase 0 Tests — do not proceed until all pass

- [ ] **Connection test:** run `python -c "from jobs.utils_db import pg_conn; pg_conn().__enter__(); print('connected')"` — prints `connected` without error
- [ ] **Tables exist:** open Supabase Table Editor and confirm `customers`, `orders`, `order_items`, `products` are present with rows
- [ ] **Row counts match:** spot-check that total rows in Supabase match what was in `shop.db`
- [ ] **`.env.local` not tracked:** run `git status` — `.env.local` must not appear as a tracked file
- [ ] **`.env.example` committed:** `git status` shows `.env.example` staged or already committed

---

## Phase 1: ETL — Build the Warehouse

**Goal:** `modeling_orders` table exists in Supabase, containing one flat row per order with engineered features and a label.

### Steps

- [ ] Create `jobs/etl_build_warehouse.py`:
  ```python
  import pandas as pd
  from datetime import datetime
  from sqlalchemy import create_engine
  from config import DATABASE_URL
  from utils_db import pg_conn

  def build_modeling_table():
      with pg_conn() as conn:
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

      df["order_timestamp"] = pd.to_datetime(df["order_timestamp"], errors="coerce")
      df["birthdate"]       = pd.to_datetime(df["birthdate"],       errors="coerce")

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

      engine = create_engine(DATABASE_URL)
      df_model.to_sql("modeling_orders", engine, if_exists="replace", index=False)

      return len(df_model)

  if __name__ == "__main__":
      row_count = build_modeling_table()
      print(f"Warehouse updated. modeling_orders rows: {row_count}")
  ```

### Phase 1 Tests — do not proceed until all pass

- [ ] **Script runs clean:** `python jobs/etl_build_warehouse.py` completes without error and prints a row count > 0
- [ ] **Table exists in Supabase:** open Table Editor and confirm `modeling_orders` is present
- [ ] **Columns correct:** `modeling_orders` has exactly: `order_id`, `customer_id`, `num_items`, `total_value`, `avg_weight`, `customer_age`, `order_dow`, `order_month`, `label_late_delivery`
- [ ] **No nulls in label:** run in Supabase SQL editor: `SELECT COUNT(*) FROM modeling_orders WHERE label_late_delivery IS NULL` — result must be 0
- [ ] **Re-run is safe:** run the script a second time — row count stays the same (no duplicates; `if_exists="replace"` overwrites cleanly)

---

## Phase 2: Training — Train and Save the Model

**Goal:** Three artifact files exist in `artifacts/` and the model loads without error.

### Steps

- [ ] Create `jobs/train_model.py`:
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

  MODEL_VERSION = "1.0.0"

  def train_and_save():
      with pg_conn() as conn:
          df = pd.read_sql("SELECT * FROM modeling_orders", conn)

      label_col    = "label_late_delivery"
      feature_cols = [c for c in df.columns if c not in (label_col, "order_id", "customer_id")]
      X = df[feature_cols]
      y = df[label_col].astype(int)

      X_train, X_test, y_train, y_test = train_test_split(
          X, y, test_size=0.2, random_state=42, stratify=y
      )

      numeric_features     = ["num_items", "total_value", "avg_weight",
                              "customer_age", "order_dow", "order_month"]
      categorical_features = []

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

      model = Pipeline(steps=[
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
          "feature_list":    feature_cols,
          "label":           label_col,
          "warehouse_table": "modeling_orders",
          "warehouse_rows":  int(len(df))
      }

      with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
          json.dump(metadata, f, indent=2)
      with open(METRICS_PATH, "w", encoding="utf-8") as f:
          json.dump(metrics, f, indent=2)

      print(f"accuracy={metrics['accuracy']:.3f}  f1={metrics['f1']:.3f}  roc_auc={metrics['roc_auc']:.3f}")

  if __name__ == "__main__":
      train_and_save()
  ```
- [ ] Commit `artifacts/` to GitHub after training succeeds

### Phase 2 Tests — do not proceed until all pass

- [ ] **Script runs clean:** `python jobs/train_model.py` completes without error and prints metrics
- [ ] **Three files created:** confirm `artifacts/late_delivery_model.sav`, `artifacts/model_metadata.json`, `artifacts/metrics.json` all exist
- [ ] **Model loads:** `python -c "import joblib; m = joblib.load('artifacts/late_delivery_model.sav'); print(type(m))"` — prints `<class 'sklearn.pipeline.Pipeline'>`
- [ ] **Metrics are reasonable:** ROC-AUC > 0.5 (better than random); accuracy and F1 printed without NaN
- [ ] **Metadata is complete:** open `model_metadata.json` and confirm `trained_at_utc`, `feature_list`, and `warehouse_rows` are populated
- [ ] **Artifacts committed:** `git log --oneline` shows a commit containing the `artifacts/` files

---

## Phase 3: Inference — Score Live Orders

**Goal:** `order_predictions` table exists in Supabase with one row per unfulfilled order, sortable by probability.

### Steps

- [ ] Create `jobs/run_inference.py`:
  ```python
  import pandas as pd
  import joblib
  from datetime import datetime

  from config import MODEL_PATH
  from utils_db import pg_conn, ensure_predictions_table

  def run_inference():
      model = joblib.load(str(MODEL_PATH))

      with pg_conn() as conn:
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

### Phase 3 Tests — do not proceed until all pass

- [ ] **Script runs clean:** `python jobs/run_inference.py` completes without error and prints `Predictions written: N` where N > 0
- [ ] **Table exists in Supabase:** open Table Editor and confirm `order_predictions` is present
- [ ] **Probabilities are valid:** run in Supabase SQL editor: `SELECT MIN(late_delivery_probability), MAX(late_delivery_probability) FROM order_predictions` — both values must be between 0.0 and 1.0
- [ ] **Re-run is idempotent:** run `run_inference.py` a second time — row count in `order_predictions` stays the same (upsert, not insert)
- [ ] **Priority queue query works:** run the join query below in Supabase SQL editor and confirm rows are returned sorted by `late_delivery_probability DESC`:
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

## Phase 4: Scheduling

**Goal:** All three jobs run automatically on a schedule without manual intervention.

### Steps

- [ ] Create `logs/` directory
- [ ] Add cron entries via `crontab -e` (use absolute paths):
  ```bash
  # Nightly ETL at 1:00am
  0 1 * * *  cd /path/to/project && /path/to/venv/bin/python jobs/etl_build_warehouse.py >> logs/etl.log 2>&1

  # Nightly training at 1:10am (after ETL)
  10 1 * * * cd /path/to/project && /path/to/venv/bin/python jobs/train_model.py >> logs/train.log 2>&1

  # Inference every 5 minutes
  */5 * * * * cd /path/to/project && /path/to/venv/bin/python jobs/run_inference.py >> logs/infer.log 2>&1
  ```
  > `.env.local` is loaded inside `config.py` via `python-dotenv` — cron jobs pick up credentials automatically as long as the working directory is correct.

### Phase 4 Tests — do not proceed until all pass

- [ ] **Crontab saved:** `crontab -l` shows all three entries
- [ ] **Manual pre-flight:** run each script manually one more time from the terminal to confirm no path issues
- [ ] **Inference cron fires:** wait up to 5 minutes after saving crontab, then check `tail logs/infer.log` — should show `Inference complete. Predictions written: N`
- [ ] **Log files exist:** confirm `logs/etl.log`, `logs/train.log`, and `logs/infer.log` are created (ETL and train logs may be empty until 1am — that is expected)
- [ ] **No Python errors in logs:** `grep -i error logs/infer.log` returns nothing

---

## Phase 5: Next.js Web App + Vercel Deployment

**Goal:** A live Vercel URL serves all app pages and the priority queue displays real predictions from Supabase.

### Steps

- [ ] Create a Next.js app (App Router) inside the project repo
- [ ] Install Supabase JS client:
  ```bash
  npm install @supabase/supabase-js
  ```
- [ ] Create a Supabase client helper using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Build the app pages:

  | Route | Purpose |
  |---|---|
  | `/select-customer` | List customers from Supabase; store `customer_id` in cookie; redirect to `/dashboard` |
  | `/dashboard` | Customer name, total orders, total spend, 5 most recent orders |
  | `/place-order` | Product picker with quantities; inserts into `orders` + `order_items` |
  | `/orders` | Order history for selected customer |
  | `/orders/[order_id]` | Line items for a specific order |
  | `/warehouse/priority` | Late Delivery Priority Queue (join query below) |
  | `/scoring` | "Run Scoring" button — calls an API route that triggers `run_inference.py` |

- [ ] Priority queue SQL (used in `/warehouse/priority`):
  ```sql
  SELECT
      o.order_id, o.order_timestamp, o.total_value, o.fulfilled,
      c.customer_id,
      c.first_name || ' ' || c.last_name AS customer_name,
      p.late_delivery_probability,
      p.predicted_late_delivery,
      p.prediction_timestamp
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  JOIN order_predictions p ON p.order_id = o.order_id
  WHERE o.fulfilled = 0
  ORDER BY p.late_delivery_probability DESC, o.order_timestamp ASC
  LIMIT 50;
  ```
- [ ] Push project to GitHub (already connected to Vercel)
- [ ] Set environment variables in Vercel dashboard → Settings → Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Phase 5 Tests — do not proceed until all pass

- [ ] **Local dev works:** `npm run dev` starts without error; visit `http://localhost:3000` and confirm the app loads
- [ ] **Customer selection works:** `/select-customer` lists real customers from Supabase; clicking one sets the cookie and redirects to `/dashboard`
- [ ] **Dashboard shows real data:** customer name, order count, and spend are populated from Supabase (not hardcoded)
- [ ] **Place an order:** go to `/place-order`, submit an order — verify the new row appears in `orders` in the Supabase Table Editor
- [ ] **Priority queue renders:** `/warehouse/priority` shows a table sorted by `late_delivery_probability DESC` with at least one row
- [ ] **Vercel deploy succeeds:** push to `main`; confirm Vercel dashboard shows a green deployment
- [ ] **Deployed URL works:** open the Vercel URL in a browser — `/warehouse/priority` shows live data from Supabase
- [ ] **End-to-end flow:** run `python jobs/run_inference.py` locally, then refresh the Vercel URL — updated `prediction_timestamp` values appear in the priority queue

---

## Pipeline Design: Decision Table

| Question | Answer |
|---|---|
| Where does training data come from? | `Supabase → modeling_orders` (built by ETL) |
| Where do predictions go? | `Supabase → order_predictions` (written by inference) |
| What does the app query? | `order_predictions` joined to `orders` and `customers` |
| How are model artifacts versioned? | `MODEL_VERSION` string + `trained_at_utc` in metadata JSON |
| How do training and inference share feature logic? | Identical code in ETL and inference (ideally a shared `feature_engineering.py`) |
| How is the model stored? | `joblib.dump()` → `.sav` file committed to GitHub; loaded with `joblib.load()` |
| What if a feature is missing at inference time? | `SimpleImputer` inside the pipeline handles it automatically |
| How are credentials managed? | `.env.local` locally (never committed); Vercel env vars in production |
| How does the app access Supabase? | `@supabase/supabase-js` with anon key — never imports ML code |

---

## Key Deployment Principles

- **Separation of concerns:** ETL, training, and inference are separate Python scripts
- **No cleaning logic in training:** all feature engineering lives in ETL (mirrored at inference)
- **Your model is a file:** `late_delivery_model.sav` is committed to GitHub; never retrained by the app
- **Predictions are just a table:** the Vercel app queries `order_predictions` like any other Supabase table
- **Secrets never in code:** Supabase credentials live in `.env.local` (local) and Vercel env vars (production)
