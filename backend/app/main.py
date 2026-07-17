from fastapi import FastAPI
from app.routes import market_routes

app = FastAPI()


app.include_router(
    market_routes.router,
    prefix="/market",
    tags=["Market"]
)


@app.get("/")
def home():
    return {"message": "FinGrow API running"}