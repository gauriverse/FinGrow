from fastapi import APIRouter, HTTPException
from app.supabase import admin_supabase
from app.services.yahoo_service import get_stock_data

router = APIRouter()


@router.post("/account")
def create_paper_account(user_id: str):

    try:
        # Check whether the user already has an account
        existing = (
            admin_supabase
            .table("paper_accounts")
            .select("id, user_id, cash_balance")
            .eq("user_id", user_id)
            .execute()
        )

        if existing.data:
            return existing.data[0]

        # Create the initial paper-trading account
        result = (
            admin_supabase
            .table("paper_accounts")
            .insert({
                "user_id": user_id,
                "cash_balance": 100000
            })
            .execute()
        )

        if not result.data:
            raise Exception("Paper account was not created")

        return result.data[0]

    except Exception as e:
        print("PAPER ACCOUNT ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/summary")
def get_portfolio_summary(user_id: str):

    try:
        account_result = (
            admin_supabase
            .table("paper_accounts")
            .select("cash_balance")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not account_result.data:
            raise HTTPException(status_code=404, detail="Paper account not found")

        cash_balance = float(account_result.data["cash_balance"])

        portfolio_result = (
            admin_supabase
            .table("portfolio")
            .select("stock_id, quantity, buy_price")
            .eq("user_id", user_id)
            .execute()
        )

        holdings = portfolio_result.data or []

        invested_value = 0
        current_value = 0
        overall_pnl = 0
        today_pnl = 0

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

            quantity = int(holding["quantity"] or 0)
            buy_price = float(holding["buy_price"] or 0)
            current_price = float(stock_result.data["current_price"] or 0)
            symbol = stock_result.data.get("symbol")

            invested = quantity * buy_price
            current = quantity * current_price

            invested_value += invested
            current_value += current
            overall_pnl += current - invested

            # today's P&L for THIS holding — now correctly inside the loop
            try:
                if symbol:
                    live_data = get_stock_data(symbol)
                    previous_close = live_data.get("previousClose")
                    if previous_close:
                        today_pnl += quantity * (current_price - float(previous_close))
            except Exception as e:
                print(f"Could not fetch previousClose for {symbol}:", repr(e))

        total_value = cash_balance + current_value

        today_pnl_percent = (
            (today_pnl / (current_value - today_pnl)) * 100
            if (current_value - today_pnl) != 0 else 0
        )

        return {
            "cash_balance": round(cash_balance, 2),
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
        print("PORTFOLIO SUMMARY ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))