from __future__ import annotations
 
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple
 
# India has no daylight saving, so a fixed offset is exact (and avoids the
# tzdata dependency that zoneinfo needs on Windows).
IST = timezone(timedelta(hours=5, minutes=30))
 
EPS = 1e-9
 
 
def today_ist() -> date:
    return datetime.now(IST).date()
 
 
def _parse_ts(value: Any) -> datetime:
    """Parse a Supabase timestamptz / date string into an aware datetime."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day)
    else:
        text = str(value).strip().replace("Z", "+00:00").replace(" ", "T", 1)
        # Python < 3.11 needs exactly 3 or 6 fractional digits.
        text = re.sub(
            r"\.(\d+)", lambda m: "." + m.group(1).ljust(6, "0")[:6], text
        )
        dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
 
 
def to_ist_date(value: Any) -> date:
    return _parse_ts(value).astimezone(IST).date()
 
 
# ---------------------------------------------------------------------------
# Trades
# ---------------------------------------------------------------------------
 
def normalize_trades(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Clean raw `transactions` rows into ascending, typed trade dicts."""
    trades: List[Dict[str, Any]] = []
 
    for row in rows:
        side = str(row.get("transaction_type") or "").lower()
        if side not in ("buy", "sell"):
            continue
 
        try:
            qty = float(row["quantity"])
            price = float(row["price"])
            ts = _parse_ts(row["transaction_date"])
        except (KeyError, TypeError, ValueError):
            continue
 
        if qty <= 0:
            continue
 
        stock = row.get("stocks") or {}
 
        trades.append({
            "id": str(row.get("id")),
            "stock_id": str(row.get("stock_id")),
            "side": side,
            "qty": qty,
            "price": price,
            "ts": ts,
            "date": ts.astimezone(IST).date(),
            "symbol": stock.get("symbol") or "",
            "company_name": stock.get("company_name"),
        })
 
    trades.sort(key=lambda t: (t["ts"], t["id"]))
    return trades
 
 
def compute_realized_pnl(trades: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    """
    Average-cost realized P&L for every SELL trade (trades must be ascending).
    Returns {trade_id: pnl}. A sell with no known cost basis gets None.
    """
    position: Dict[str, List[float]] = defaultdict(lambda: [0.0, 0.0])  # qty, cost
    realized: Dict[str, Optional[float]] = {}
 
    for t in trades:
        qty, cost = position[t["stock_id"]]
 
        if t["side"] == "buy":
            position[t["stock_id"]] = [qty + t["qty"], cost + t["qty"] * t["price"]]
            continue
 
        if qty <= EPS:
            realized[t["id"]] = None
            continue
 
        avg_cost = cost / qty
        realized[t["id"]] = round((t["price"] - avg_cost) * t["qty"], 2)
 
        new_qty = max(qty - t["qty"], 0.0)
        position[t["stock_id"]] = [new_qty, avg_cost * new_qty]
 
    return realized
 
 
# ---------------------------------------------------------------------------
# Portfolio value over time
# ---------------------------------------------------------------------------
 
def build_portfolio_history(
    trades: List[Dict[str, Any]],
    price_series: Dict[str, List[Tuple[date, float]]],
    live_prices: Dict[str, float],
    today: date,
    window_start: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """
    Replay trades against daily closes.
 
    For every trading day returns:
      market_value : value of the holdings at that day's close
      invested     : average-cost basis of the holdings still held
      twr_index    : time-weighted return index of the holdings (starts at
                     100). Buys/sells are treated as cash flows, so adding
                     money does not look like performance. Cash is excluded.
 
    Missing prices are forward-filled from the last known close; before any
    close exists the latest trade price is used. The final day uses
    `live_prices` (stocks.current_price) so it matches /portfolio/summary.
    """
    if not trades:
        return []
 
    first_trade = trades[0]["date"]
    start = max(first_trade, window_start) if window_start else first_trade
 
    dates = sorted(
        {d for series in price_series.values() for d, _ in series if start <= d <= today}
    )
 
    include_today = (
        today >= start
        and today >= first_trade
        and (today.weekday() < 5 or today in dates)
    )
    if include_today and today not in dates:
        dates.append(today)
 
    if not dates:
        return []
 
    qty: Dict[str, float] = defaultdict(float)
    cost: Dict[str, float] = defaultdict(float)
    last_trade_price: Dict[str, float] = {}
 
    def apply(trade: Dict[str, Any]) -> float:
        """Update the position; return the signed cash flow into holdings."""
        sid, q, p = trade["stock_id"], trade["qty"], trade["price"]
        last_trade_price[sid] = p
 
        if trade["side"] == "buy":
            qty[sid] += q
            cost[sid] += q * p
            return q * p
 
        held = qty[sid]
        avg = cost[sid] / held if held > EPS else p
        new_qty = max(held - q, 0.0)
        qty[sid] = new_qty
        cost[sid] = avg * new_qty
        return -(q * p)
 
    ti = 0
    while ti < len(trades) and trades[ti]["date"] < dates[0]:
        apply(trades[ti])  # history before the window: state only, no flow
        ti += 1
 
    pointer: Dict[str, int] = defaultdict(int)
    last_close: Dict[str, float] = {}
 
    rows: List[Dict[str, Any]] = []
    prev_value: Optional[float] = None
    index: Optional[float] = None
 
    for d in dates:
        for sid, series in price_series.items():
            p = pointer[sid]
            while p < len(series) and series[p][0] <= d:
                last_close[sid] = series[p][1]
                p += 1
            pointer[sid] = p
 
        if d == today:
            for sid, price in live_prices.items():
                if price and price > 0:
                    last_close[sid] = float(price)
 
        flow = 0.0
        while ti < len(trades) and trades[ti]["date"] <= d:
            flow += apply(trades[ti])
            ti += 1
 
        market = 0.0
        invested = 0.0
        for sid, q in qty.items():
            if q <= EPS:
                continue
            price = last_close.get(sid) or last_trade_price.get(sid, 0.0)
            market += q * price
            invested += cost[sid]
 
        if prev_value is not None and prev_value > EPS:
            ratio = max((market - flow) / prev_value, 0.0)
            index = (index if index is not None else 100.0) * ratio
        elif index is None and market > EPS:
            index = 100.0
 
        rows.append({
            "date": d.isoformat(),
            "market_value": round(market, 2),
            "invested": round(invested, 2),
            "twr_index": round(index, 4) if index is not None else None,
        })
        prev_value = market
 
    return rows
 
 
# ---------------------------------------------------------------------------
# Day change + sectors
# ---------------------------------------------------------------------------
 
def day_change(
    current_price: float, previous_close: Optional[float]
) -> Tuple[Optional[float], Optional[float]]:
    """Per-share change vs previous close (same basis as today_pnl)."""
    if previous_close is None or previous_close <= 0:
        return None, None
    change = current_price - previous_close
    return round(change, 2), round(change / previous_close * 100, 2)
 
 
def sector_breakdown(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """items: dicts with `sector` and `current_value`. Largest first."""
    totals: Dict[str, float] = defaultdict(float)
    for item in items:
        totals[(item.get("sector") or "").strip() or "Unclassified"] += float(
            item.get("current_value") or 0
        )
 
    grand = sum(totals.values())
 
    return [
        {
            "sector": name,
            "value": round(value, 2),
            "weight_percent": round(value / grand * 100, 2) if grand > 0 else 0.0,
        }
        for name, value in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        if value > 0
    ]