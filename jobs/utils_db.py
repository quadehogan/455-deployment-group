import psycopg2
from contextlib import contextmanager
from urllib.parse import urlparse
from config import DATABASE_URL

def _parse_url(url):
    p = urlparse(url)
    return dict(host=p.hostname, port=p.port, dbname=p.path.lstrip("/"),
                user=p.username, password=p.password)

@contextmanager
def pg_conn():
    conn = psycopg2.connect(**_parse_url(DATABASE_URL))
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
