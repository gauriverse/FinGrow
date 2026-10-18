
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.services.recommendation_service import allocate_recommendations
from app.services.xai_service import explain_stock


router = APIRouter()


@router.get("")
def get_recommendations(current_user=Depends(get_current_user)):
    user_id = str(current_user.id)

    recommendations = allocate_recommendations(user_id)

    return {
        "recommendations": recommendations
    }


@router.get("/{symbol}/explanation")
def get_stock_explanation(
    symbol: str,
    current_user=Depends(get_current_user),
):
    try:
        return explain_stock(symbol)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        print(f"XAI explanation failed for {symbol}: {exc}")

        raise HTTPException(
            status_code=503,
            detail="Stock explanation is temporarily unavailable. Please try again.",
        ) from exc
