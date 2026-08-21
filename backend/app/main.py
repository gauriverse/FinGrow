from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.portfolio_routes import router as portfolio_router
from app.routes import market_routes, auth_routes

app = FastAPI()
app.include_router(market_routes.router, prefix="/market")



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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)    