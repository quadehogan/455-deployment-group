import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root (one level up from jobs/)
load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")

PROJECT_ROOT  = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"

MODEL_PATH          = ARTIFACTS_DIR / "late_delivery_model.sav"
MODEL_METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"
METRICS_PATH        = ARTIFACTS_DIR / "metrics.json"

FRAUD_MODEL_PATH          = ARTIFACTS_DIR / "fraud_model.sav"
FRAUD_MODEL_METADATA_PATH = ARTIFACTS_DIR / "fraud_model_metadata.json"
FRAUD_METRICS_PATH        = ARTIFACTS_DIR / "fraud_metrics.json"

FRAUD_API_URL = os.environ.get(
    "FRAUD_API_URL",
    "https://fraud-detection-api-production-2465.up.railway.app",
)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Optional: direct PostgreSQL (used by ETL/training when available)
DATABASE_URL = os.environ.get("DATABASE_URL", "")
