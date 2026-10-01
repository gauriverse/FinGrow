from fastapi import APIRouter, Depends, HTTPException
from app.supabase import admin_supabase
from app.auth import get_current_user

router = APIRouter()


# ============================================================
# GET ALL PUBLISHED LEARNING CONTENT
# ============================================================

@router.get("/content")
def get_learning_content(
    current_user=Depends(get_current_user)
):
    try:
        result = (
            admin_supabase
            .table("learn_content")
            .select(
                "id, category, title, slug, description, "
                "difficulty, estimated_minutes, display_order"
            )
            .eq("published", True)
            .order("category")
            .order("display_order")
            .execute()
        )

        return {
            "content": result.data or []
        }

    except Exception as e:
        print("LEARN CONTENT ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Unable to load learning content"
        )


# ============================================================
# GET SINGLE LESSON
# ============================================================

@router.get("/content/{slug}")
def get_learning_lesson(
    slug: str,
    current_user=Depends(get_current_user)
):
    try:
        result = (
            admin_supabase
            .table("learn_content")
            .select("*")
            .eq("slug", slug)
            .eq("published", True)
            .maybe_single()
            .execute()
        )

        if not result or not result.data:
            raise HTTPException(
                status_code=404,
                detail="Learning content not found"
            )

        return result.data

    except HTTPException:
        raise

    except Exception as e:
        print("LEARN LESSON ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Unable to load lesson"
        )


# ============================================================
# GET USER LEARNING PROGRESS
# ============================================================

@router.get("/progress")
def get_learning_progress(
    current_user=Depends(get_current_user)
):
    try:
        user_id = str(current_user.id)

        result = (
            admin_supabase
            .table("user_learning_progress")
            .select(
                "id, content_id, progress_percent, "
                "completed, completed_at"
            )
            .eq("user_id", user_id)
            .execute()
        )

        return {
            "progress": result.data or []
        }

    except Exception as e:
        print("LEARN PROGRESS ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Unable to load learning progress"
        )


# ============================================================
# UPDATE USER LEARNING PROGRESS
# ============================================================

@router.put("/progress/{content_id}")
def update_learning_progress(
    content_id: str,
    progress_percent: int,
    current_user=Depends(get_current_user)
):
    try:
        user_id = str(current_user.id)

        if progress_percent < 0 or progress_percent > 100:
            raise HTTPException(
                status_code=400,
                detail="Progress must be between 0 and 100"
            )

        completed = progress_percent == 100

        progress_data = {
            "user_id": user_id,
            "content_id": content_id,
            "progress_percent": progress_percent,
            "completed": completed,
        }

        if completed:
            from datetime import datetime, timezone

            progress_data["completed_at"] = (
                datetime.now(timezone.utc).isoformat()
            )

        result = (
            admin_supabase
            .table("user_learning_progress")
            .upsert(
                progress_data,
                on_conflict="user_id,content_id"
            )
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Unable to save learning progress"
            )

        return result.data[0]

    except HTTPException:
        raise

    except Exception as e:
        print("UPDATE LEARN PROGRESS ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Unable to update learning progress"
        )