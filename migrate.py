"""One-time script to migrate shop.db tables into Supabase (PostgreSQL)."""
import sqlite3
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).resolve().parent / ".env.local")
engine = create_engine(os.environ["DATABASE_URL"])
sqlite = sqlite3.connect("shop.db")

# Drop existing tables in dependency-safe order using CASCADE
with engine.connect() as conn:
    for table in ["order_items", "orders", "products", "customers"]:
        conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
    conn.commit()

# Load tables (order matters -- parents first)
for table in ["customers", "products", "orders", "order_items"]:
    df = pd.read_sql(f"SELECT * FROM {table}", sqlite)
    df.to_sql(table, engine, if_exists="replace", index=False)
    print(f"{table}: {len(df)} rows migrated")

sqlite.close()
