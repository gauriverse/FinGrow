import math
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf

from app.supabase import admin_supabase as sb
from app.ml.model_loader import model
from app.ml.inference import FEATURE_COLUMNS, calculate_inference_features

log = logging.getLogger("ai_refresh")
BUY_T, SELL_T = 0.60, 0.40   # probability cut-offs; between them = HOLD


# ----------------------------------------------------------------- helpers
def fetch_all(table, cols="*"):
    rows, start = [], 0
    while True:
        r = sb.table(table).select(cols).range(start, start + 999).execute().data
        rows += r
        if len(r) < 1000:
            return rows
        start += 1000


def num(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if (math.isnan(v) or math.isinf(v)) else v


def upsert(table, rows, conflict):
    for i in range(0, len(rows), 500):
        sb.table(table).upsert(rows[i:i + 500], on_conflict=conflict).execute()


# --------------------------------------------------------------- 1. prices
def refresh_prices():
    stocks = fetch_all("stocks", "id,symbol")
    counts = {}
    for r in fetch_all("stock_prices", "stock_id"):
        counts[r["stock_id"]] = counts.get(r["stock_id"], 0) + 1
    price_rows, ok = [], 0
    for s in stocks:
        sym = s["symbol"]
        # a stock with little history (new, or never backfilled) gets a full year so the model has enough data
        period = "1y" if counts.get(s["id"], 0) < 80 else "10d"
        cands = [sym] if "." in sym else [sym + ".NS", sym]
        hist = pd.DataFrame()
        for t in cands:
            try:
                hist = yf.Ticker(t).history(period=period, auto_adjust=False)
            except Exception as e:
                log.warning("yfinance failed for %s: %s", t, e)
            if not hist.empty:
                break
        if hist.empty:
            log.warning("no price data for %s", sym)
            continue
        ok += 1
        for idx, r in hist.iterrows():
            close = num(r["Close"])
            if close is None:
                continue
            vol = num(r["Volume"])
            price_rows.append({
                "stock_id": s["id"], "price_date": idx.date().isoformat(),
                "open_price": num(r["Open"]), "high_price": num(r["High"]),
                "low_price": num(r["Low"]), "close_price": close,
                "volume": int(vol) if vol is not None else None,
            })
        last = hist["Close"].dropna()
        if not last.empty:
            sb.table("stocks").update({
                "current_price": float(last.iloc[-1]),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", s["id"]).execute()
    upsert("stock_prices", price_rows, "stock_id,price_date")
    log.info("prices: %d stocks, %d rows upserted", ok, len(price_rows))


def load_prices():
    px = pd.DataFrame(fetch_all(
        "stock_prices", "stock_id,price_date,open_price,high_price,low_price,close_price,volume"))
    for c in ["open_price", "high_price", "low_price", "close_price", "volume"]:
        px[c] = px[c].astype(float)
    return px


def stock_frame(g):
    """One stock's prices in the column format your inference.py expects."""
    g = g.sort_values("price_date").reset_index(drop=True)
    df = pd.DataFrame({
        "Open": g["open_price"], "High": g["high_price"], "Low": g["low_price"],
        "Close": g["close_price"], "Volume": g["volume"],
    })
    df["Adj_Close"] = df["Close"]          # same as predict_probability() in inference.py
    return g, df


# ---------------------------------------------------------- 2. indicators
def refresh_indicators(px):
    rows = []
    for sid, g0 in px.groupby("stock_id"):
        g, df = stock_frame(g0)
        c = df["Close"]
        d = c.diff()
        rsi = 100 - 100 / (1 + d.clip(lower=0).rolling(14).mean() / (-d.clip(upper=0)).rolling(14).mean())
        macd = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
        sma20, sd20 = c.rolling(20).mean(), c.rolling(20).std()
        out = pd.DataFrame({
            "rsi": rsi, "macd": macd, "sma_50": c.rolling(50).mean(), "sma_200": c.rolling(200).mean(),
            "ema_20": c.ewm(span=20, adjust=False).mean(),
            "bollinger_upper": sma20 + 2 * sd20, "bollinger_lower": sma20 - 2 * sd20,
        }).tail(10)
        for i, r in out.iterrows():
            row = {"stock_id": sid, "indicator_date": str(g.loc[i, "price_date"])[:10]}
            row.update({k: num(v) for k, v in r.items()})
            rows.append(row)
    upsert("technical_indicators", rows, "stock_id,indicator_date")
    log.info("indicators: %d rows upserted", len(rows))


# --------------------------------------------------------- 3. risk + model
def ensure_risk_analysis():
    """Rule-based risk score for any user who has none yet (existing scores are kept)."""
    have = {r["user_id"] for r in fetch_all("risk_analysis", "user_id")}
    rows = []
    for p in fetch_all("profiles"):
        if p["user_id"] in have:
            continue
        lvl = (p.get("risk_level") or "").lower()
        exp = (p.get("investment_experience") or "").lower()
        hz = (p.get("investment_horizon") or "").lower()
        age = p.get("age") or 30
        a = 20 if ("high" in lvl or "aggress" in lvl) else (-20 if ("low" in lvl or "conserv" in lvl) else 0)
        b = 10 if age < 30 else (-10 if age > 50 else 0)
        c = -10 if any(k in exp for k in ("begin", "none", "new")) else (10 if any(k in exp for k in ("advanc", "expert")) else 0)
        d = 10 if "long" in hz else (-10 if "short" in hz else 0)
        score = max(0, min(100, 50 + a + b + c + d))
        rows.append({"user_id": p["user_id"], "risk_score": score,
                     "risk_category": "High" if score >= 65 else ("Low" if score <= 35 else "Medium"),
                     "factors": {"risk_appetite": a, "age": b, "experience": c, "horizon": d}})
    if rows:
        sb.table("risk_analysis").insert(rows).execute()
    log.info("risk_analysis: %d new users scored", len(rows))


def stock_probabilities(px):
    """{stock_id: probability of outperforming}, using the exact feature code from inference.py."""
    cls1 = list(model.classes_).index(1)
    probs = {}
    for sid, g0 in px.groupby("stock_id"):
        _, df = stock_frame(g0)
        feats = (calculate_inference_features(df)[FEATURE_COLUMNS]
                 .replace([np.inf, -np.inf], np.nan).dropna().tail(1))
        if feats.empty:
            log.warning("not enough history for stock %s", sid)
            continue
        probs[sid] = float(model.predict_proba(feats)[0, cls1])
    return probs


def refresh_predictions(px, only_user=None):
    probs = stock_probabilities(px)
    if not probs:
        log.warning("no predictions made")
        return
    risk = {r["user_id"]: r["risk_score"] for r in fetch_all("risk_analysis", "user_id,risk_score")}
    users = [only_user] if only_user else [p["user_id"] for p in fetch_all("profiles", "user_id")]
    rows = []
    for uid in users:
        for sid, p in probs.items():
            rows.append({
                "user_id": uid, "stock_id": sid,
                "prediction": "BUY" if p >= BUY_T else ("SELL" if p <= SELL_T else "HOLD"),
                "confidence": round(max(p, 1 - p) * 100, 2),
                "expected_return": None,
                "risk_score": num(risk.get(uid)),
                "reason": f"FinGrow v3 model: {p*100:.1f}% probability of outperforming the median stock over the next 20 days.",
            })
    upsert("ai_predictions", rows, "user_id,stock_id")
    log.info("ai_predictions: %d rows upserted", len(rows))


# ------------------------------------------------------------ entry points
def predict_for_new_user(user_id):
    """Call after a user finishes onboarding so they don't wait for the next daily run."""
    ensure_risk_analysis()
    refresh_predictions(load_prices(), only_user=user_id)


def run_once():
    refresh_prices()
    px = load_prices()
    refresh_indicators(px)
    ensure_risk_analysis()
    refresh_predictions(px)


def start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    sch = BackgroundScheduler(timezone="Asia/Kolkata")
    # NSE closes 15:30 IST; run at 16:30 on weekdays. misfire_grace_time lets a late-started server catch up.
    sch.add_job(run_once, "cron", day_of_week="mon-fri", hour=16, minute=30,
                id="fingrow_daily", max_instances=1, coalesce=True, misfire_grace_time=3600)
    sch.start()
    log.info("FinGrow daily job scheduled for 16:30 IST, Mon-Fri")
    return sch


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_once()