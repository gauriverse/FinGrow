import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiRefreshCw, FiSearch, FiStar, FiX } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import {
  getUserWatchlist,
  removeFromWatchlist,
} from "../../services/watchlist";
import Sidebar from "../../components/Sidebar";
import HeaderActions from "../../components/HeaderActions";
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

type SortKey = "symbol" | "price" | "change";
type SortDir = "asc" | "desc";
type Filter = "all" | "gainers" | "losers";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

const getSymbol = (item: WatchlistItem): string => {
  const rel = item.stocks;
  if (!rel) return "";
  return Array.isArray(rel) ? rel[0]?.symbol ?? "" : rel.symbol ?? "";
};

const stripSuffix = (symbol: string) =>
  symbol.replace(/\.(NS|BO)$/, "");

export default function Watchlist() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Presentation-only state
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [confirmId, setConfirmId] = useState<string | null>(null);

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

  // =====================================================
  // VIEW HELPERS (search / filter / sort — display only)
  // =====================================================

  const counts = useMemo(
    () => ({
      gainers: stocks.filter(
        (s) => (s.stockInfo?.changePercent ?? 0) > 0
      ).length,
      losers: stocks.filter(
        (s) => (s.stockInfo?.changePercent ?? 0) < 0
      ).length,
    }),
    [stocks]
  );

  const visibleStocks = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = stocks.filter((item) => {
      const info = item.stockInfo;
      const change = info?.changePercent;

      if (filter === "gainers" && !(change != null && change > 0)) {
        return false;
      }
      if (filter === "losers" && !(change != null && change < 0)) {
        return false;
      }
      if (!q) return true;

      return (
        getSymbol(item).toLowerCase().includes(q) ||
        (info?.company ?? "").toLowerCase().includes(q)
      );
    });

    if (!sortKey) return list;

    const direction = sortDir === "asc" ? 1 : -1;

    const metric = (item: WatchlistStock): number | string | null => {
      if (sortKey === "symbol") return getSymbol(item);

      const raw =
        sortKey === "price"
          ? item.stockInfo?.price
          : item.stockInfo?.changePercent;

      return raw == null || Number.isNaN(Number(raw))
        ? null
        : Number(raw);
    };

    return [...list].sort((a, b) => {
      const x = metric(a);
      const y = metric(b);

      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;

      if (typeof x === "string" && typeof y === "string") {
        return x.localeCompare(y) * direction;
      }

      return ((x as number) - (y as number)) * direction;
    });
  }, [stocks, query, filter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    const first: SortDir = key === "symbol" ? "asc" : "desc";

    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(first);
      return;
    }

    if (sortDir === first) {
      setSortDir(first === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(null);
  };

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
  };

  const isFiltering = query.trim() !== "" || filter !== "all";

  const renderSortHeader = (
    label: string,
    key: SortKey,
    align: "left" | "right"
  ) => {
    const active = sortKey === key;

    return (
      <th
        scope="col"
        aria-sort={
          active
            ? sortDir === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={`py-2.5 ${align === "right" ? "text-right" : "text-left"}`}
      >
        <button
          type="button"
          onClick={() => handleSort(key)}
          title={`Sort by ${label.toLowerCase()}`}
          className={`inline-flex items-center gap-1 rounded font-semibold transition-colors ${active
            ? "text-[#0F4C3A]"
            : "text-slate-400 hover:text-slate-600"
            } ${FOCUS}`}
        >
          {label}
          <span
            aria-hidden="true"
            className={`text-[9px] ${active ? "opacity-100" : "opacity-0"}`}
          >
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        </button>
      </th>
    );
  };

  const renderChange = (change: number | null | undefined) =>
    change == null ? (
      <span className="text-sm text-slate-400">N/A</span>
    ) : (
      <span
        className={`inline-block rounded px-2 py-0.5 text-sm font-semibold tabular-nums ${change >= 0
          ? "bg-emerald-50 text-emerald-600"
          : "bg-red-50 text-red-600"
          }`}
      >
        {change >= 0 ? "▲ +" : "▼ "}
        {Math.abs(change).toFixed(2)}%
      </span>
    );

  const renderRemove = (item: WatchlistStock) => {
    const removing = removingId === item.stock_id;

    if (confirmId === item.stock_id && !removing) {
      return (
        <span className="inline-flex items-center gap-2 text-xs">
          <span className="text-slate-500">Remove?</span>

          <button
            type="button"
            onClick={() => {
              setConfirmId(null);
              handleRemove(item);
            }}
            className={`font-semibold text-red-600 hover:underline rounded ${FOCUS}`}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => setConfirmId(null)}
            className={`font-semibold text-slate-500 hover:underline rounded ${FOCUS}`}
          >
            No
          </button>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setConfirmId(item.stock_id)}
        disabled={removing}
        className={`text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 rounded ${FOCUS}`}
      >
        {removing ? "Removing..." : "Remove"}
      </button>
    );
  };

  const filterChips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stocks.length },
    { value: "gainers", label: "Gainers", count: counts.gainers },
    { value: "losers", label: "Losers", count: counts.losers },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* Top bar */}
     <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 md:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 active:scale-95 motion-reduce:transition-none ${FOCUS}`}
            aria-label="Open menu"
            title="Menu"
          >
            <FiMenu size={20} />
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className={`group text-sm font-medium text-slate-600 hover:text-[#0F4C3A] transition-colors rounded ${FOCUS}`}
          >
            <span className="inline-block transition-transform motion-safe:group-hover:-translate-x-0.5">
              ←
            </span>{" "}
            Dashboard
          </button>
        </div>
        <HeaderActions />
      </header>

      <main className="px-4 md:px-8 py-5 max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-4">
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            FINGROW / MY INVESTMENTS
          </p>

          <h1 className="text-3xl font-serif font-semibold text-slate-900 mt-1 leading-tight">
            My Watchlist
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Track the stocks you are interested in.
          </p>
        </div>

        {/* Watchlist container */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 leading-tight">
                Saved Stocks
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {stocks.length} stocks in your watchlist
              </p>
            </div>

            <button
              onClick={loadWatchlist}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#0F4C3A] hover:underline disabled:opacity-50 rounded ${FOCUS}`}
            >
              <FiRefreshCw
                size={14}
                className={
                  loading
                    ? "animate-spin motion-reduce:animate-none"
                    : ""
                }
              />
              Refresh
            </button>
          </div>

          {/* Toolbar: search + filters + mobile sort */}
          {!loading && stocks.length > 0 && (
            <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative w-full md:w-72 md:shrink-0">
                <FiSearch
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />

                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by symbol or company..."
                  aria-label="Search watchlist"
                  className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0F4C3A]/40 focus:ring-2 focus:ring-[#0F4C3A]/10 transition-colors"
                />

                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 ${FOCUS}`}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {filterChips.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setFilter(chip.value)}
                    aria-pressed={filter === chip.value}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors motion-safe:active:scale-[0.97] ${FOCUS} ${filter === chip.value
                      ? "bg-[#0F4C3A] text-white"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                  >
                    {chip.label}{" "}
                    <span className="tabular-nums opacity-70">
                      {chip.count}
                    </span>
                  </button>
                ))}
              </div>

              <label className="md:hidden flex items-center gap-2 text-sm text-slate-500">
                Sort
                <select
                  value={sortKey ? `${sortKey}:${sortDir}` : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setSortKey(null);
                      return;
                    }
                    const [key, dir] = value.split(":");
                    setSortKey(key as SortKey);
                    setSortDir(dir as SortDir);
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">Saved order</option>
                  <option value="symbol:asc">Name A–Z</option>
                  <option value="price:desc">Price: high to low</option>
                  <option value="price:asc">Price: low to high</option>
                  <option value="change:desc">Change: best first</option>
                  <option value="change:asc">Change: worst first</option>
                </select>
              </label>
            </div>
          )}

          <div className="mt-3">
            {loading ? (
              <div
                role="status"
                aria-live="polite"
                className="divide-y divide-slate-100"
              >
                <span className="sr-only">Loading your watchlist...</span>

                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 animate-pulse motion-reduce:animate-none"
                  >
                    <div className="space-y-2">
                      <div className="h-3.5 w-24 rounded bg-slate-100" />
                      <div className="h-3 w-40 rounded bg-slate-100" />
                    </div>
                    <div className="h-4 w-20 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : error && stocks.length === 0 ? (
              <div className="text-center py-8" role="alert">
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <button
                  onClick={loadWatchlist}
                  className={`bg-[#0F4C3A] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#0B3D2E] transition-colors motion-safe:active:scale-[0.98] ${FOCUS}`}
                >
                  Try Again
                </button>
              </div>
            ) : stocks.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-[#0F4C3A]">
                  <FiStar size={22} />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-800">
                  Your watchlist is empty
                </h3>
                <p className="text-sm text-slate-400 mt-1.5">
                  Add stocks from their detail pages to track them here.
                </p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className={`mt-4 bg-[#0F4C3A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0B3D2E] transition-colors motion-safe:active:scale-[0.98] ${FOCUS}`}
                >
                  Explore Stocks
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <p
                    className="text-sm text-red-600 mb-3"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                {visibleStocks.length === 0 ? (
                  <div className="text-center py-8">
                    <h3 className="font-semibold text-slate-800">
                      No stocks match
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Try a different search or filter.
                    </p>
                    {isFiltering && (
                      <button
                        onClick={clearFilters}
                        className={`mt-3 text-sm font-medium text-[#0F4C3A] hover:underline rounded ${FOCUS}`}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-xs text-slate-400 border-b border-slate-100">
                            {renderSortHeader("STOCK", "symbol", "left")}
                            {renderSortHeader("PRICE", "price", "right")}
                            {renderSortHeader(
                              "TODAY'S CHANGE",
                              "change",
                              "right"
                            )}
                            <th className="py-2.5 pl-8 font-semibold">
                              EXCHANGE
                            </th>
                            <th className="py-2.5 font-semibold text-right">
                              ACTIONS
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {visibleStocks.map((item) => {
                            const symbol = getSymbol(item);
                            const info = item.stockInfo;
                            const displaySymbol = stripSuffix(symbol);

                            return (
                              <tr
                                key={item.stock_id}
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-2.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/stock/${encodeURIComponent(symbol)}`
                                      )
                                    }
                                    disabled={!symbol}
                                    title="View stock details"
                                    className={`block text-left rounded ${FOCUS}`}
                                  >
                                    <span className="block font-semibold text-sm text-slate-900 hover:text-[#0F4C3A]">
                                      {displaySymbol || "Unknown"}
                                    </span>
                                    <span className="block text-xs text-slate-400 mt-0.5">
                                      {info?.company ||
                                        "Company name unavailable"}
                                    </span>
                                  </button>
                                </td>

                                <td
                                  className="py-2.5 text-right text-sm font-semibold text-slate-800 tabular-nums"
                                  title={
                                    info
                                      ? undefined
                                      : "Live price could not be loaded"
                                  }
                                >
                                  {formatINR(info?.price)}
                                </td>

                                <td className="py-2.5 text-right">
                                  {renderChange(info?.changePercent)}
                                </td>

                                <td className="py-2.5 pl-8 text-sm text-slate-600">
                                  {getExchange(symbol, info?.exchange)}
                                </td>

                                <td className="py-2.5">
                                  <div className="flex justify-end items-center gap-3">
                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/stock/${encodeURIComponent(symbol)}`
                                        )
                                      }
                                      className={`text-xs font-semibold text-[#0F4C3A] hover:underline rounded ${FOCUS}`}
                                    >
                                      View Details
                                    </button>

                                    {renderRemove(item)}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                      {visibleStocks.map((item) => {
                        const symbol = getSymbol(item);
                        const info = item.stockInfo;
                        const change = info?.changePercent;

                        return (
                          <div
                            key={item.stock_id}
                            className="border border-slate-200 rounded-xl px-3 py-2.5"
                          >
                            <div className="flex justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="font-semibold text-slate-900">
                                  {stripSuffix(symbol) || "Unknown"}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                  {info?.company ||
                                    "Company name unavailable"}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="font-bold text-slate-900 tabular-nums">
                                  {formatINR(info?.price)}
                                </p>
                                {change != null && (
                                  <p
                                    className={`text-xs mt-0.5 tabular-nums ${change >= 0
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

                            <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500">
                                {getExchange(symbol, info?.exchange)}
                              </span>

                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/stock/${encodeURIComponent(symbol)}`
                                    )
                                  }
                                  className={`text-xs font-semibold text-[#0F4C3A] rounded ${FOCUS}`}
                                >
                                  View Details
                                </button>

                                {renderRemove(item)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}