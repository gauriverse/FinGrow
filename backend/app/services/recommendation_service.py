from app.supabase import admin_supabase


from app.ml.fuzzy_risk import assess_fuzzy_risk
from app.ml.inference import (
    rank_stocks,
    get_latest_risk_indicators,
)
from app.services.yahoo_service import get_stock_history

def get_user_profile(user_id: str):
    result = (
        admin_supabase
        .table("profiles")
        .select(
            "user_id, investment_goal, risk_level, "
            "investment_experience, investment_horizon, "
            "starting_paper_capital"
        )
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not result or not result.data:
        raise Exception("User profile not found")

    return result.data

def get_ranked_candidates():
    rankings = rank_stocks()

    symbols = [stock["symbol"] for stock in rankings]
    

    return rankings

def get_stock_metadata(symbol: str):
    result = (
        admin_supabase
        .table("stocks")
        .select(
            "id, symbol, company_name, sector, exchange, current_price"
        )
        .eq("symbol", symbol)
        .maybe_single()
        .execute()
    )

    if not result or not result.data:
        return None

    return result.data

def enrich_candidates():
    
    candidates = get_ranked_candidates()

    enriched = []

    for candidate in candidates:
        stock = get_stock_metadata(candidate["symbol"])

        if not stock:
            continue

        enriched.append({
            **candidate,
            "stock_id": stock["id"],
            "company_name": stock["company_name"],
            "sector": stock["sector"],
            "exchange": stock["exchange"],
            "current_price": stock["current_price"],
        })
        symbols = [stock["symbol"] for stock in enriched]
        

    return enriched
RISK_MAX_VOLATILITY_PERCENTILE = {
    "conservative": 25,
    "moderate": 50,
    "aggressive": 75,
    "very-aggressive": 100,
}

def enrich_fuzzy_risk(candidate: dict) -> dict:
    """Add fuzzy risk assessment using the stock's latest history."""
    history_response = get_stock_history(candidate["symbol"])

    indicators = get_latest_risk_indicators(history_response)

    fuzzy_result = assess_fuzzy_risk(
        volatility_percentile=float(
            candidate["volatility_percentile"]
        ),
        momentum_pct=indicators["momentum_pct"],
        drawdown_pct=indicators["drawdown_pct"],
    )
    

    return {
        **candidate,
        "fuzzy_risk_score": fuzzy_result.risk_score,
        "fuzzy_risk_category": fuzzy_result.risk_category,
        "fuzzy_risk_explanation": fuzzy_result.explanation,
        "momentum_pct": indicators["momentum_pct"],
        "drawdown_pct": indicators["drawdown_pct"],
    }


def is_risk_compatible(
    risk_level: str,
    volatility_percentile: float
) -> bool:
    max_percentile = RISK_MAX_VOLATILITY_PERCENTILE.get(risk_level)

    if max_percentile is None:
        raise ValueError(f"Unsupported risk level: {risk_level}")

    return volatility_percentile <= max_percentile

def get_goal_context(investment_goal: str) -> str:
    goal_messages = {
        "wealth-growth": "The recommendation is aligned with a wealth-growth objective.",
        "learn-investing": "The recommendation can be used as a learning-oriented market signal.",
        "active-trading": "The ML signal is based on an approximately 20-trading-day prediction horizon.",
        "major-purchase": "The ML signal is a short-term market signal and does not predict suitability for a specific purchase date.",
        "regular-income": "The current ML model is not an income-focused model, so this signal should not be interpreted as a prediction of regular income.",
    }

    return goal_messages.get(
        investment_goal,
        "The current ML signal should be interpreted with caution for this investment goal."
    )


def get_horizon_context(investment_horizon: str) -> str:
    if investment_horizon == "lt-1y":
        return "The user's horizon is under 1 year; the model's approximately 20-trading-day signal is relatively aligned with a short-term horizon."

    if investment_horizon == "1-3y":
        return "The model provides a short-term market signal and should not be interpreted as a 1-3 year return prediction."

    if investment_horizon == "3-5y":
        return "The model provides a short-term market signal and should not be interpreted as a 3-5 year return prediction."

    if investment_horizon == "5y-plus":
        return "The model provides a short-term market signal and should not be interpreted as a 5+ year return prediction."

    return "The model's approximately 20-trading-day prediction horizon should be considered when interpreting this recommendation."


def personalize_candidates(user_id: str):
    profile = get_user_profile(user_id)
    candidates = enrich_candidates()

    risk_level = profile["risk_level"]
    investment_goal = profile["investment_goal"]
    investment_horizon = profile["investment_horizon"]

    goal_context = get_goal_context(investment_goal)
    horizon_context = get_horizon_context(investment_horizon)

    personalized = []

    for candidate in candidates:
        try:
            assessed_candidate = enrich_fuzzy_risk(candidate)
        except (ValueError, KeyError, TypeError) as exc:
            print(
                f"Skipping fuzzy risk assessment for "
                f"{candidate.get('symbol')}: {exc}"
            )
            assessed_candidate = {
                **candidate,
                "fuzzy_risk_score": None,
                "fuzzy_risk_category": "Unavailable",
                "fuzzy_risk_explanation": (
                    "Risk assessment is unavailable because "
                    "the required market data could not be calculated."
                ),
            }

        compatible = is_risk_compatible(
            risk_level,
            candidate["volatility_percentile"]
        )

        personalized.append({
            **assessed_candidate,
            "risk_compatible": compatible,
            "goal_context": goal_context,
            "horizon_context": horizon_context,
        })

    return personalized

def get_user_holdings(user_id: str):
    result = (
        admin_supabase
        .table("portfolio")
        .select("stock_id, quantity, buy_price")
        .eq("user_id", user_id)
        .execute()
    )

    holdings = result.data or []

    return {
        holding["stock_id"]: holding
        for holding in holdings
    }
def get_available_balance(user_id: str):
    result = (
        admin_supabase
        .table("paper_accounts")
        .select("available_balance")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not result or not result.data:
        raise Exception("Paper account not found")

    available_balance = result.data.get("available_balance")

    if available_balance is None:
        raise Exception("Available paper balance is not set")

    return float(available_balance)

def allocate_recommendations(user_id: str):
    candidates = personalize_candidates(user_id)
    available_balance = float(get_available_balance(user_id))

    if available_balance <= 0:
        return []

    eligible = [
        candidate
        for candidate in candidates
        if candidate.get("risk_compatible", False)
    ]

    # Defensive safeguard: prevent duplicate stock allocations.
    unique_eligible = []
    seen_symbols = set()

    for candidate in eligible:
        symbol = candidate.get("symbol")

        if symbol and symbol not in seen_symbols:
            seen_symbols.add(symbol)
            unique_eligible.append(candidate)

    top_candidates = unique_eligible[:3]

    if not top_candidates:
        return []

    # Normalize percentages if fewer than three stocks are eligible.
    allocation_percentages = [0.50, 0.30, 0.20]
    percentages = allocation_percentages[:len(top_candidates)]
    total_percentage = sum(percentages)
    percentages = [p / total_percentage for p in percentages]

    recommendations = []

    for candidate, percentage in zip(top_candidates, percentages):
        recommendations.append({
            **candidate,
            "suggested_allocation": round(
                available_balance * percentage,
                2
            )
        })

    return recommendations
