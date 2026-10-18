
from functools import lru_cache

import numpy as np
import pandas as pd

from app.ml.inference import FEATURE_COLUMNS, calculate_inference_features
from app.ml.model_loader import model
from app.ml.xai.explainer import FinGrowExplainer
from app.services.yahoo_service import get_stock_history


# Initial representative background for testing.
# We will refine the background strategy before production.
BACKGROUND_SYMBOLS = [
    "TCS.NS",
    "RELIANCE.NS",
    "HDFCBANK.NS",
    "INFY.NS",
    "SBIN.NS",
]


def _history_to_dataframe(symbol: str) -> pd.DataFrame:
    response = get_stock_history(symbol)
    data = response.get("data", [])

    if not data:
        raise ValueError(f"No historical data available for {symbol}.")

    df = pd.DataFrame(data)

    df.rename(
        columns={
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume",
        },
        inplace=True,
    )

    # Preserve the existing FinGrow inference behavior.
    df["Adj_Close"] = df["Close"]

    return df


@lru_cache(maxsize=1)
def _get_explainer() -> FinGrowExplainer:
    background_rows = []

    for symbol in BACKGROUND_SYMBOLS:
        try:
            history = _history_to_dataframe(symbol)

            features = calculate_inference_features(history.copy())
            features = features.replace(
                [np.inf, -np.inf], np.nan
            )

            valid = features.dropna(subset=FEATURE_COLUMNS)

            if not valid.empty:
                background_rows.append(
                    valid[FEATURE_COLUMNS].tail(40).copy()
                )

        except Exception as exc:
            print(f"XAI background skipped {symbol}: {exc}")

    if len(background_rows) < 2:
        raise RuntimeError(
            "Unable to build the XAI background from enough stocks."
        )

    background = pd.concat(
        background_rows,
        ignore_index=True,
    )

    background = background.replace(
        [np.inf, -np.inf], np.nan
    ).dropna(subset=FEATURE_COLUMNS)

    background = background.loc[
        np.isfinite(background[FEATURE_COLUMNS]).all(axis=1),
        FEATURE_COLUMNS,
    ].copy()

    if background.empty:
        raise RuntimeError("The XAI background contains no valid rows.")

    return FinGrowExplainer(model, background)


def explain_stock(symbol: str) -> dict:
    normalized_symbol = symbol.strip().upper()

    if not normalized_symbol:
        raise ValueError("Stock symbol cannot be empty.")

    history = _history_to_dataframe(normalized_symbol)
    explainer = _get_explainer()

    result = explainer.explain(
        normalized_symbol,
        history,
    )

    return result.to_dict()
