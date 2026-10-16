import time
import threading
from fastapi import APIRouter, HTTPException
from app.services.stock_db_service import (
    upsert_stock,
    upsert_stock_history
)
from app.services.yahoo_service import (
    get_stock_data,
    get_stock_history,
    get_nifty,
    get_sensex,
    get_market_movers,
    search_stock_symbols
)

router = APIRouter()

_cache = {}
_locks = {}
_guard = threading.Lock()

def cached(key, ttl, fn):
    """Return a cached value for `ttl` seconds. Concurrent callers share one fn() call."""
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]

    with _guard:
        lock = _locks.setdefault(key, threading.Lock())

    with lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]  # another request just refreshed it
        try:
            value = fn()
        except Exception:
            if hit:
                return hit[1]  # serve stale data if Yahoo fails
            raise
        _cache[key] = (time.time(), value)
        return value


@router.get("/stock/{symbol}")
def stock(symbol: str):
    def load():
        data = get_stock_data(symbol)
        upsert_stock(data)
        return data

    return cached(f"stock:{symbol}",20,load)


@router.get("/history/{symbol}")
def get_history(symbol: str):
    def load():
        stock_data = get_stock_data(symbol)
        stock_rows = upsert_stock(stock_data)
        if not stock_rows:
            raise HTTPException(status_code=500, detail="Stock could not be created")
        history_data = get_stock_history(symbol)
        upsert_stock_history(stock_rows[0]["id"], history_data)
        return history_data

    return cached(f"history:{symbol}", 3600, load)


@router.get("/nifty")
def nifty():
    return cached("nifty", 30, get_nifty)


@router.get("/sensex")
def sensex():
    return cached("sensex", 30, get_sensex)

@router.get("/movers")
def movers():
    return cached("movers", 120, get_market_movers)


@router.get("/search")
def search_stocks(query: str):
    return cached(f"search:{query.lower().strip()}", 600, lambda: search_stock_symbols(query))