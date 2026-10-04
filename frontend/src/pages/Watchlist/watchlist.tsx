
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  getUserWatchlist,
  removeFromWatchlist,
} from "../../services/watchlist";

interface StockRelation {
  id: string;
  symbol: string;
}

interface WatchlistItem {
  id: string;
  user_id: string;
  stock_id: string;
  created_at: string;
  stocks: StockRelation | StockRelation[] | null;
}

interface StockInfo {
  symbol: string;
  company?: string | null;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  exchange?: string | null;
}

interface WatchlistStock extends WatchlistItem {
  stockInfo: StockInfo | null;
}
const getSymbol = (item: WatchlistItem): string => {
  const rel = item.stocks;
  if (!rel) return "";
  return Array.isArray(rel) ? rel[0]?.symbol ?? "" : rel.symbol ?? "";
};
export default function Watchlist() {
  const navigate = useNavigate();

  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const API = "http://127.0.0.1:8000/market";

  const formatINR = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(Number(value))) {
      return "N/A";
    }

    return `₹${Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getExchange = (symbol: string, exchange?: string | null) => {
    if (symbol.endsWith(".NS")) return "NSE";
    if (symbol.endsWith(".BO")) return "BSE";
    return exchange || "N/A";
  };

  const loadWatchlist = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        navigate("/login");
        return;
      }

      const data = (await getUserWatchlist(
        user.id
      )) as WatchlistItem[];
      console.log("Fetched watchlist:", data);

      data.forEach((item) => {
        console.log("Stock relation:", item.stocks);
      });

      console.log("Watchlist data from Supabase:", data);

      const results = await Promise.all(
        data.map(async (item) => {
          const symbol = getSymbol(item);

          if (!symbol) {
            return {
              ...item,
              stockInfo: null,
            };
          }

          try {
            const response = await fetch(
              `${API}/stock/${encodeURIComponent(symbol)}`
            );
            console.log("Stock API URL:", `${API}/stock/${encodeURIComponent(symbol)}`);
            console.log("Stock API status:", response.status);
            if (!response.ok) {
              throw new Error("Unable to fetch stock data");
            }

            const stockInfo = await response.json();

            console.log("Fetched stock symbol:", symbol);
            console.log("Stock API response:", stockInfo);

            return {
              ...item,
              stockInfo,
            };
          } catch (err) {
            console.error(
              `Failed to load ${symbol}:`,
              err
            );

            return {
              ...item,
              stockInfo: null,
            };
          }
        })
      );

      setStocks(results);
    } catch (err) {
      console.error("Watchlist loading failed:", err);
      setError("Unable to load your watchlist. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlist();
  }, []);

  const handleRemove = async (item: WatchlistStock) => {
    try {
      setRemovingId(item.stock_id);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      await removeFromWatchlist(user.id, item.stock_id);

      setStocks((previous) =>
        previous.filter(
          (stock) => stock.stock_id !== item.stock_id
        )
      );
    } catch (err) {
      console.error("Remove failed:", err);
      setError("Unable to remove this stock. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 md:px-10 py-5 flex items-center">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm font-medium text-slate-600 hover:text-[#0F4C3A]"
        >
          ← Dashboard
        </button>
      </header>

      <main className="px-5 md:px-10 py-8 max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-7">
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            FINGROW / MY INVESTMENTS
          </p>

          <h1 className="text-3xl font-serif font-semibold text-slate-900 mt-2">
            My Watchlist
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Track the stocks you are interested in.
          </p>
        </div>

        {/* Watchlist container */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Saved Stocks
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {stocks.length} stocks in your watchlist
              </p>
            </div>

            <button
              onClick={loadWatchlist}
              disabled={loading}
              className="text-sm font-medium text-[#0F4C3A] hover:underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Loading your watchlist...
            </p>
          ) : error && stocks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button
                onClick={loadWatchlist}
                className="bg-[#0F4C3A] text-white px-4 py-2 rounded-lg text-sm"
              >
                Try Again
              </button>
            </div>
          ) : stocks.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-4xl mb-3">☆</div>
              <h3 className="text-lg font-semibold text-slate-800">
                Your watchlist is empty
              </h3>
              <p className="text-sm text-slate-400 mt-2">
                Add stocks from their detail pages to track them here.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-5 bg-[#0F4C3A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0B3D2E]"
              >
                Explore Stocks
              </button>
            </div>
          ) : (
            <>
              {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
              )}

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100">
                      <th className="py-3 font-semibold">STOCK</th>
                      <th className="py-3 font-semibold">PRICE</th>
                      <th className="py-3 font-semibold">TODAY'S CHANGE</th>
                      <th className="py-3 font-semibold">EXCHANGE</th>
                      <th className="py-3 font-semibold text-right">ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {stocks.map((item) => {
                      const symbol = getSymbol(item);
                      const info = item.stockInfo;
                      const change = info?.changePercent;
                      const displaySymbol = symbol.replace(/\.(NS|BO)$/, "");

                      return (
                        <tr
                          key={item.stock_id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-4">
                            <div className="font-semibold text-sm text-slate-900">
                              {displaySymbol || "Unknown"}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {info?.company || "Company name unavailable"}
                            </div>
                          </td>

                          <td className="py-4 text-sm font-semibold text-slate-800">
                            {formatINR(info?.price)}
                          </td>

                          <td className="py-4">
                            {change == null ? (
                              <span className="text-sm text-slate-400">N/A</span>
                            ) : (
                              <span
                                className={`text-sm font-semibold ${change >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                                  }`}
                              >
                                {change >= 0 ? "▲ +" : "▼ "}
                                {Math.abs(change).toFixed(2)}%
                              </span>
                            )}
                          </td>

                          <td className="py-4 text-sm text-slate-600">
                            {getExchange(symbol, info?.exchange)}
                          </td>

                          <td className="py-4">
                            <div className="flex justify-end items-center gap-3">
                              <button
                                onClick={() =>
                                  navigate(`/stock/${encodeURIComponent(symbol)}`)
                                }
                                className="text-xs font-semibold text-[#0F4C3A] hover:underline"
                              >
                                View Details
                              </button>

                              <button
                                onClick={() => handleRemove(item)}
                                disabled={removingId === item.stock_id}
                                className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                              >
                                {removingId === item.stock_id
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {stocks.map((item) => {
                  const symbol = getSymbol(item);
                  const info = item.stockInfo;
                  const change = info?.changePercent;

                  return (
                    <div
                      key={item.stock_id}
                      className="border border-slate-200 rounded-xl p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {symbol.replace(/\.(NS|BO)$/, "") || "Unknown"}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            {info?.company || "Company name unavailable"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-slate-900">
                            {formatINR(info?.price)}
                          </p>
                          {change != null && (
                            <p
                              className={`text-xs mt-1 ${change >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                                }`}
                            >
                              {change >= 0 ? "+" : ""}
                              {change.toFixed(2)}%
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-500">
                          {getExchange(symbol, info?.exchange)}
                        </span>

                        <div className="flex gap-4">
                          <button
                            onClick={() =>
                              navigate(`/stock/${encodeURIComponent(symbol)}`)
                            }
                            className="text-xs font-semibold text-[#0F4C3A]"
                          >
                            View Details
                          </button>

                          <button
                            onClick={() => handleRemove(item)}
                            disabled={removingId === item.stock_id}
                            className="text-xs font-semibold text-red-600 disabled:opacity-50"
                          >
                            {removingId === item.stock_id
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}