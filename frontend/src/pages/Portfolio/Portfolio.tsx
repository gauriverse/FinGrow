import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import {
  getPortfolioSummary,
  sellStock,
} from "../../services/portfolioService";

type Holding = {
  stock_id: string;
  symbol: string;
  quantity: number;
  buy_price: number;
  current_price: number;
  invested_value: number;
  current_value: number;
  pnl: number;
};

type PortfolioSummary = {
  available_balance: number;
  invested_value: number;
  current_value: number;
  total_value: number;
  overall_pnl: number;
  today_pnl: number;
  today_pnl_percent: number;
  holdings: Holding[];
};

type Profile = {
  full_name: string | null;
  email: string | null;
};

export default function Portfolio() {
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] =
    useState<PortfolioSummary | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sellStockData, setSellStockData] =
    useState<Holding | null>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");

  // =====================================================
  // LOAD USER + PROFILE + PORTFOLIO
  // =====================================================

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile({
        full_name:
          profileData?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          null,
        email: user.email || null,
      });

      const portfolioData = await getPortfolioSummary();

      setPortfolio({
        available_balance: Number(
          portfolioData.available_balance || 0
        ),
        invested_value: Number(
          portfolioData.invested_value || 0
        ),
        current_value: Number(
          portfolioData.current_value || 0
        ),
        total_value: Number(
          portfolioData.total_value || 0
        ),
        overall_pnl: Number(
          portfolioData.overall_pnl || 0
        ),
        today_pnl: Number(
          portfolioData.today_pnl || 0
        ),
        today_pnl_percent: Number(
          portfolioData.today_pnl_percent || 0
        ),
        holdings: Array.isArray(portfolioData.holdings)
          ? portfolioData.holdings
          : [],
      });
    } catch (error) {
      console.error(
        "Portfolio loading failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load portfolio"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, [navigate]);

  // =====================================================
  // CLOSE PROFILE DROPDOWN
  // =====================================================

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target as Node
        )
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // =====================================================
  // USER INFO
  // =====================================================

  const fullName =
    profile?.full_name?.trim() || "";

  const nameParts = fullName.split(/\s+/);

  const firstName =
    nameParts[0] || "User";

  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : nameParts[0]?.slice(0, 2) || "U";

  // =====================================================
  // NAVIGATION
  // =====================================================

  const navItems = [
    "Dashboard",
    "AI Picks",
    "Portfolio",
    "Watchlist",
    "Learn",
    "Settings",
  ];

  const handleNavigation = (item: string) => {
    setSidebarOpen(false);

    if (item === "Dashboard") {
      navigate("/dashboard");
      return;
    }

    if (item === "AI Picks") {
      navigate("/ai-picks");
      return;
    }

    if (item === "Portfolio") {
      navigate("/portfolio");
      return;
    }

    if (item === "Settings") {
      navigate("/settings");
      return;
    }

    if (item === "Learn") {
      navigate("/learn");
      return;
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // =====================================================
  // SELL
  // =====================================================

  const handleOpenSell = (holding: Holding) => {
    setSellStockData(holding);
    setSellQuantity(1);
    setSellError("");
  };

  const handleCloseSell = () => {
    if (sellLoading) {
      return;
    }

    setSellStockData(null);
    setSellQuantity(1);
    setSellError("");
  };

  const handleConfirmSell = async () => {
    if (!sellStockData) {
      return;
    }

    const quantity = Math.floor(
      Number(sellQuantity)
    );

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setSellError(
        "Quantity must be greater than 0."
      );
      return;
    }

    if (
      quantity > sellStockData.quantity
    ) {
      setSellError(
        `You only own ${sellStockData.quantity} share${
          sellStockData.quantity === 1
            ? ""
            : "s"
        }.`
      );
      return;
    }

    try {
      setSellLoading(true);
      setSellError("");

      // Backend remains authoritative.
      await sellStock(
        sellStockData.stock_id,
        quantity
      );

      await loadPortfolio();

      setSellStockData(null);
      setSellQuantity(1);
      setSellError("");
    } catch (error) {
      console.error(
        "Paper SELL failed:",
        error
      );

      setSellError(
        error instanceof Error
          ? error.message
          : "Could not complete paper sell"
      );
    } finally {
      setSellLoading(false);
    }
  };

  // =====================================================
  // FORMATTING
  // =====================================================

  const formatCurrency = (value: number) =>
    `₹${Number(value).toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  const formatPnl = (value: number) => {
    const amount = Number(value || 0);

    if (amount > 0) {
      return `+${formatCurrency(amount)}`;
    }

    return formatCurrency(amount);
  };

  const formatPercentage = (value: number) =>
    `${Number(value || 0).toFixed(2)}%`;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">

          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="relative w-72 bg-[#0B1B2E] text-white flex flex-col shadow-xl">

            <div className="flex items-center justify-between px-6 py-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
                  F
                </div>

                <span className="font-bold text-lg font-serif tracking-tight">
                  FinGrow
                </span>
              </div>

              <button
                onClick={() =>
                  setSidebarOpen(false)
                }
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 px-3 space-y-1">
              {navItems.map((item) => {
                const active =
                  item === "Portfolio" &&
                  location.pathname ===
                    "/portfolio";

                return (
                  <button
                    key={item}
                    onClick={() =>
                      handleNavigation(item)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        active
                          ? "bg-white"
                          : "bg-slate-500"
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
        </div>
      )}

      {/* =================================================
          TOP BAR
      ================================================= */}

      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10">

        <div className="flex items-center gap-4">

          <button
            onClick={() =>
              setSidebarOpen(true)
            }
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
            aria-label="Open menu"
          >
            ☰
          </button>

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
              F
            </div>

            <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
              FinGrow
            </span>
          </button>

        </div>

        <div className="flex items-center gap-4 md:gap-6">

          {/* WALLET */}

          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
              WALLET
            </p>

            <p className="text-sm font-bold text-slate-800">
              {portfolio
                ? formatCurrency(
                    portfolio.available_balance
                  )
                : "Loading..."}
            </p>
          </div>

          {/* NOTIFICATION */}

          <button className="w-9 h-9 rounded-full bg-[#FFF8E8] flex items-center justify-center text-lg">
            🔔
          </button>

          {/* PROFILE */}

          <div
            ref={profileRef}
            className="relative"
          >
            <button
              onClick={() =>
                setProfileOpen(
                  !profileOpen
                )
              }
              className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-[#0F4C3A] hover:ring-2 hover:ring-emerald-200 transition"
            >
              {initials.toUpperCase()}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">

                <div className="px-4 py-4 border-b border-slate-100">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
                      {initials.toUpperCase()}
                    </div>

                    <div className="min-w-0">

                      <p className="font-semibold text-slate-900 truncate">
                        {firstName}
                      </p>

                      <p className="text-xs text-slate-400 truncate">
                        {profile?.email || ""}
                      </p>

                    </div>

                  </div>

                </div>

                <button
                  onClick={() =>
                    navigate("/settings")
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FiSettings />
                  Settings
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                >
                  <FiLogOut />
                  Logout
                </button>

              </div>
            )}
          </div>

        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="px-6 md:px-10 py-8 max-w-7xl mx-auto">

        <div className="mb-8">

          <p className="text-sm font-semibold text-[#10B981]">
            Your investments
          </p>

          <h1 className="mt-2 text-3xl font-bold text-[#0B3528]">
            Portfolio
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Track your paper investments and
            manage your virtual portfolio.
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* LOADING */}

        {loading ? (
          <div className="space-y-5">

            <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />

            <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />

            <div className="h-72 rounded-2xl bg-white border border-slate-200 animate-pulse" />

          </div>
        ) : portfolio ? (
          <>
            {/* =================================================
                SUMMARY CARDS
            ================================================= */}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Total Value
                </p>

                <p className="mt-2 text-2xl font-bold text-[#0B3528]">
                  {formatCurrency(
                    portfolio.total_value
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Cash + current holdings
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Invested Value
                </p>

                <p className="mt-2 text-2xl font-bold text-[#0B3528]">
                  {formatCurrency(
                    portfolio.invested_value
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Amount used to buy holdings
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Overall P&L
                </p>

                <p
                  className={`mt-2 text-2xl font-bold ${
                    portfolio.overall_pnl >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {formatPnl(
                    portfolio.overall_pnl
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Unrealized portfolio P&L
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Today's P&L
                </p>

                <p
                  className={`mt-2 text-2xl font-bold ${
                    portfolio.today_pnl >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {formatPnl(
                    portfolio.today_pnl
                  )}
                </p>

                <p
                  className={`mt-2 text-xs font-medium ${
                    portfolio.today_pnl_percent >=
                    0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {formatPercentage(
                    portfolio.today_pnl_percent
                  )}
                </p>
              </div>

            </div>

            {/* =================================================
                AVAILABLE CASH
            ================================================= */}

            <div className="mt-6 rounded-2xl bg-[#0B3528] text-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>
                <p className="text-sm text-emerald-100">
                  Available virtual cash
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {formatCurrency(
                    portfolio.available_balance
                  )}
                </p>
              </div>

              <button
                onClick={() =>
                  navigate("/ai-picks")
                }
                className="px-5 py-2.5 rounded-lg bg-[#A3E635] text-[#0B3528] font-semibold text-sm hover:opacity-90 transition"
              >
                Explore AI Picks
              </button>

            </div>

            {/* =================================================
                HOLDINGS
            ================================================= */}

            <section className="mt-8">

              <div className="flex items-center justify-between mb-4">

                <div>
                  <h2 className="text-xl font-bold text-[#0B3528]">
                    Your Holdings
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Stocks currently held in your
                    paper portfolio.
                  </p>
                </div>

                <span className="text-sm text-slate-400">
                  {portfolio.holdings.length}{" "}
                  {portfolio.holdings.length === 1
                    ? "stock"
                    : "stocks"}
                </span>

              </div>

              {portfolio.holdings.length ===
              0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">

                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-2xl">
                    📊
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-800">
                    No holdings yet
                  </h3>

                  <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                    Your purchased stocks will
                    appear here. Start by exploring
                    FinGrow's AI Picks.
                  </p>

                  <button
                    onClick={() =>
                      navigate("/ai-picks")
                    }
                    className="mt-5 px-5 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-sm font-semibold hover:bg-[#0B3528] transition"
                  >
                    View AI Picks
                  </button>

                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[850px]">

                      <thead className="bg-slate-50 border-b border-slate-200">

                        <tr>

                          <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Stock
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Quantity
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Avg. Buy
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Current
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Invested
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Current Value
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            P&L
                          </th>

                          <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Action
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {portfolio.holdings.map(
                          (holding) => (
                            <tr
                              key={
                                holding.stock_id
                              }
                              className="hover:bg-slate-50/70 transition"
                            >

                              <td className="px-6 py-5">

                                <p className="font-bold text-slate-900">
                                  {holding.symbol.replace(
                                    ".NS",
                                    ""
                                  )}
                                </p>

                                <p className="text-xs text-slate-400 mt-1">
                                  NSE
                                </p>

                              </td>

                              <td className="px-6 py-5 text-right text-sm font-semibold text-slate-700">
                                {holding.quantity}
                              </td>

                              <td className="px-6 py-5 text-right text-sm text-slate-600">
                                {formatCurrency(
                                  holding.buy_price
                                )}
                              </td>

                              <td className="px-6 py-5 text-right text-sm text-slate-700 font-medium">
                                {formatCurrency(
                                  holding.current_price
                                )}
                              </td>

                              <td className="px-6 py-5 text-right text-sm text-slate-600">
                                {formatCurrency(
                                  holding.invested_value
                                )}
                              </td>

                              <td className="px-6 py-5 text-right text-sm font-semibold text-slate-800">
                                {formatCurrency(
                                  holding.current_value
                                )}
                              </td>

                              <td
                                className={`px-6 py-5 text-right text-sm font-bold ${
                                  holding.pnl >=
                                  0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatPnl(
                                  holding.pnl
                                )}
                              </td>

                              <td className="px-6 py-5 text-right">

                                <button
                                  onClick={() =>
                                    handleOpenSell(
                                      holding
                                    )
                                  }
                                  className="px-4 py-2 rounded-lg bg-red-50 text-red-600 border border-red-100 text-sm font-semibold hover:bg-red-100 transition"
                                >
                                  Sell
                                </button>

                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>
              )}

            </section>
          </>
        ) : null}

      </main>

      {/* =================================================
          SELL MODAL
      ================================================= */}

      {sellStockData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">

          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleCloseSell}
          />

          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                  Paper Trade
                </p>

                <h2 className="mt-1 text-2xl font-bold text-[#0B3528]">
                  Sell{" "}
                  {sellStockData.symbol.replace(
                    ".NS",
                    ""
                  )}
                </h2>
              </div>

              <button
                onClick={handleCloseSell}
                disabled={sellLoading}
                className="text-slate-400 hover:text-slate-700 text-xl disabled:opacity-50"
              >
                ✕
              </button>

            </div>

            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Current price
                </span>

                <span className="font-semibold text-slate-800">
                  {formatCurrency(
                    sellStockData.current_price
                  )}
                </span>
              </div>

              <div className="flex justify-between text-sm mt-3">
                <span className="text-slate-500">
                  Shares owned
                </span>

                <span className="font-semibold text-slate-800">
                  {sellStockData.quantity}
                </span>
              </div>

            </div>

            <div className="mt-6">

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Shares to sell
              </label>

              <input
                type="number"
                min={1}
                max={sellStockData.quantity}
                step={1}
                value={sellQuantity}
                onChange={(event) =>
                  setSellQuantity(
                    Number(event.target.value)
                  )
                }
                disabled={sellLoading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />

            </div>

            <div className="mt-5 rounded-xl border border-slate-200 p-4">

              <div className="flex justify-between text-sm">

                <span className="text-slate-500">
                  Estimated proceeds
                </span>

                <span className="font-bold text-slate-900">
                  {formatCurrency(
                    sellStockData.current_price *
                      Math.max(
                        0,
                        Math.floor(
                          Number(
                            sellQuantity
                          ) || 0
                        )
                      )
                  )}
                </span>

              </div>

            </div>

            {sellError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {sellError}
              </div>
            )}

            <button
              onClick={handleConfirmSell}
              disabled={sellLoading}
              className="mt-6 w-full py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sellLoading
                ? "Selling..."
                : `Confirm Sell — ${formatCurrency(
                    sellStockData.current_price *
                      Math.max(
                        0,
                        Math.floor(
                          Number(
                            sellQuantity
                          ) || 0
                        )
                      )
                  )}`}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}