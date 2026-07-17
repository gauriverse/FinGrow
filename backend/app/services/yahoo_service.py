import yfinance as yf


def get_stock_data(symbol: str):
    stock = yf.Ticker(symbol)
    info = stock.info

    return {
        "symbol": symbol.upper(),
        "company": info.get("longName"),
        "price": info.get("currentPrice"),
        "previousClose": info.get("previousClose"),
        "open": info.get("open"),
        "dayHigh": info.get("dayHigh"),
        "dayLow": info.get("dayLow"),
        "volume": info.get("volume"),
        "marketCap": info.get("marketCap"),
        "currency": info.get("currency"),
        "exchange": info.get("exchange"),
    }


def get_stock_history(symbol: str):
    stock = yf.Ticker(symbol)

    history = stock.history(period="1y")

    data = []

    for date, row in history.iterrows():
        data.append({
            "date": str(date.date()),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"])
        })

    return {
        "symbol": symbol.upper(),
        "period": "1y",
        "data": data
    }

def get_nifty():
    stock = yf.Ticker("^NSEI")

    data = stock.history(period="1d")

    latest = data.iloc[-1]

    return {
        "name": "NIFTY 50",
        "symbol": "^NSEI",
        "price": round(float(latest["Close"]), 2),
        "open": round(float(latest["Open"]), 2),
        "high": round(float(latest["High"]), 2),
        "low": round(float(latest["Low"]), 2),
        "volume": int(latest["Volume"])
    }


def get_sensex():
    stock = yf.Ticker("^BSESN")

    data = stock.history(period="1d")

    latest = data.iloc[-1]

    return {
        "name": "SENSEX",
        "symbol": "^BSESN",
        "price": round(float(latest["Close"]), 2),
        "open": round(float(latest["Open"]), 2),
        "high": round(float(latest["High"]), 2),
        "low": round(float(latest["Low"]), 2),
        "volume": int(latest["Volume"])
    }

def get_market_movers():

    symbols = [
        "RELIANCE.NS",
        "TCS.NS",
        "INFY.NS",
        "HDFCBANK.NS",
        "ICICIBANK.NS",
        "SBIN.NS",
        "ITC.NS",
        "LT.NS",
        "BHARTIARTL.NS",
        "TATAMOTORS.NS"
    ]

    movers = []

    for symbol in symbols:
        stock = yf.Ticker(symbol)

        data = stock.history(period="2d")

        if len(data) >= 2:
            today = data.iloc[-1]["Close"]
            yesterday = data.iloc[-2]["Close"]

            change = ((today - yesterday) / yesterday) * 100

            movers.append({
                "symbol": symbol,
                "price": round(float(today), 2),
                "change_percent": round(float(change), 2)
            })

    gainers = sorted(
        movers,
        key=lambda x: x["change_percent"],
        reverse=True
    )

    losers = sorted(
        movers,
        key=lambda x: x["change_percent"]
    )

    return {
        "gainers": gainers[:5],
        "losers": losers[:5]
    }    