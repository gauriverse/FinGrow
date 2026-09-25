import React, { useEffect, useState, useRef } from "react";
import {
  getNifty,
  getSensex,
  getMarketMovers,
  searchStocks,
  getStock,
} from "../../services/marketService";
import { useNavigate } from "react-router-dom";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { getPortfolioSummary } from "../../services/portfolioService";

export default function Dashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const profileRef = useRef(null);
  const skipNextSearch = useRef(false);

  const [nifty, setNifty] = useState(null);
  const [sensex, setSensex] = useState(null);
  const [marketMovers, setMarketMovers] = useState(null);
  const [portfolio, setPortfolio] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  // =====================================================
  // STOCK FORMATTING HELPERS
  // =====================================================

  const formatINR = (value) => {
    if (value == null || Number.isNaN(Number(value))) {
      return "N/A";
    }

    return `₹${Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatVolume = (value) => {
    if (value == null || Number.isNaN(Number(value))) {
      return "N/A";
    }

    const volume = Number(value);

    if (volume >= 1e7) {
      return `${(volume / 1e7).toFixed(2)} Cr`;
    }

    if (volume >= 1e5) {
      return `${(volume / 1e5).toFixed(2)} L`;
    }

    if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)} K`;
    }

    return volume.toLocaleString("en-IN");
  };

  const formatMarketCap = (value) => {
    if (value == null || Number.isNaN(Number(value))) {
      return "N/A";
    }

    const cap = Number(value);

    if (cap >= 1e12) {
      return `₹${(cap / 1e12).toFixed(2)} L Cr`;
    }

    if (cap >= 1e7) {
      return `₹${(cap / 1e7).toFixed(2)} Cr`;
    }

    if (cap >= 1e5) {
      return `₹${(cap / 1e5).toFixed(2)} L`;
    }

    return `₹${cap.toLocaleString("en-IN")}`;
  };

  const displayExchange = (exchange, symbol) => {
    if (symbol?.endsWith(".NS")) {
      return "NSE";
    }

    if (symbol?.endsWith(".BO")) {
      return "BSE";
    }

    return exchange || "N/A";
  };

  // =====================================================
  // STOCK SEARCH
  // =====================================================

  useEffect(() => {
    const searchStocksWithDelay = async () => {
      const query = searchQuery.trim();

      // Don't search again immediately after selecting a stock
      if (skipNextSearch.current) {
        skipNextSearch.current = false;
        return;
      }

      if (!query) {
        setSearchResults([]);
        return;
      }

      try {
        setSearchLoading(true);

        const results = await searchStocks(query);

        setSearchResults(results);
      } catch (error) {
        console.error("Stock search failed:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    const timer = setTimeout(searchStocksWithDelay, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  useEffect(() => {
    const loadDashboard = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate("/login");
        return;
      }

      // =================================================
      // PROFILE
      // =================================================

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const googleName =
        user.user_metadata?.full_name || user.user_metadata?.name || "";

      const fullName =
        profileData?.full_name?.trim() || googleName.trim() || "";

      setProfile({
        full_name: fullName,
        email: user.email,
      });

      // =================================================
      // MARKET + PORTFOLIO
      // =================================================

      const [niftyResult, sensexResult, moversResult, portfolioResult] =
        await Promise.allSettled([
          getNifty(),
          getSensex(),
          getMarketMovers(),
          getPortfolioSummary(),
        ]);

      // NIFTY
      if (niftyResult.status === "fulfilled") {
        setNifty(niftyResult.value);
      } else {
        console.error("Nifty failed:", niftyResult.reason);
      }

      // SENSEX
      if (sensexResult.status === "fulfilled") {
        setSensex(sensexResult.value);
      } else {
        console.error("Sensex failed:", sensexResult.reason);
      }

      // MARKET MOVERS
      if (moversResult.status === "fulfilled") {
        setMarketMovers(moversResult.value);
      } else {
        console.error("Market movers failed:", moversResult.reason);
      }

      // PORTFOLIO
      if (portfolioResult.status === "fulfilled") {
        setPortfolio(portfolioResult.value);
      } else {
        console.error("Portfolio failed:", portfolioResult.reason);
      }
    };

    loadDashboard();
  }, [navigate]);

  // =====================================================
  // CLOSE PROFILE DROPDOWN
  // =====================================================

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // =====================================================
  // SELECT STOCK
  // =====================================================

  const handleStockSelect = async (stock) => {
    try {
      console.log("Selected stock:", stock.symbol);

      const data = await getStock(stock.symbol);

      console.log("Stock data:", data);

      setSelectedStock(data);

      // Prevent the selected symbol from triggering another search
      skipNextSearch.current = true;

      setSearchQuery(stock.symbol.replace(".NS", ""));

      // Close search results
      setSearchResults([]);
      setSearchLoading(false);
    } catch (error) {
      console.error("Failed to load stock:", error);
    }
  };

  // =====================================================
  // USER INFO
  // =====================================================

  const fullName = profile?.full_name?.trim() || "";

  const nameParts = fullName.split(/\s+/);

  const firstName = nameParts[0] || "there";

  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : nameParts[0]?.slice(0, 2);

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // =====================================================
  // DATE
  // =====================================================

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // =====================================================
  // NAV ITEMS
  // =====================================================

  const navItems = [
    "Dashboard",
    "AI Picks",
    "Portfolio",
    "Watchlist",
    "Learn",
    "Settings",
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <>
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-[#0B1B2E] flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {/* Logo */}

          <div className="flex items-center justify-between px-6 py-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
                F
              </div>

              <span className="font-bold text-lg text-white font-serif tracking-tight">
                FinGrow
              </span>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const active = item === "Dashboard";

              return (
                <button
                  key={item}
                  onClick={() => {
                    if (item === "Dashboard") {
                      setSidebarOpen(false);
                      setSelectedStock(null);
                      setSearchQuery("");
                      setSearchResults([]);
                      return;
                    }

                    if (item === "AI Picks") {
                      setSidebarOpen(false);
                      navigate("/ai-picks");
                      return;
                    }

                    if (item === "Settings") {
                      setSidebarOpen(false);
                      navigate("/settings");
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      active ? "bg-white" : "bg-slate-500"
                    }`}
                  />

                  {item}
                </button>
              );
            })}
          </nav>

          <div className="px-6 py-6 border-t border-white/10">
            <p className="text-[11px] text-slate-500">
              Paper trading · virtual funds only
            </p>
          </div>
        </aside>
      </>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="flex-1 flex flex-col">
        {/* =====================================================
            TOP BAR
        ===================================================== */}

        <header className="flex items-center justify-between px-10 py-5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            {/* Hamburger */}

            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
              aria-label="Open menu"
            >
              ☰
            </button>

            {/* Search */}

            <div className="relative">
              <input
                type="text"
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-80 px-4 py-2 rounded-lg border border-slate-200 bg-[#FAFBFD] text-sm focus:outline-none"
              />

              {searchQuery && (searchResults.length > 0 || searchLoading) && (
                <div className="absolute top-11 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {searchLoading && (
                    <p className="px-4 py-3 text-sm text-slate-400">
                      Searching...
                    </p>
                  )}

                  {!searchLoading && searchResults.length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-400">
                      No stocks found
                    </p>
                  )}

                  {!searchLoading &&
                    searchResults.map((stock) => (
                      <button
                        key={stock.symbol}
                        onClick={() => handleStockSelect(stock)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition"
                      >
                        <p className="font-semibold text-sm text-slate-900">
                          {stock.symbol.replace(".NS", "")}
                        </p>

                        <p className="text-xs text-slate-400">{stock.name}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side */}

          <div className="flex items-center gap-6">
            {/* Wallet */}

            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
                WALLET
              </p>

              <p className="text-sm font-bold text-slate-800">
                {portfolio
                  ? `₹${Number(portfolio.available_balance).toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                      },
                    )}`
                  : "Loading..."}
              </p>
            </div>

            {/* Notification */}

            <button className="w-9 h-9 rounded-full bg-[#FFF8E8] flex items-center justify-center text-lg">
              🔔
            </button>

            {/* Profile */}

            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-[#0F4C3A] hover:ring-2 hover:ring-emerald-200 transition"
              >
                {initials ? initials.toUpperCase() : "U"}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {/* User info */}

                  <div className="px-4 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
                        {initials ? initials.toUpperCase() : "U"}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {firstName === "there" ? "User" : firstName}
                        </p>

                        <p className="text-xs text-slate-400 truncate">
                          {profile?.email || ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Settings */}

                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FiSettings size={17} />
                    Settings
                  </button>

                  {/* Logout */}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <FiLogOut size={17} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* =====================================================
            DASHBOARD
        ===================================================== */}

        <main className="flex-1 px-10 py-7 space-y-5">
          {/* Greeting */}

          <div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              {today}
            </p>

            <h1 className="text-3xl font-serif font-semibold text-slate-900 mt-1">
              Hello, {firstName} 👋
            </h1>
          </div>

          {/* =====================================================
    SELECTED STOCK
    ===================================================== */}

          {selectedStock && (
            <div
              onClick={() => navigate(`/stock/${selectedStock.symbol}`)}
              className="bg-white rounded-xl border border-slate-200 p-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-6">
                {/* Stock Information */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900 cursor-pointer hover:text-slate-700 transition">
                      {selectedStock.symbol.replace(".NS", "")}
                    </h2>

                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      {displayExchange(
                        selectedStock.exchange,
                        selectedStock.symbol,
                      )}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 mt-1">
                    {selectedStock.company || "Company name unavailable"}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    {selectedStock.symbol}
                  </p>
                </div>

                {/* Current Price */}
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatINR(selectedStock.price)}
                  </p>

                  {selectedStock.change != null &&
                    selectedStock.changePercent != null && (
                      <p
                        className={`text-sm font-semibold mt-1 ${
                          Number(selectedStock.change) >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {Number(selectedStock.change) >= 0 ? "▲" : "▼"}{" "}
                        {Number(selectedStock.change) >= 0 ? "+" : "-"}₹
                        {Math.abs(Number(selectedStock.change)).toFixed(2)} (
                        {Math.abs(Number(selectedStock.changePercent)).toFixed(
                          2,
                        )}
                        %)
                        {" today"}
                      </p>
                    )}
                </div>
              </div>

              {/* Market Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 mt-5 pt-5 border-t border-slate-100">
                {/* Previous Close */}
                <div>
                  <p className="text-xs text-slate-400">Previous Close</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(selectedStock.previousClose)}
                  </p>
                </div>

                {/* Open */}
                <div>
                  <p className="text-xs text-slate-400">Open</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(selectedStock.open)}
                  </p>
                </div>

                {/* Day High */}
                <div>
                  <p className="text-xs text-slate-400">Day High</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(selectedStock.dayHigh)}
                  </p>
                </div>

                {/* Day Low */}
                <div>
                  <p className="text-xs text-slate-400">Day Low</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(selectedStock.dayLow)}
                  </p>
                </div>

                {/* Volume */}
                <div>
                  <p className="text-xs text-slate-400">Volume</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatVolume(selectedStock.volume)}
                  </p>
                </div>

                {/* Market Cap */}
                <div>
                  <p className="text-xs text-slate-400">Market Cap</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatMarketCap(selectedStock.marketCap)}
                  </p>
                </div>

                {/* Exchange */}
                <div>
                  <p className="text-xs text-slate-400">Exchange</p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {displayExchange(
                      selectedStock.exchange,
                      selectedStock.symbol,
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              STAT CARDS
          ===================================================== */}

          <div className="grid grid-cols-3 gap-5">
            {/* Portfolio */}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Total Portfolio Value
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {portfolio
                  ? `₹${Number(portfolio.total_value).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}`
                  : "Loading..."}
              </p>

              <p
                className={`text-xs font-semibold mt-1 ${
                  portfolio && portfolio.overall_pnl >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {portfolio
                  ? `${portfolio.overall_pnl >= 0 ? "▲ +" : "▼ -"}₹${Math.abs(
                      Number(portfolio.overall_pnl),
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })} overall`
                  : "Loading..."}
              </p>
            </div>

            {/* Today's P&L */}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Today's P&L
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {portfolio
                  ? `${portfolio.today_pnl >= 0 ? "+" : "-"}₹${Math.abs(
                      Number(portfolio.today_pnl),
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}`
                  : "Loading..."}
              </p>

              <p
                className={`text-xs font-semibold mt-1 ${
                  portfolio && portfolio.today_pnl >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {portfolio
                  ? `${portfolio.today_pnl >= 0 ? "▲ +" : "▼ "}${Math.abs(
                      Number(portfolio.today_pnl_percent),
                    ).toFixed(2)}% today`
                  : "Loading..."}
              </p>
            </div>

            {/* Market */}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Market Today
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {nifty?.price
                  ? `₹${Number(nifty.price).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}`
                  : "Loading..."}
              </p>

              <p
                className={`text-xs font-semibold mt-1 ${
                  nifty && nifty.changePercent >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {nifty
                  ? `${nifty.changePercent >= 0 ? "▲ +" : "▼ -"}${Math.abs(
                      nifty.changePercent,
                    ).toFixed(2)}% today`
                  : "Loading..."}
              </p>

              <p className="text-[11px] text-slate-400 mt-1">NIFTY 50</p>
            </div>
          </div>

          {/* =====================================================
              MARKET STOCKS
          ===================================================== */}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-serif font-semibold text-slate-900">
                  Market Stocks
                </h2>

                <p className="text-xs text-slate-400 mt-1">
                  Latest market prices
                </p>
              </div>
            </div>

            {!marketMovers ? (
              <p className="text-sm text-slate-400">Loading stocks...</p>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {/* =================================================
                    TOP GAINERS
                ================================================= */}

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Top Gainers
                  </h3>

                  <div className="space-y-2">
                    {marketMovers.gainers?.slice(0, 3).map((stock) => (
                      <div
                        key={stock.symbol}
                        className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold text-sm text-slate-900">
                              {stock.symbol.replace(".NS", "")}
                            </p>

                            <p className="text-[11px] text-slate-400">NSE</p>
                          </div>

                          <p className="text-base font-bold text-slate-900">
                            ₹
                            {Number(stock.price).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>

                        <span className="text-xs font-semibold text-emerald-600">
                          ▲ {stock.change_percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* =================================================
                    TOP LOSERS
                ================================================= */}

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Top Losers
                  </h3>

                  <div className="space-y-2">
                    {marketMovers.losers?.slice(0, 3).map((stock) => (
                      <div
                        key={stock.symbol}
                        className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold text-sm text-slate-900">
                              {stock.symbol.replace(".NS", "")}
                            </p>

                            <p className="text-[11px] text-slate-400">NSE</p>
                          </div>

                          <p className="text-base font-bold text-slate-900">
                            ₹
                            {Number(stock.price).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>

                        <span className="text-xs font-semibold text-red-600">
                          ▼ {Math.abs(stock.change_percent)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
