from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel
from app.supabase import admin_supabase
from app.auth import get_current_user
from app.services.yahoo_service import get_stock_data, get_last_two_closes

import time
from datetime import date, datetime, timedelta
 
from app.services.portfolio_analytics import (
    IST,
    build_portfolio_history,
    compute_realized_pnl,
    day_change,
    normalize_trades,
    sector_breakdown,
    today_ist,
)

router = APIRouter()
class BuyRequest(BaseModel):
    stock_id: str
    quantity: int

class SellRequest(BaseModel):
    stock_id: str
    quantity: int

class AddFundsRequest(BaseModel):
    amount:float

def get_or_create_paper_account(user_id: str):
    print("USER ID:", user_id)

    existing = (
        admin_supabase
        .table("paper_accounts")
        .select("id, user_id, initial_balance, available_balance")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    print("EXISTING RESPONSE:", existing)

    if existing is not None and existing.data:
        print("EXISTING ACCOUNT:", existing.data)
        return existing.data

    print("NO PAPER ACCOUNT FOUND — CREATING ONE")

    # Get the user's selected starting paper capital
    profile_result = (
        admin_supabase
        .table("profiles")
        .select("starting_paper_capital")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    print("PROFILE CAPITAL RESPONSE:", profile_result)

    if not profile_result or not profile_result.data:
        raise Exception("User profile not found")

    starting_capital = profile_result.data.get("starting_paper_capital")

    if starting_capital is None:
        raise Exception("Starting paper capital is not set")

    starting_capital = float(starting_capital)

    result = (
        admin_supabase
        .table("paper_accounts")
        .insert({
            "user_id": user_id,
            "initial_balance": starting_capital,       
            "available_balance": starting_capital
            })
        .execute()
    )

    print("INSERT RESPONSE:", result)

    if result is None or not result.data:
        raise Exception("Paper account could not be created")

    return result.data[0]


@router.get("/summary")
def get_portfolio_summary(
    current_user=Depends(get_current_user)
):
    try:
        # Get the authenticated Supabase user's UUID automatically.
        # Nothing is passed manually from Swagger/frontend.
        user_id = str(current_user.id)

        # Automatically create the paper account if this is
        # the user's first time opening the dashboard.
        account = get_or_create_paper_account(user_id)

        available_balance = float(account["available_balance"])

        portfolio_result = (
            admin_supabase
            .table("portfolio")
            .select("stock_id, quantity, buy_price")
            .eq("user_id", user_id)
            .execute()
        )

        holdings = portfolio_result.data or []
        portfolio_holdings = []

        invested_value = 0.0
        current_value = 0.0
        overall_pnl = 0.0
        today_pnl = 0.0

        stock_ids = [h["stock_id"] for h in holdings]
        stocks_by_id = {}
        if stock_ids:
            stocks_result = (
                admin_supabase
                .table("stocks")
                .select("id, current_price, symbol")
                .in_("id", stock_ids)
                .execute()
            )
            stocks_by_id = {s["id"]: s for s in (stocks_result.data or [])}

         # ONE Yahoo call for all previous closes (cached 60s)
        symbols = [s["symbol"] for s in stocks_by_id.values() if s.get("symbol")]
        try:
            closes = get_last_two_closes(symbols)
        except Exception as e:
            print("Could not fetch previous closes:", repr(e))
            closes = {}

        for holding in holdings:
            stock_row = stocks_by_id.get(holding["stock_id"])
            if not stock_row:
                continue

            quantity = int(holding.get("quantity") or 0)
            buy_price = float(holding.get("buy_price") or 0)
            current_price = float(stock_row.get("current_price") or 0)
            symbol = stock_row.get("symbol")

            invested = quantity * buy_price
            current = quantity * current_price

            portfolio_holdings.append({
                "stock_id": holding["stock_id"],
                "symbol": symbol,
                "quantity": quantity,
                "buy_price": round(buy_price, 2),
                "current_price": round(current_price, 2),
                "invested_value": round(invested, 2),
                "current_value": round(current, 2),
                "pnl": round(current - invested, 2),
            })

            invested_value += invested
            current_value += current
            overall_pnl += current - invested

            # Today's P&L, using the batched previous close
            if symbol in closes:
                _, previous_close = closes[symbol]
                today_pnl += quantity * (current_price - previous_close)

        total_value = available_balance + current_value
        previous_total_value = total_value - today_pnl
        

        today_pnl_percent = (
            (today_pnl / previous_total_value) * 100
            if previous_total_value != 0
            else 0
        )

        return {
            "available_balance": round(available_balance, 2),
            "invested_value": round(invested_value, 2),
            "current_value": round(current_value, 2),
            "total_value": round(total_value, 2),
            "overall_pnl": round(overall_pnl, 2),
            "today_pnl": round(today_pnl, 2),
            "today_pnl_percent": round(today_pnl_percent, 2),
            "holdings": portfolio_holdings,
            "initial_balance": round(float(account["initial_balance"]), 2),
        }

    except HTTPException:
        raise

    except Exception as e:
        import traceback

        print("========== PORTFOLIO SUMMARY ERROR ==========")
        print(repr(e))
        traceback.print_exc()
        print("==============================================")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.post("/add-funds")
def add_funds(
    request: AddFundsRequest,
    current_user=Depends(get_current_user)
):
    amount = round(request.amount, 2)

    if amount < 100 or amount > 1000000:
        raise HTTPException(
            status_code=400,
            detail="Amount must be between ₹100 and ₹10,00,000"
        )

    try:
        user_id = str(current_user.id)
        get_or_create_paper_account(user_id)

        result = (
            admin_supabase
            .rpc("add_funds", {"p_user_id": user_id, "p_amount": amount})
            .execute()
        )

        if result is None or result.data is None:
            raise HTTPException(status_code=500, detail="Could not add funds")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        print("ADD FUNDS ERROR:", repr(e))
        raise HTTPException(status_code=500, detail="Could not add funds")       

@router.post("/buy")
def buy_stock(
    request: BuyRequest,
    current_user=Depends(get_current_user)
):
    try:
        user_id = str(current_user.id)

        if request.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity must be greater than 0"
            )

        # Make sure the paper account exists before executing the
        # atomic database transaction.
        get_or_create_paper_account(user_id)

        result = (
            admin_supabase
            .rpc(
                "execute_buy",
                {
                    "p_user_id": user_id,
                    "p_stock_id": request.stock_id,
                    "p_quantity": request.quantity
                }
            )
            .execute()
        )

        if result is None or result.data is None:
            raise HTTPException(
                status_code=500,
                detail="Could not complete BUY transaction"
            )

        return result.data

    except HTTPException:
        raise

    except Exception as e:
        import traceback

        print("========== BUY ERROR ==========")
        print(repr(e))
        traceback.print_exc()
        print("===============================")

        raise HTTPException(
            status_code=500,
            detail="Could not complete BUY transaction"
        )

@router.post("/sell")
def sell_stock(
    request: SellRequest,
    current_user=Depends(get_current_user)
):
    try:
        user_id = str(current_user.id)

        if request.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity must be greater than 0"
            )

        # Make sure the paper account exists.
        get_or_create_paper_account(user_id)

        result = (
            admin_supabase
            .rpc(
                "execute_sell",
                {
                    "p_user_id": user_id,
                    "p_stock_id": request.stock_id,
                    "p_quantity": request.quantity
                }
            )
            .execute()
        )

        if result is None or result.data is None:
            raise HTTPException(
                status_code=500,
                detail="Could not complete SELL transaction"
            )

        return result.data

    except HTTPException:
        raise

    except Exception as e:
        import traceback

        print("========== SELL ERROR ==========")
        print(repr(e))
        traceback.print_exc()
        print("===============================")

        raise HTTPException(
            status_code=500,
            detail="Could not complete SELL transaction"
        )

@router.get("/wallet/history")
def wallet_history(current_user=Depends(get_current_user)):
    try:
        user_id = str(current_user.id)

        deposits = (
            admin_supabase.table("wallet_transactions")
            .select("id, amount, balance_after, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        ).data or []

        trades = (
            admin_supabase.table("transactions")
            .select("id, transaction_type, quantity, price, transaction_date, stocks(symbol)")
            .eq("user_id", user_id)
            .order("transaction_date", desc=True)
            .limit(50)
            .execute()
        ).data or []

        items = []

        for d in deposits:
            items.append({
                "id": d["id"],
                "kind": "deposit",
                "title": "Money added",
                "detail": "",
                "amount": round(float(d["amount"]), 2),
                "balance_after": round(float(d["balance_after"]), 2),
                "date": d["created_at"],
            })

        for t in trades:
            symbol = ((t.get("stocks") or {}).get("symbol") or "").replace(".NS", "")
            qty = float(t["quantity"])
            price = float(t["price"])
            is_buy = t["transaction_type"] == "buy"
            items.append({
                "id": t["id"],
                "kind": "buy" if is_buy else "sell",
                "title": f"{'Bought' if is_buy else 'Sold'} {symbol}",
                "detail": f"{qty:g} × ₹{price:,.2f}",
                "amount": round(qty * price, 2),
                "date": t["transaction_date"],
            })

        items.sort(key=lambda x: x["date"], reverse=True)
        return items[:50]

    except Exception as e:
        print("WALLET HISTORY ERROR:", repr(e))
        raise HTTPException(status_code=500, detail="Could not load wallet activity")

BENCHMARK_SYMBOL = "^NSEI"
BENCHMARK_NAME = "NIFTY 50"
_BENCHMARK_CACHE: dict = {}
 
 
def _fetch_all(build_query, page_size: int = 1000):
    """Supabase returns at most 1000 rows per request, so page through."""
    rows = []
    start = 0
 
    while True:
        batch = (
            build_query().range(start, start + page_size - 1).execute().data or []
        )
        rows.extend(batch)
 
        if len(batch) < page_size:
            break
 
        start += page_size
 
    return rows
 
 
def _benchmark_closes(start: date, end: date):
    """NIFTY 50 daily closes, cached 10 minutes. Returns None if unavailable."""
    key = (start.isoformat(), end.isoformat())
    hit = _BENCHMARK_CACHE.get(key)
 
    if hit and time.time() - hit[0] < 600:
        return hit[1]
 
    try:
        import yfinance as yf
 
        frame = yf.Ticker(BENCHMARK_SYMBOL).history(
            start=start.isoformat(),
            end=(end + timedelta(days=1)).isoformat(),
            auto_adjust=False,
        )
 
        if frame is None or frame.empty:
            raise ValueError("empty benchmark data")
 
        rows = [
            {"date": ts.date().isoformat(), "close": round(float(value), 2)}
            for ts, value in frame["Close"].dropna().items()
        ]
    except Exception as e:
        print("BENCHMARK ERROR:", repr(e))
        rows = None
 
    _BENCHMARK_CACHE[key] = (time.time(), rows)
    return rows
 
 
@router.get("/history")
def portfolio_history(
    days: int = 365,
    current_user=Depends(get_current_user)
):
    """Holdings value, invested amount and time-weighted return over time."""
    try:
        user_id = str(current_user.id)
        days = max(7, min(int(days), 730))
        today = today_ist()
        window_start = today - timedelta(days=days)
 
        trades = normalize_trades(
            _fetch_all(
                lambda: admin_supabase.table("transactions")
                .select("id, stock_id, transaction_type, quantity, price, transaction_date")
                .eq("user_id", user_id)
                .order("transaction_date")
            )
        )
 
        empty = {"series": [], "benchmark": None, "benchmark_name": BENCHMARK_NAME}
 
        if not trades:
            return empty
 
        stock_ids = sorted({t["stock_id"] for t in trades})
        seed_from = (window_start - timedelta(days=10)).isoformat()
 
        price_rows = _fetch_all(
            lambda: admin_supabase.table("stock_prices")
            .select("stock_id, price_date, close_price")
            .in_("stock_id", stock_ids)
            .gte("price_date", seed_from)
            .order("price_date")
            .order("stock_id")
        )
 
        price_series: dict = {}
        for row in price_rows:
            if row.get("close_price") is None:
                continue
            price_series.setdefault(str(row["stock_id"]), []).append(
                (date.fromisoformat(str(row["price_date"])[:10]), float(row["close_price"]))
            )
 
        live_rows = (
            admin_supabase.table("stocks")
            .select("id, symbol, current_price")
            .in_("id", stock_ids)
            .execute()
            .data
            or []
        )
        live_prices = {
            str(r["id"]): float(r["current_price"] or 0) for r in live_rows
        }
 
        series = build_portfolio_history(
            trades, price_series, live_prices, today, window_start
        )
 
        # Stocks you still hold whose daily price rows are missing or
        # lag behind the rest. The chart is approximate for these.
        net: dict = {}
        for t in trades:
            net[t["stock_id"]] = net.get(t["stock_id"], 0.0) + (
                t["qty"] if t["side"] == "buy" else -t["qty"]
            )
 
        latest_price_date = max(
            (d for s in price_series.values() for d, _ in s), default=None
        )
        symbol_by_id = {str(r["id"]): (r.get("symbol") or "") for r in live_rows}
        incomplete = []
 
        if latest_price_date:
            for sid, qty in net.items():
                if qty <= 1e-9:
                    continue
                rows_for_stock = price_series.get(sid)
                last_date = rows_for_stock[-1][0] if rows_for_stock else None
                if last_date is None or (latest_price_date - last_date).days > 3:
                    incomplete.append(symbol_by_id.get(sid, "").replace(".NS", ""))
 
        incomplete = sorted({name for name in incomplete if name})
 
        benchmark = None
        if len(series) >= 2:
            benchmark = _benchmark_closes(
                date.fromisoformat(series[0]["date"]), today
            )
 
        return {
            "series": series,
            "benchmark": benchmark,
            "benchmark_name": BENCHMARK_NAME,
            "incomplete_symbols": incomplete,
        }
 
    except Exception as e:
        import traceback
 
        print("========== PORTFOLIO HISTORY ERROR ==========")
        print(repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not load portfolio history")
 
 
@router.get("/insights")
def portfolio_insights(current_user=Depends(get_current_user)):
    """Per-holding day change + sector allocation."""
    try:
        user_id = str(current_user.id)
 
        holdings = (
            admin_supabase.table("portfolio")
            .select("stock_id, quantity")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
 
        stock_ids = sorted({h["stock_id"] for h in holdings})
 
        if not stock_ids:
            return {"holdings": [], "sectors": []}
 
        stocks = {
            s["id"]: s
            for s in (
                admin_supabase.table("stocks")
                .select("id, symbol, company_name, sector, current_price")
                .in_("id", stock_ids)
                .execute()
                .data
                or []
            )
        }
 
        symbols = [s["symbol"] for s in stocks.values() if s.get("symbol")]
 
        try:
            closes = get_last_two_closes(symbols)
        except Exception as e:
            print("Could not fetch previous closes:", repr(e))
            closes = {}
 
        quantity_by_stock: dict = {}
        for h in holdings:
            quantity_by_stock[h["stock_id"]] = quantity_by_stock.get(
                h["stock_id"], 0
            ) + int(h.get("quantity") or 0)
 
        items = []
        sector_items = []
 
        for stock_id, quantity in quantity_by_stock.items():
            stock = stocks.get(stock_id)
            if not stock:
                continue
 
            price = float(stock.get("current_price") or 0)
            previous_close = None
 
            if stock.get("symbol") in closes:
                # Same unpacking as /summary uses for today's P&L.
                _, previous_close = closes[stock["symbol"]]
 
            change, change_pct = day_change(price, previous_close)
 
            items.append({
                "stock_id": stock_id,
                "symbol": stock.get("symbol"),
                "company_name": stock.get("company_name"),
                "sector": (stock.get("sector") or "").strip() or "Unclassified",
                "day_change": change,
                "day_change_percent": change_pct,
                "day_pnl": round(quantity * change, 2) if change is not None else None,
            })
 
            sector_items.append({
                "sector": stock.get("sector"),
                "current_value": quantity * price,
            })
 
        return {"holdings": items, "sectors": sector_breakdown(sector_items)}
 
    except Exception as e:
        import traceback
 
        print("========== PORTFOLIO INSIGHTS ERROR ==========")
        print(repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not load portfolio insights")
 
 
@router.get("/trades")
def portfolio_trades(
    limit: int = 100,
    current_user=Depends(get_current_user)
):
    """Order history with realized P&L on sells (average-cost method)."""
    try:
        user_id = str(current_user.id)
        limit = max(1, min(int(limit), 500))
 
        trades = normalize_trades(
            _fetch_all(
                lambda: admin_supabase.table("transactions")
                .select(
                    "id, stock_id, transaction_type, quantity, price, "
                    "transaction_date, stocks(symbol, company_name)"
                )
                .eq("user_id", user_id)
                .order("transaction_date")
            )
        )
 
        realized = compute_realized_pnl(trades)
 
        items = [
            {
                "id": t["id"],
                "side": t["side"],
                "symbol": t["symbol"],
                "company_name": t["company_name"],
                "quantity": t["qty"],
                "price": round(t["price"], 2),
                "amount": round(t["qty"] * t["price"], 2),
                "date": t["ts"].isoformat(),
                "realized_pnl": realized.get(t["id"]),
            }
            for t in reversed(trades)
        ]
 
        return {
            "trades": items[:limit],
            "realized_pnl_total": round(
                sum(v for v in realized.values() if v is not None), 2
            ),
        }
 
    except Exception as e:
        import traceback
 
        print("========== PORTFOLIO TRADES ERROR ==========")
        print(repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not load trade history")