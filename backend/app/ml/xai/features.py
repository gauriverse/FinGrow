
import numpy as np
import pandas as pd

from app.ml.inference import (
    FEATURE_COLUMNS,
    calculate_inference_features,
)

REQUIRED_RAW_COLUMNS = [
    "Open",
    "High",
    "Low",
    "Close",
    "Adj_Close",
    "Volume",
]


def validate_ohlcv(df: pd.DataFrame) -> None:
    """Validate the raw historical stock data."""
    if not isinstance(df, pd.DataFrame):
        raise TypeError("Stock history must be a pandas DataFrame.")

    missing = [
        column for column in REQUIRED_RAW_COLUMNS
        if column not in df.columns
    ]
    if missing:
        raise ValueError(
            f"Stock history is missing columns: {missing}"
        )

    if len(df) < 51:
        raise ValueError(
            "At least 51 historical rows are required "
            "to calculate the model features."
        )


def validate_background(background: pd.DataFrame) -> None:
    """Validate a background dataset in model feature space."""
    if not isinstance(background, pd.DataFrame):
        raise TypeError("Background must be a pandas DataFrame.")

    if list(background.columns) != FEATURE_COLUMNS:
        raise ValueError(
            "Background columns must match FEATURE_COLUMNS "
            "in the exact expected order."
        )

    if background.empty:
        raise ValueError("Background dataset cannot be empty.")

    values = background.to_numpy(dtype=float)

    if not np.isfinite(values).all():
        raise ValueError(
            "Background dataset contains NaN or infinite values."
        )


def extract_feature_row(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate and return the latest valid model feature row."""
    validate_ohlcv(df)

    features = calculate_inference_features(df.copy())

    features = features.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    valid = features.dropna(subset=FEATURE_COLUMNS)

    if valid.empty:
        raise ValueError(
            "No valid feature rows could be calculated "
            "from this stock history."
        )

    latest = valid[FEATURE_COLUMNS].iloc[[-1]].copy()

    values = latest.to_numpy(dtype=float)
    if not np.isfinite(values).all():
        raise ValueError(
            "Latest feature row contains invalid numeric values."
        )

    return latest
