import pandas as pd
import numpy as np
from app.services.yahoo_service import get_stock_history
from app.ml.model_loader import model


FEATURE_COLUMNS = [
    "Return_1D",
    "Return_5D",
    "Return_20D",
    "Volatility_5D",
    "Volatility_20D",
    "SMA_Ratio_20",
    "SMA_Ratio_50",
    "Volume_Ratio_20",
    "High_Low_Range",
    "Close_Open_Range",
]

STOCKS = [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "ICICIBANK.NS",
    "INFY.NS",
    "HINDUNILVR.NS",
    "ITC.NS",
    "SBIN.NS",
    "BHARTIARTL.NS",
    "KOTAKBANK.NS",
    "LT.NS",
    "AXISBANK.NS",
    "BAJFINANCE.NS",
    "MARUTI.NS",
    "SUNPHARMA.NS",
    "TITAN.NS",
    "ASIANPAINT.NS",
    "HCLTECH.NS",
    "WIPRO.NS",
    "ULTRACEMCO.NS",
    "M&M.NS",
    "NTPC.NS",
    "POWERGRID.NS",
    "TATASTEEL.NS",
    "ADANIENT.NS",
    "ADANIPORTS.NS",
    "COALINDIA.NS",
    "ONGC.NS",
    "JSWSTEEL.NS",
    "TECHM.NS",
]


def calculate_inference_features(df: pd.DataFrame) -> pd.DataFrame:
    temp = df.copy()

    temp["Return_1D"] = temp["Adj_Close"].pct_change(1)
    temp["Return_5D"] = temp["Adj_Close"].pct_change(5)
    temp["Return_20D"] = temp["Adj_Close"].pct_change(20)

    temp["Volatility_5D"] = temp["Return_1D"].rolling(5).std()
    temp["Volatility_20D"] = temp["Return_1D"].rolling(20).std()

    sma_20 = temp["Adj_Close"].rolling(20).mean()
    sma_50 = temp["Adj_Close"].rolling(50).mean()

    temp["SMA_Ratio_20"] = temp["Adj_Close"] / sma_20
    temp["SMA_Ratio_50"] = temp["Adj_Close"] / sma_50

    volume_20 = temp["Volume"].rolling(20).mean()
    temp["Volume_Ratio_20"] = temp["Volume"] / volume_20

    temp["High_Low_Range"] = (
        temp["High"] - temp["Low"]
    ) / temp["Adj_Close"]

    temp["Close_Open_Range"] = (
        temp["Close"] - temp["Open"]
    ) / temp["Open"]

    return temp

def predict_probability(history_response: dict) -> float:
    df = pd.DataFrame(history_response["data"])

    df = df.rename(columns={
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "volume": "Volume",
    })

    df["Adj_Close"] = df["Close"]
    features = calculate_inference_features(df)

    latest_features = (
        features[FEATURE_COLUMNS]
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
        .tail(1)
    )

    if latest_features.empty:
        raise ValueError("Not enough valid data to calculate inference features.")

    probability = model.predict_proba(latest_features)[0, 1]

    return float(probability)


def rank_stocks():
    rankings = []

    for symbol in STOCKS:
        try:
            history_response = get_stock_history(symbol)

            probability = predict_probability(history_response)
            volatility = get_latest_volatility(history_response)

            rankings.append({
                "symbol": symbol,
                "model_probability": probability,
                "volatility_20d": volatility,
            })

        except Exception as e:
            print(f"Could not process {symbol}: {e}")

    rankings.sort(
        key=lambda stock: stock["model_probability"],
        reverse=True
    )

    volatilities = sorted(
    stock["volatility_20d"]
    for stock in rankings
)

    for stock in rankings:
        count_below_or_equal = sum(
            volatility <= stock["volatility_20d"]
            for volatility in volatilities
        )

        stock["volatility_percentile"] = (
            (count_below_or_equal - 1) / (len(volatilities) - 1) * 100
            if len(volatilities) > 1
            else 0
        )
    
    for index, stock in enumerate(rankings, start=1):
        stock["rank"] = index

    return rankings

def get_latest_volatility(history_response: dict) -> float:
    df = pd.DataFrame(history_response["data"])

    df = df.rename(columns={
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "volume": "Volume",
    })

    df["Adj_Close"] = df["adj_close"]

    features = calculate_inference_features(df)

    latest = (
        features["Volatility_20D"]
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
        .tail(1)
    )

    if latest.empty:
        raise ValueError("Not enough data to calculate volatility.")

    return float(latest.iloc[0])