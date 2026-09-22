from app.ml.inference import STOCKS
from app.services.stock_db_service import sync_stock_universe


if __name__ == "__main__":
    synced = sync_stock_universe(STOCKS)

    print(f"Synced {len(synced)} stocks.")

    for stock in synced:
        print(
            f"{stock['symbol']} - "
            f"{stock['company_name']} - "
            f"{stock['current_price']}"
        )