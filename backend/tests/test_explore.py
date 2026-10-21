"""
Tests for app/routes/explore_routes.py.
ALL DATA BELOW IS FAKE (made up for tests). No Supabase or Yahoo call is made.

Run from the backend folder:   python -m pytest tests/test_explore.py -v
(needs pytest, and httpx for the TestClient smoke tests at the bottom)
"""
from datetime import datetime, timedelta, timezone

from app.routes import explore_routes as ex
from app.routes import market_routes

_NOW = datetime.now(timezone.utc)
FRESH = (_NOW - timedelta(hours=1)).isoformat()      # updated 1 hour ago
OLD = (_NOW - timedelta(days=10)).isoformat()        # updated 10 days ago -> stale


def fake_raw():
    def row(sym, name, sector, price, cap, kind="equity", updated=FRESH):
        return {"id": sym, "symbol": sym, "company_name": name, "sector": sector,
                "exchange": "NSI", "current_price": price, "market_cap": cap,
                "updated_at": updated, "asset_type": kind}
    return [
        row("AAA.NS", "Alpha Bank", "Financial Services", 100.0, 5e12),      # 5 lakh Cr
        row("BBB.NS", "Beta Tech", "Technology", 200.0, 1.5e12),             # 1.5 lakh Cr
        row("CCC.NS", "Gamma Tech", "Technology", 300.0, 3e12),              # 3 lakh Cr
        row("DDD.NS", "Delta Oil", "Energy", 50.0, 2e13),                    # 20 lakh Cr
        row("EEE.NS", "Echo Pharma", None, 400.0, 8e10, updated=OLD),        # no sector, 8,000 Cr, STALE
        row("FFF.NS", "Foxtrot Ltd", "Energy", 10.0, None),                  # no market cap
        row("ETF1.NS", "Some ETF", None, 250.0, None, kind="etf"),
        row("IDX1.NS", "Some Index", None, 58000.0, None, kind="index"),
    ]


# (last_close, prev_close). AAA up 10%, BBB down 10%, CCC flat, DDD has no Yahoo data.
FAKE_CLOSES = {
    "AAA.NS": (100.0, 90.909091),
    "BBB.NS": (200.0, 222.222222),
    "CCC.NS": (300.0, 300.0),
    "EEE.NS": (400.0, 380.0),
    "FFF.NS": (10.0, 10.0),
    "ETF1.NS": (250.0, 249.0),
}


def setup_fakes(monkeypatch, closes=FAKE_CLOSES, closes_ok=True):
    market_routes._cache.clear()
    monkeypatch.setattr(ex, "_fetch_universe", fake_raw)
    monkeypatch.setattr(ex, "_fetch_closes", lambda symbols: (closes, closes_ok))


def call(**kw):
    defaults = dict(q="", type="equity", sector="", mcap_min=None, mcap_max=None,
                    change="all", min_price=None, max_price=None, sort="mcap",
                    page=1, page_size=25)
    defaults.update(kw)
    return ex.explore(**defaults)


def symbols(result):
    return [i["symbol"] for i in result["items"]]


def test_default_is_equities_only_sorted_by_mcap(monkeypatch):
    setup_fakes(monkeypatch)
    r = call()
    assert r["total"] == 6
    assert "ETF1.NS" not in symbols(r) and "IDX1.NS" not in symbols(r)
    assert symbols(r) == ["DDD.NS", "AAA.NS", "CCC.NS", "BBB.NS", "EEE.NS", "FFF.NS"]  # missing cap LAST


def test_missing_market_cap_is_kept_not_dropped(monkeypatch):
    setup_fakes(monkeypatch)
    item = [i for i in call()["items"] if i["symbol"] == "FFF.NS"][0]
    assert item["marketCap"] is None and item["marketCapCr"] is None


def test_etf_and_index_tabs(monkeypatch):
    setup_fakes(monkeypatch)
    assert symbols(call(type="etf")) == ["ETF1.NS"]
    assert symbols(call(type="index")) == ["IDX1.NS"]


def test_day_change_values(monkeypatch):
    setup_fakes(monkeypatch)
    items = {i["symbol"]: i for i in call()["items"]}
    assert items["AAA.NS"]["changePercent"] == 10.0
    assert items["BBB.NS"]["changePercent"] == -10.0
    assert items["CCC.NS"]["changePercent"] == 0.0
    assert items["DDD.NS"]["changePercent"] is None      # no Yahoo data -> "—"


def test_day_change_ignored_when_yahoo_close_does_not_match_db_price(monkeypatch):
    closes = dict(FAKE_CLOSES)
    closes["AAA.NS"] = (150.0, 140.0)      # DB price is 100 -> mismatch
    setup_fakes(monkeypatch, closes)
    items = {i["symbol"]: i for i in call()["items"]}
    assert items["AAA.NS"]["changePercent"] is None


def test_gainers_and_losers(monkeypatch):
    setup_fakes(monkeypatch)
    gainers = symbols(call(change="gainers", sort="change"))
    assert gainers == ["AAA.NS", "EEE.NS"]               # +10%, +5.26%
    assert symbols(call(change="losers")) == ["BBB.NS"]


def test_sector_filter_and_unclassified(monkeypatch):
    setup_fakes(monkeypatch)
    assert sorted(symbols(call(sector="Technology"))) == ["BBB.NS", "CCC.NS"]
    assert symbols(call(sector="Unclassified")) == ["EEE.NS"]
    assert sorted(symbols(call(sector="technology,energy"))) == ["BBB.NS", "CCC.NS", "DDD.NS", "FFF.NS"]


def test_mcap_range_in_crore(monkeypatch):
    setup_fakes(monkeypatch)
    # 1 lakh Cr = 1e5 Cr. min inclusive, max exclusive.
    r = call(mcap_min=1e5, mcap_max=5e5)
    assert sorted(symbols(r)) == ["BBB.NS", "CCC.NS"]     # AAA is exactly 5e5 -> excluded
    assert "FFF.NS" not in symbols(r)                      # no cap can't match a cap filter


def test_price_range_and_search(monkeypatch):
    setup_fakes(monkeypatch)
    assert sorted(symbols(call(min_price=100, max_price=300))) == ["AAA.NS", "BBB.NS", "CCC.NS"]
    assert symbols(call(q="gamma")) == ["CCC.NS"]
    assert symbols(call(q="aaa")) == ["AAA.NS"]            # symbol search works without .NS


def test_sort_az_and_price(monkeypatch):
    setup_fakes(monkeypatch)
    assert symbols(call(sort="az"))[:2] == ["AAA.NS", "BBB.NS"]
    assert symbols(call(sort="price"))[0] == "EEE.NS"

def test_ascending_sorts(monkeypatch):
    setup_fakes(monkeypatch)
    assert symbols(call(sort="price_asc"))[0] == "FFF.NS"            # Rs 10 is cheapest
    asc = symbols(call(sort="change_asc"))
    assert asc[0] == "BBB.NS"                                          # -10% first
    assert asc[-1] == "DDD.NS"                                         # no day change -> last

def test_pagination(monkeypatch):
    setup_fakes(monkeypatch)
    p1 = call(page=1, page_size=4)
    p2 = call(page=2, page_size=4)
    assert len(p1["items"]) == 4 and len(p2["items"]) == 2
    assert p1["total"] == p2["total"] == 6
    assert not set(symbols(p1)) & set(symbols(p2))


def test_facets_exclude_their_own_filter(monkeypatch):
    setup_fakes(monkeypatch)
    r = call(sector="Technology")
    sectors = {s["name"]: s["count"] for s in r["facets"]["sectors"]}
    # sector facet ignores the sector filter itself, so other sectors still show:
    assert sectors == {"Energy": 2, "Technology": 2, "Financial Services": 1, "Unclassified": 1}
    assert r["facets"]["sectors"][-1]["name"] == "Unclassified"      # always last


def test_facets_respond_to_other_filters_and_hide_zero(monkeypatch):
    setup_fakes(monkeypatch)
    r = call(change="gainers")
    names = [s["name"] for s in r["facets"]["sectors"]]
    assert names == ["Financial Services", "Unclassified"]           # only sectors with gainers
    assert all(b["count"] > 0 for b in r["facets"]["mcap"])


def test_type_facet_counts(monkeypatch):
    setup_fakes(monkeypatch)
    assert call()["facets"]["types"] == {"equity": 6, "etf": 1, "index": 1}


def test_meta_flags(monkeypatch):
    setup_fakes(monkeypatch)
    meta = call()["meta"]
    assert meta["dayChangeAvailable"] is True
    assert meta["pricesAsOf"] == FRESH
    assert meta["staleCount"] == 1          # only EEE (10 days old) is stale


def test_yahoo_failure_does_not_break_page(monkeypatch):
    setup_fakes(monkeypatch, closes={}, closes_ok=False)
    r = call()
    assert r["total"] == 6 and r["meta"]["dayChangeAvailable"] is False
    assert all(i["changePercent"] is None for i in r["items"])


def test_bad_params_rejected(monkeypatch):
    from fastapi import HTTPException
    setup_fakes(monkeypatch)
    for bad in (dict(type="crypto"), dict(sort="nope"), dict(change="x")):
        try:
            call(**bad)
            assert False, "should have raised"
        except HTTPException as e:
            assert e.status_code == 400


def test_build_rows_paginates_supabase_reads(monkeypatch):
    """_fetch_universe must keep reading until a short page comes back (1000-row cap)."""
    calls = []

    class FakeQuery:
        def __init__(self): self.rng = None
        def select(self, *_): return self
        def order(self, *_): return self
        def range(self, a, b): self.rng = (a, b); calls.append((a, b)); return self
        def execute(self):
            a, b = self.rng
            total = 2300
            n = max(0, min(b, total - 1) - a + 1)
            return type("R", (), {"data": [{"symbol": f"S{a+i}"} for i in range(n)]})()

    class FakeDB:
        def table(self, _): return FakeQuery()

    monkeypatch.setattr(ex, "admin_supabase", FakeDB())
    rows = ex._fetch_universe()
    assert len(rows) == 2300 and calls == [(0, 999), (1000, 1999), (2000, 2999)]


# ---------- FastAPI smoke tests (need httpx installed) ----------

def _client(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    setup_fakes(monkeypatch)
    app = FastAPI()
    app.include_router(ex.router, prefix="/market")
    return TestClient(app)


def test_http_explore_ok(monkeypatch):
    client = _client(monkeypatch)
    res = client.get("/market/explore?sector=Technology,Energy&sort=price&page_size=2")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"items", "total", "page", "page_size", "facets", "meta"}
    assert body["total"] == 4 and len(body["items"]) == 2


def test_http_validation(monkeypatch):
    client = _client(monkeypatch)
    assert client.get("/market/explore?type=crypto").status_code == 400
    assert client.get("/market/explore?page=0").status_code == 422
    assert client.get("/market/explore?page_size=1000").status_code == 422