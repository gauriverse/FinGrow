from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.services.recommendation_service import allocate_recommendations


router = APIRouter()


@router.get("")
def get_recommendations(current_user=Depends(get_current_user)):
    user_id = str(current_user.id)

    recommendations = allocate_recommendations(user_id)

    return {
        "recommendations": recommendations
    }