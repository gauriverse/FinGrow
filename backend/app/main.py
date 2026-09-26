
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.portfolio_routes import router as portfolio_router
from app.routes import market_routes, auth_routes, recommendation_routes
from app.ml.model_loader import model

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(market_routes.router, prefix="/market")
app.include_router(
    recommendation_routes.router,
    prefix="/recommendations",
    tags=["Recommendations"]
)


app.include_router(
    portfolio_router,
    prefix="/portfolio"
)


app.include_router(
    auth_routes.router,
    prefix="/auth",
    tags=["Authentication"]
)


@app.get("/")
def home():
    return {"message": "FinGrow API running"}

  