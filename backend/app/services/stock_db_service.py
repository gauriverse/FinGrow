from app.supabase import admin_supabase


def upsert_stock(stock_data: dict):
    stock_row = {
        "symbol": stock_data["symbol"],
        "company_name": stock_data.get("company"),
        "exchange": stock_data.get("exchange"),
        "current_price": stock_data.get("price"),
        "market_cap": stock_data.get("marketCap"),
    }

    result = (
        admin_supabase
        .table("stocks")
        .upsert(
            stock_row,
            on_conflict="symbol"
        )
        .execute()
    )

    return result.data
def upsert_stock_history(stock_id: str, history_data: dict):
    rows = []

    for item in history_data.get("data", []):
        rows.append({
            "stock_id": stock_id,
            "price_date": item["date"],
            "open_price": item.get("open"),
            "high_price": item.get("high"),
            "low_price": item.get("low"),
            "close_price": item.get("close"),
            "volume": item.get("volume"),
        })

    if not rows:
        return []

    result = (
        admin_supabase
        .table("stock_prices")
        .upsert(
            rows,
            on_conflict="stock_id,price_date"
        )
        .execute()
    )

    return result.data