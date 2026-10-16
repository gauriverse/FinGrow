import time
import threading
import yfinance as yf
import numpy as np


def get_stock_data(symbol: str):
    stock = yf.Ticker(symbol)
    info = stock.info

    # Primary price source
    price = info.get("currentPrice")

    # Fallback for ETFs like NIFTYBEES
    if price is None:
        try:
            price = stock.fast_info.get("lastPrice")
        except Exception:
            price = None

    # Final fallback: latest historical close
    history = stock.history(period="2d")

    if price is None and not history.empty:
        price = history.iloc[-1]["Close"]

    previous_close = info.get("previousClose")
    if previous_close is None and len(history) >= 2:
        previous_close = history.iloc[-2]["Close"]

    change = None
    change_percent = None

    if price is not None and previous_close is not None and previous_close != 0:
        change = price - previous_close
        change_percent = (change / previous_close) * 100

    open_price = info.get("open")
    if open_price is None and not history.empty:
        open_price = history.iloc[-1]["Open"]

    return {
        "symbol": symbol.upper(),
        "company": info.get("longName"),
        "price": round(float(price), 2) if price is not None else None,
        "previousClose": round(float(previous_close), 2)
            if previous_close is not None else None,
        "change": round(float(change), 2)
            if change is not None else None,
        "changePercent": round(float(change_percent), 2)
            if change_percent is not None else None,
        "open": round(float(open_price), 2)
            if open_price is not None else None,
        "dayHigh": info.get("dayHigh"),
        "dayLow": info.get("dayLow"),
        "volume": info.get("volume"),
        "marketCap": info.get("marketCap"),
        "currency": info.get("currency"),
        "exchange": info.get("exchange"),

        # Fundamentals
        "peRatio": info.get("trailingPE"),
        "eps": info.get("trailingEps"),
        "dividendYield": info.get("dividendYield"),
        "week52High": info.get("fiftyTwoWeekHigh"),
        "week52Low": info.get("fiftyTwoWeekLow"),
        "bookValue": info.get("bookValue"),
        "priceToBook": info.get("priceToBook"),
        "returnOnEquity": info.get("returnOnEquity"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
    }


def get_stock_history(symbol: str):
    stock = yf.Ticker(symbol)

    history = stock.history(period="1y", auto_adjust=False)

    

    data = []

    for date, row in history.iterrows():
        data.append({
            "date": str(date.date()),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "adj_close": float(row["Adj Close"]),
            "volume": int(row["Volume"])
        })

    return {
        "symbol": symbol.upper(),
        "period": "1y",
        "data": data
    }

def get_nifty():
    stock = yf.Ticker("^NSEI")

    data = stock.history(period="5d")

    if data.empty or len(data) < 2:
        raise RuntimeError("Not enough NIFTY data available")

    latest = data.iloc[-1]
    previous = data.iloc[-2]

    price = float(latest["Close"])
    previous_close = float(previous["Close"])

    change = price - previous_close
    change_percent = (change / previous_close) * 100

    return {
        "name": "NIFTY 50",
        "symbol": "^NSEI",
        "price": round(price, 2),
        "previousClose": round(previous_close, 2),
        "change": round(change, 2),
        "changePercent": round(change_percent, 2),
        "open": round(float(latest["Open"]), 2),
        "high": round(float(latest["High"]), 2),
        "low": round(float(latest["Low"]), 2),
        "volume": int(latest["Volume"])
    }

def get_sensex():
    stock = yf.Ticker("^BSESN")

    data = stock.history(period="5d")

    if data.empty or len(data) < 2:
        raise RuntimeError("Not enough Sensex data available")

    latest = data.iloc[-1]
    previous = data.iloc[-2]

    price = float(latest["Close"])
    previous_close = float(previous["Close"])

    change = price - previous_close
    change_percent = (change / previous_close) * 100

    return {
        "name": "SENSEX",
        "symbol": "^BSESN",
        "price": round(price, 2),
        "previousClose": round(previous_close, 2),
        "change": round(change, 2),
        "changePercent": round(change_percent, 2),
        "open": round(float(latest["Open"]), 2),
        "high": round(float(latest["High"]), 2),
        "low": round(float(latest["Low"]), 2),
        "volume": int(latest["Volume"])
    }

MOVER_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS",
    "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS",
    "TITAN.NS", "ASIANPAINT.NS", "HCLTECH.NS", "WIPRO.NS", "ULTRACEMCO.NS",
    "M&M.NS", "NTPC.NS", "POWERGRID.NS", "TATASTEEL.NS", "ADANIENT.NS",
    "ADANIPORTS.NS", "COALINDIA.NS", "ONGC.NS", "JSWSTEEL.NS", "TECHM.NS",
    "TMPV.NS", "TMCV.NS", "INDUSINDBK.NS", "BAJAJFINSV.NS", "NESTLEIND.NS",
    "GRASIM.NS", "HINDALCO.NS", "DRREDDY.NS", "CIPLA.NS", "EICHERMOT.NS",
    "HEROMOTOCO.NS", "APOLLOHOSP.NS", "BRITANNIA.NS", "DIVISLAB.NS", "BPCL.NS",
    "IOC.NS", "TATACONSUM.NS", "BEL.NS", "TRENT.NS", "SHRIRAMFIN.NS",
    "HDFCLIFE.NS",
]

_closes_cache = {}
_closes_lock = threading.Lock()


def get_last_two_closes(symbols, ttl=60):
    """
    One batched Yahoo request for many symbols.
    Returns {symbol: (latest_close, previous_close)}.
    """
    symbols = tuple(sorted(set(symbols)))
    if not symbols:
        return {}

    with _closes_lock:
        hit = _closes_cache.get(symbols)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]

        try:
            data = yf.download(
                list(symbols),
                period="5d",
                interval="1d",
                auto_adjust=False,
                progress=False,
                threads=True,
            )
            closes = data["Close"]
            if len(symbols) == 1:
                closes = closes.to_frame(symbols[0]) if hasattr(closes, "to_frame") else closes
        except Exception:
            if hit:
                return hit[1]
            raise

        result = {}
        for symbol in symbols:
            if symbol not in closes.columns:
                continue
            series = closes[symbol].dropna()
            if len(series) < 2:
                continue
            result[symbol] = (float(series.iloc[-1]), float(series.iloc[-2]))

        _closes_cache[symbols] = (time.time(), result)
        return result


def get_market_movers():
    closes = get_last_two_closes(MOVER_SYMBOLS, ttl=120)

    movers = []
    for symbol, (today, yesterday) in closes.items():
        if yesterday == 0:
            continue
        change = ((today - yesterday) / yesterday) * 100
        if not np.isfinite(change):
            continue
        movers.append({
            "symbol": symbol,
            "price": round(today, 2),
            "change_percent": round(float(change), 2),
        })

    gainers = sorted(movers, key=lambda x: x["change_percent"], reverse=True)
    losers = sorted(movers, key=lambda x: x["change_percent"])

    return {"gainers": gainers[:3], "losers": losers[:3]}


def search_stock_symbols(query: str):
    query = query.strip()

    if not query:
        return []

    search = yf.Search(query)
    results = search.quotes

    stocks = []

    for item in results:
        symbol = item.get("symbol")

        if not symbol:
            continue

        # FinGrow supports NSE stocks
        if not symbol.endswith(".NS"):
            continue

        stocks.append({
            "symbol": symbol,
            "name": (
                item.get("longname")
                or item.get("shortname")
                or symbol
            )
        })

        # We only need 10 NSE results
        if len(stocks) >= 10:
            break

    return stocks