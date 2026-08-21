from fastapi import APIRouter
from app.services.stock_db_service import (
    upsert_stock,
    upsert_stock_history
)
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
    data = get_stock_data(symbol)
    upsert_stock(data)
    return data


@router.get("/history/{symbol}")
def get_history(symbol: str):

    # Get current stock data so we have the stocks.id
    stock_data = get_stock_data(symbol)

    # Make sure the stock exists in stocks table
    stock_rows = upsert_stock(stock_data)

    if not stock_rows:
        return {
            "error": "Stock could not be created"
        }

    stock_id = stock_rows[0]["id"]

    # Get 1 year Yahoo history
    history_data = get_stock_history(symbol)

    # Store historical prices in stock_prices
    upsert_stock_history(stock_id, history_data)

    # Return history to frontend
    return history_data


@router.get("/nifty")
def nifty():
    return get_nifty()


@router.get("/sensex")
def sensex():
    return get_sensex()

@router.get("/movers")
def movers():
    return get_market_movers()