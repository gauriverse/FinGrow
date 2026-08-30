from fastapi import APIRouter, Depends, HTTPException

from app.supabase import admin_supabase
from app.auth import get_current_user
from app.services.yahoo_service import get_stock_data

router = APIRouter()


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

        invested_value = 0.0
        current_value = 0.0
        overall_pnl = 0.0
        today_pnl = 0.0

        for holding in holdings:

            stock_result = (
                admin_supabase
                .table("stocks")
                .select("current_price, symbol")
                .eq("id", holding["stock_id"])
                .maybe_single()
                .execute()
            )

            if not stock_result.data:
                continue

            quantity = int(holding.get("quantity") or 0)
            buy_price = float(holding.get("buy_price") or 0)
            current_price = float(
                stock_result.data.get("current_price") or 0
            )

            symbol = stock_result.data.get("symbol")

            invested = quantity * buy_price
            current = quantity * current_price

            invested_value += invested
            current_value += current
            overall_pnl += current - invested

            # Today's P&L
            if symbol:
                try:
                    live_data = get_stock_data(symbol)

                    previous_close = live_data.get("previousClose")

                    if previous_close is not None:
                        today_pnl += quantity * (
                            current_price - float(previous_close)
                        )

                except Exception as e:
                    print(
                        f"Could not fetch previousClose for {symbol}:",
                        repr(e)
                    )

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

        

   