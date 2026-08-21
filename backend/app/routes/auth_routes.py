from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.supabase import supabase, admin_supabase

router = APIRouter()

class AuthRequest(BaseModel):
    email: str
    password: str

@router.post("/signup")
def signup(data: AuthRequest):
    try:
        users_response = admin_supabase.auth.admin.list_users()

        email_exists = any(
            user.email.lower() == data.email.lower()        
            for user in users_response
        )

        if email_exists:
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )

        response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password
        })

        return {
            "message": "Signup successful. Please verify your email.",
            "user": response.user
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

@router.post("/login")
def login(data: AuthRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })

        return {
            "message": "Login successful",
            "access_token": response.session.access_token,
            "user": response.user
        }

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

@router.post("/logout")
def logout():
    try:
        supabase.auth.sign_out()

        return {
            "message": "Logged out successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )