import joblib
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "fingrow_v3_relative_logistic.joblib"

model = joblib.load(MODEL_PATH)

print("FinGrow ML model loaded successfully.")
print("Model type:", type(model))