from fastapi import APIRouter
from app.services.yahoo_service import (
    get_stock_data,
    get_stock_history,
    get_nifty,
    get_sensex,
    get_market_movers
)

router = APIRouter()


@router.get("/stock/{symbol}")
def stock(symbol: str):
    return get_stock_data(symbol)


@router.get("/history/{symbol}")
def get_history(symbol: str):
    return get_stock_history(symbol)


@router.get("/nifty")
def nifty():
    return get_nifty()


@router.get("/sensex")
def sensex():
    return get_sensex()

@router.get("/movers")
def movers():
    return get_market_movers()