from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import market_routes, auth_routes

app = FastAPI()


app.include_router(
    market_routes.router,
    prefix="/market",
    tags=["Market"]
)

app.include_router(
    auth_routes.router,
    prefix="/auth",
    tags=["Authentication"]
)


@app.get("/")
def home():
    return {"message": "FinGrow API running"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)    