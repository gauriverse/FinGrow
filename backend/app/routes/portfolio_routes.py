from fastapi import APIRouter, HTTPException
from app.supabase import admin_supabase

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
        # 1. Get user's paper account
        account_result = (
            admin_supabase
            .table("paper_accounts")
            .select("cash_balance")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not account_result.data:
            raise HTTPException(
                status_code=404,
                detail="Paper account not found"
            )

        cash_balance = float(account_result.data["cash_balance"])

        # 2. Get user's portfolio holdings
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

        # 3. Calculate current value of each holding
        for holding in holdings:

            stock_result = (
                admin_supabase
                .table("stocks")
                .select("current_price")
                .eq("id", holding["stock_id"])
                .maybe_single()
                .execute()
            )

            if not stock_result.data:
                continue

            quantity = int(holding["quantity"] or 0)
            buy_price = float(holding["buy_price"] or 0)
            current_price = float(
                stock_result.data["current_price"] or 0
            )

            invested = quantity * buy_price
            current = quantity * current_price

            invested_value += invested
            current_value += current
            overall_pnl += current - invested

        # 4. Total portfolio value
        total_value = cash_balance + current_value

        return {
            "cash_balance": round(cash_balance, 2),
            "invested_value": round(invested_value, 2),
            "current_value": round(current_value, 2),
            "total_value": round(total_value, 2),
            "overall_pnl": round(overall_pnl, 2)
        }

    except HTTPException:
        raise

    except Exception as e:
        print("PORTFOLIO SUMMARY ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )