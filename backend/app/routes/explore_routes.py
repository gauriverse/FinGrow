"""
Read-only Explore Stocks API:  GET /market/explore

Nothing here writes to the database. It only READS the `stocks` table and calls
the existing get_last_two_closes() (one batched Yahoo request) for day change.
"""
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.routes.market_routes import cached
from app.services.yahoo_service import get_last_two_closes
from app.supabase import admin_supabase

router = APIRouter()

COLUMNS = (
    "id,symbol,company_name,sector,exchange,"
    "current_price,market_cap,updated_at,asset_type"
)
SUPABASE_PAGE = 1000          # Supabase returns max 1000 rows per request
CRORE = 1e7                   # market_cap is stored in rupees
STALE_AFTER = timedelta(hours=96)   # covers weekend + one holiday
UNCLASSIFIED = "Unclassified"
VALID_TYPES = ("equity", "etf", "index")
VALID_SORTS = ("mcap", "price", "price_asc", "change", "change_asc", "az")
VALID_CHANGES = ("all", "gainers", "losers")

# Market-cap value ranges in Rs crore. min is inclusive, max is exclusive.
MCAP_BUCKETS = (
    ("lt1", "Under \u20b91 lakh Cr", 0.0, 1e5),
    ("1to2", "\u20b91\u20132 lakh Cr", 1e5, 2e5),
    ("2to5", "\u20b92\u20135 lakh Cr", 2e5, 5e5),
    ("5to10", "\u20b95\u201310 lakh Cr", 5e5, 1e6),
    ("gt10", "Above \u20b910 lakh Cr", 1e6, None),
)


# ---------- small helpers ----------

def _num(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _parse_time(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _day_change(price, pair):
    """
    Returns (previous_close, change, change_percent) or (None, None, None).

    Day change = current_price vs previous close. We only trust Yahoo's pair
    when its latest close matches the price we store; otherwise (market open,
    DB one session behind, bad ticker) we return None and the UI shows "—".
    """
    if price is None or not pair:
        return None, None, None
    last, prev = pair
    if not prev or abs(price - last) > max(0.01, abs(last) * 0.0005):
        return None, None, None
    change = price - prev
    return round(prev, 2), round(change, 2), round(change / prev * 100, 2)


# ---------- data loading (the only parts that touch Supabase / Yahoo) ----------

def _fetch_universe():
    """Read every row of `stocks`, 1000 at a time."""
    rows, start = [], 0
    while True:
        result = (
            admin_supabase.table("stocks")
            .select(COLUMNS)
            .order("symbol")
            .range(start, start + SUPABASE_PAGE - 1)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < SUPABASE_PAGE:
            return rows
        start += SUPABASE_PAGE


def _fetch_closes(symbols):
    """One batched Yahoo call for ALL symbols (never filtered, so cache is shared)."""
    try:
        return get_last_two_closes(symbols, ttl=120), True
    except Exception as error:  # Yahoo down -> page still works, day change shows "—"
        print(f"explore: day-change lookup failed: {error}")
        return {}, False


def _build_rows():
    raw = _fetch_universe()
    symbols = sorted({r["symbol"] for r in raw if r.get("symbol")})
    closes, closes_ok = _fetch_closes(symbols)
    now = datetime.now(timezone.utc)

    rows = []
    for r in raw:
        symbol = r.get("symbol")
        if not symbol:
            continue
        price = _num(r.get("current_price"))
        market_cap = _num(r.get("market_cap"))
        prev, change, pct = _day_change(price, closes.get(symbol))
        updated = _parse_time(r.get("updated_at"))
        sector = (r.get("sector") or "").strip() or None
        rows.append({
            "id": r.get("id"),
            "symbol": symbol,
            "company": r.get("company_name") or symbol,
            "sector": sector,
            "assetType": r.get("asset_type") or "equity",
            "exchange": r.get("exchange"),
            "price": price,
            "previousClose": prev,
            "change": change,
            "changePercent": pct,
            "marketCap": market_cap,
            "marketCapCr": round(market_cap / CRORE, 2) if market_cap is not None else None,
            "updatedAt": r.get("updated_at"),
            "priceStale": updated is None or now - updated > STALE_AFTER,
        })
    return {"rows": rows, "dayChangeAvailable": closes_ok}


# ---------- filtering / facets / sorting (pure functions, easy to test) ----------

def _sector_key(row):
    return (row["sector"] or UNCLASSIFIED).lower()


def _matches(row, f, skip=None):
    """True if row passes every filter except the one named in `skip`."""
    if skip != "type" and row["assetType"] != f["type"]:
        return False
    if skip != "q" and f["q"]:
        text = f"{row['symbol']} {row['company']}".lower()
        if f["q"] not in text:
            return False
    if skip != "sector" and f["sectors"] and _sector_key(row) not in f["sectors"]:
        return False
    if skip != "mcap" and (f["mcap_min"] is not None or f["mcap_max"] is not None):
        cap = row["marketCapCr"]
        if cap is None:
            return False
        if f["mcap_min"] is not None and cap < f["mcap_min"]:
            return False
        if f["mcap_max"] is not None and cap >= f["mcap_max"]:
            return False
    if skip != "change" and f["change"] != "all":
        pct = row["changePercent"]
        if pct is None:
            return False
        if f["change"] == "gainers" and pct <= 0:
            return False
        if f["change"] == "losers" and pct >= 0:
            return False
    if skip != "price" and (f["min_price"] is not None or f["max_price"] is not None):
        price = row["price"]
        if price is None:
            return False
        if f["min_price"] is not None and price < f["min_price"]:
            return False
        if f["max_price"] is not None and price > f["max_price"]:
            return False
    return True


def _build_facets(rows, f):
    types = {
        t: sum(1 for r in rows if r["assetType"] == t and _matches(r, f, skip="type"))
        for t in VALID_TYPES
    }

    counts = {}
    for r in rows:
        if _matches(r, f, skip="sector"):
            name = r["sector"] or UNCLASSIFIED
            counts[name] = counts.get(name, 0) + 1
    sectors = [{"name": n, "count": c} for n, c in counts.items() if c > 0]
    sectors.sort(key=lambda s: (s["name"] == UNCLASSIFIED, -s["count"], s["name"]))

    mcap_rows = [r for r in rows if _matches(r, f, skip="mcap") and r["marketCapCr"] is not None]
    mcap = []
    for key, label, low, high in MCAP_BUCKETS:
        n = sum(1 for r in mcap_rows
                if r["marketCapCr"] >= low and (high is None or r["marketCapCr"] < high))
        if n > 0:
            mcap.append({"key": key, "label": label, "min": low, "max": high, "count": n})

    change_rows = [r for r in rows if _matches(r, f, skip="change")]
    change = {
        "all": len(change_rows),
        "gainers": sum(1 for r in change_rows if (r["changePercent"] or 0) > 0),
        "losers": sum(1 for r in change_rows if (r["changePercent"] or 0) < 0),
        "unknown": sum(1 for r in change_rows if r["changePercent"] is None),
    }

    prices = [r["price"] for r in rows if _matches(r, f, skip="price") and r["price"] is not None]
    price = {"min": min(prices), "max": max(prices)} if prices else {"min": None, "max": None}

    return {"types": types, "sectors": sectors, "mcap": mcap, "change": change, "price": price}


def _sorted(rows, sort):
    if sort == "az":
        return sorted(rows, key=lambda r: (r["company"].lower(), r["symbol"]))
    ascending = sort.endswith("_asc")
    field = {"mcap": "marketCap", "price": "price", "change": "changePercent"}[sort.replace("_asc", "")]
    present = sorted((r for r in rows if r[field] is not None),
                     key=lambda r: (r[field] if ascending else -r[field], r["symbol"]))
    missing = sorted((r for r in rows if r[field] is None), key=lambda r: r["symbol"])
    return present + missing   # missing values go last, never dropped


# ---------- the route ----------

@router.get("/explore")
def explore(
    q: str = "",
    type: str = "equity",
    sector: str = "",
    mcap_min: Optional[float] = None,    # Rs crore, inclusive
    mcap_max: Optional[float] = None,    # Rs crore, exclusive
    change: str = "all",
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: str = "mcap",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    if type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="type must be equity, etf or index")
    if sort not in VALID_SORTS:
        raise HTTPException(status_code=400,detail="sort must be mcap, price, price_asc, change, change_asc or az" )
    if change not in VALID_CHANGES:
        raise HTTPException(status_code=400, detail="change must be all, gainers or losers")

    try:
        data = cached("explore:rows", 60, _build_rows)
    except Exception as error:
        print(f"explore: could not load stocks: {error}")
        raise HTTPException(status_code=502, detail="Could not load stocks right now")

    filters = {
        "type": type,
        "q": q.strip().lower(),
        "sectors": {s.strip().lower() for s in sector.split(",") if s.strip()},
        "mcap_min": mcap_min,
        "mcap_max": mcap_max,
        "change": change,
        "min_price": min_price,
        "max_price": max_price,
    }

    rows = data["rows"]
    matched = _sorted([r for r in rows if _matches(r, filters)], sort)
    start = (page - 1) * page_size
    as_of = max((r["updatedAt"] for r in matched if r["updatedAt"]), default=None)

    return {
        "items": matched[start:start + page_size],
        "total": len(matched),
        "page": page,
        "page_size": page_size,
        "facets": _build_facets(rows, filters),
        "meta": {
            "pricesAsOf": as_of,
            "staleCount": sum(1 for r in matched if r["priceStale"]),
            "dayChangeAvailable": data["dayChangeAvailable"],
        },
    }