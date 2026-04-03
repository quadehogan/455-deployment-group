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

DATABASE_URL = os.environ["DATABASE_URL"]
