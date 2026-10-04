import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { getRecommendations } from "../../services/recommendationService";
import {
  getPortfolioSummary,
  buyStock,
} from "../../services/portfolioService";

type Recommendation = {
  symbol: string;
  stock_id: string;
  company_name: string;
  current_price: number;
  model_probability: number;
  volatility_20d: number;
  volatility_percentile: number;
  rank: number;
  risk_compatible: boolean;
  goal_context: string;
  horizon_context: string;
  suggested_allocation: number;
};

export default function AIPicks() {
  const navigate = useNavigate();
  const location = useLocation();

  // =====================================================
  // USER / UI STATE
  // =====================================================

  const [profile, setProfile] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<any>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // PAPER TRADE STATE
  // =====================================================

  const [tradeStock, setTradeStock] =
    useState<Recommendation | null>(null);

  const [tradeQuantity, setTradeQuantity] = useState(1);

  const [tradeMode, setTradeMode] = useState<
    "amount" | "quantity"
  >("amount");

  const [tradeAmount, setTradeAmount] = useState("");

  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");

  // =====================================================
  // AI RECOMMENDATION STATE
  // =====================================================

  const [recommendations, setRecommendations] = useState<
    Recommendation[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // LOAD USER + PROFILE + WALLET
  // =====================================================

  useEffect(() => {
    const loadUserData = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate("/login");
        return;
      }

      // -------------------------------------------------
      // PROFILE
      // -------------------------------------------------

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const googleName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "";

      const fullName =
        profileData?.full_name?.trim() ||
        googleName.trim() ||
        "";

      setProfile({
        full_name: fullName,
        email: user.email,
      });

      // -------------------------------------------------
      // WALLET
      // -------------------------------------------------

      try {
        const portfolioData = await getPortfolioSummary();
        setPortfolio(portfolioData);
      } catch (error) {
        console.error(
          "Portfolio summary failed:",
          error
        );
      }
    };

    loadUserData();
  }, [navigate]);

  // =====================================================
  // CLOSE PROFILE DROPDOWN
  // =====================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
  // LOAD AI RECOMMENDATIONS
  // =====================================================

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getRecommendations();

        setRecommendations(
          data.recommendations || []
        );
      } catch (error) {
        console.error(
          "RECOMMENDATIONS FAILED:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load recommendations"
        );
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, []);

  // =====================================================
  // USER INFO
  // =====================================================

  const fullName =
    profile?.full_name?.trim() || "";

  const nameParts = fullName.split(/\s+/);

  const firstName =
    nameParts[0] || "there";

  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${
          nameParts[nameParts.length - 1][0]
        }`
      : nameParts[0]?.slice(0, 2);

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

    if (item === "Settings") {
      navigate("/settings");
      return;
    }

    if (item === "Learn") {
      navigate("/learn");
      return;
    }

    // Portfolio and Watchlist are not connected yet.
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // =====================================================
  // PAPER TRADE
  // =====================================================

  const handleOpenTrade = (
    recommendation: Recommendation
  ) => {
    setTradeStock(recommendation);

    // Default values
    setTradeQuantity(1);

    // Open in amount mode
    setTradeMode("amount");

    // Prefill with AI suggested allocation
    setTradeAmount(
      recommendation.suggested_allocation.toString()
    );

    setTradeError("");
  };

  const handleCloseTrade = () => {
    if (tradeLoading) {
      return;
    }

    setTradeStock(null);
    setTradeQuantity(1);
    setTradeMode("amount");
    setTradeAmount("");
    setTradeError("");
  };

  const handleConfirmBuy = async () => {
    if (!tradeStock) {
      return;
    }

    let quantity: number;

    // ---------------------------------------------------
    // INVEST BY AMOUNT
    // ---------------------------------------------------

    if (tradeMode === "amount") {
      const amount = Number(tradeAmount);
      const price = Number(
        tradeStock.current_price
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        setTradeError(
          "Please enter a valid investment amount."
        );
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        setTradeError(
          "Stock price is not available."
        );
        return;
      }

      // Whole shares only.
      // Example:
      // ₹200 / ₹164.55 = 1.21
      // Therefore buy 1 share.
      quantity = Math.floor(
        amount / price
      );

      if (quantity < 1) {
        setTradeError(
          `Minimum amount required for 1 share is ₹${price.toLocaleString(
            "en-IN",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}.`
        );
        return;
      }
    } else {
      // -------------------------------------------------
      // BUY BY SHARES
      // -------------------------------------------------

      quantity = Math.floor(
        Number(tradeQuantity)
      );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        setTradeError(
          "Number of shares must be greater than 0."
        );
        return;
      }
    }

    try {
      setTradeLoading(true);
      setTradeError("");

      // Backend remains authoritative for execution.
      await buyStock(
        tradeStock.stock_id,
        quantity
      );

      // -------------------------------------------------
      // REFRESH WALLET
      // -------------------------------------------------

      const updatedPortfolio =
        await getPortfolioSummary();

      setPortfolio(updatedPortfolio);

      // -------------------------------------------------
      // REFRESH RECOMMENDATIONS
      // -------------------------------------------------

      try {
        const updatedRecommendations =
          await getRecommendations();

        setRecommendations(
          updatedRecommendations.recommendations || []
        );
      } catch (error) {
        console.error(
          "Recommendation refresh failed:",
          error
        );
      }

      // -------------------------------------------------
      // CLOSE MODAL
      // -------------------------------------------------

      setTradeStock(null);
      setTradeQuantity(1);
      setTradeMode("amount");
      setTradeAmount("");
      setTradeError("");
    } catch (error) {
      console.error(
        "Paper BUY failed:",
        error
      );

      setTradeError(
        error instanceof Error
          ? error.message
          : "Could not complete paper trade"
      );
    } finally {
      setTradeLoading(false);
    }
  };

  // =====================================================
  // FORMATTING
  // =====================================================

  const formatCurrency = (value: number) =>
    `₹${Number(value).toLocaleString("en-IN")}`;

  const formatPercent = (value: number) =>
    `${(value * 100).toFixed(2)}%`;

  const getRiskLabel = (
    percentile: number
  ) => {
    if (percentile <= 25) {
      return "Lower volatility";
    }

    if (percentile <= 50) {
      return "Moderate volatility";
    }

    if (percentile <= 75) {
      return "Higher volatility";
    }

    return "High volatility";
  };

  // =====================================================
  // PAPER TRADE PREVIEW
  // =====================================================

  const tradePrice = tradeStock
    ? Number(tradeStock.current_price)
    : 0;

  const enteredAmount = Number(tradeAmount);

  const calculatedQuantity =
    tradeMode === "amount"
      ? tradePrice > 0 &&
        Number.isFinite(enteredAmount) &&
        enteredAmount > 0
        ? Math.floor(
            enteredAmount / tradePrice
          )
        : 0
      : tradeQuantity;

  const estimatedTradeValue =
    tradePrice * calculatedQuantity;

  const remainingAmount =
    tradeMode === "amount" &&
    enteredAmount > 0 &&
    calculatedQuantity > 0
      ? Math.max(
          0,
          enteredAmount - estimatedTradeValue
        )
      : 0;

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] font-sans">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() =>
              setSidebarOpen(false)
            }
          />
        )}

        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-[#0B1B2E] flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >
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
              onClick={() =>
                setSidebarOpen(false)
              }
              className="text-slate-400 hover:text-white text-xl"
            >
              
            </button>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const active =
                item === "AI Picks" &&
                location.pathname === "/ai-picks";

              return (
                <button
                  key={item}
                  onClick={() =>
                    handleNavigation(item)
                  }
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
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

        <header className="flex items-center justify-between px-10 py-5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setSidebarOpen(true)
              }
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
            >
              ☰
            </button>
          </div>
        </header>

        <main className="px-10 py-7">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />

          <div className="mt-4 h-10 w-64 animate-pulse rounded bg-gray-200" />

          <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-gray-200" />

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[520px] animate-pulse rounded-3xl bg-white shadow-sm"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] font-sans">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() =>
              setSidebarOpen(false)
            }
          />
        )}

        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-[#0B1B2E] flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >
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
                item === "AI Picks" &&
                location.pathname === "/ai-picks";

              return (
                <button
                  key={item}
                  onClick={() =>
                    handleNavigation(item)
                  }
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
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

        <header className="flex items-center justify-between px-10 py-5 border-b border-slate-200 bg-white">
          <button
            onClick={() =>
              setSidebarOpen(true)
            }
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
          >
            ☰
          </button>
        </header>

        <main className="px-10 py-7">
          <p className="text-sm font-semibold text-[#10B981]">
            FinGrow Intelligence
          </p>

          <h1 className="mt-2 text-3xl font-bold text-[#0B3528]">
            AI Picks
          </h1>

          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold text-red-700">
              Could not load your AI picks.
            </p>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // =====================================================
  // MAIN PAGE
  // =====================================================

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-[#0B1B2E] flex flex-col z-50
        transform transition-transform duration-300 ease-in-out
        ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
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
            onClick={() =>
              setSidebarOpen(false)
            }
            className="text-slate-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active =
              (item === "Dashboard" &&
                location.pathname === "/dashboard") ||
              (item === "AI Picks" &&
                location.pathname === "/ai-picks");

            return (
              <button
                key={item}
                onClick={() =>
                  handleNavigation(item)
                }
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
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

      {/* =====================================================
    TOP BAR
===================================================== */}

<header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10">
  {/* Left */}

  <div className="flex items-center gap-4">
    {/* Menu */}

    <button
      onClick={() => setSidebarOpen(true)}
      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
      aria-label="Open menu"
    >
      ☰
    </button>

    {/* FinGrow */}

    <button
      onClick={() => navigate("/dashboard")}
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

  {/* Right */}

  <div className="flex items-center gap-4 md:gap-6">
    {/* Wallet */}

    <div className="text-right">
      <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
        WALLET
      </p>

      <p className="text-sm font-bold text-slate-800">
        {portfolio
          ? `₹${Number(
              portfolio.available_balance
            ).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}`
          : "Loading..."}
      </p>
    </div>

    {/* Notification */}

    <button
      type="button"
      className="w-9 h-9 rounded-full bg-[#FFF8E8] flex items-center justify-center text-lg"
      aria-label="Notifications"
    >
      🔔
    </button>

    {/* Profile */}

    <div
      ref={profileRef}
      className="relative"
    >
      <button
        onClick={() =>
          setProfileOpen(!profileOpen)
        }
        className="w-10 h-10 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A] hover:ring-2 hover:ring-emerald-200 transition"
        aria-label="Open profile menu"
      >
        {initials
          ? initials.toUpperCase()
          : "U"}
      </button>

      {profileOpen && (
        <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* User info */}

          <div className="px-4 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
                {initials
                  ? initials.toUpperCase()
                  : "U"}
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {firstName === "there"
                    ? "User"
                    : firstName}
                </p>

                <p className="text-xs text-slate-400 truncate">
                  {profile?.email || ""}
                </p>
              </div>
            </div>
          </div>

          {/* Settings */}

          <button
            onClick={() => {
              setProfileOpen(false);
              navigate("/settings");
            }}
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
          AI PICKS CONTENT
      ===================================================== */}

      <main className="flex-1 px-10 py-7">
        {/* Header */}

        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            Personalized recommendations
          </p>

          <h1 className="mt-1 text-3xl font-serif font-semibold text-slate-900">
            AI Picks
          </h1>

          <p className="mt-3 text-base leading-7 text-gray-600">
            Personalized stock signals based on market data and your
            investment profile.
          </p>
        </div>

        {/* How FinGrow generates these picks */}

        <div className="mt-8 rounded-3xl border border-[#DCE9E2] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F7EF] text-[#0F4C3A]">
              ✦
            </div>

            <div>
              <h2 className="font-semibold text-[#0B3528]">
                How FinGrow generates these picks
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                FinGrow analyzes recent market data, ranks stocks using
                machine learning, and matches the results with your risk
                profile to create personalized paper-trading picks.
              </p>
            </div>
          </div>
        </div>

        {/* Recommendation cards */}

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((recommendation) => {
            const volatilityLabel =
              getRiskLabel(
                recommendation.volatility_percentile
              );

            return (
              <div
                key={recommendation.symbol}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[#DCE9E2] bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Card content */}

                <div className="p-6">
                  {/* Rank + risk */}

                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#E8F7EF] px-3 py-1.5 text-xs font-semibold text-[#0F4C3A]">
                      AI Rank #{recommendation.rank}
                    </span>

                    {recommendation.risk_compatible && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[#10B981]">
                        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                        Risk compatible
                      </span>
                    )}
                  </div>

                  {/* Stock name */}

                  <div className="mt-7">
                    <h2 className="text-2xl font-bold tracking-tight text-[#0B3528]">
                      {recommendation.symbol.replace(
                        ".NS",
                        ""
                      )}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {recommendation.company_name}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      NSE
                    </p>
                  </div>

                  {/* ML Signal */}

                  <div className="mt-7 rounded-2xl bg-[#F1F8F4] p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        ML Signal
                      </p>

                      <span className="text-xs font-medium text-[#0F4C3A]">
                        ~20D outlook
                      </span>
                    </div>

                    <p className="mt-2 text-4xl font-bold tracking-tight text-[#0F4C3A]">
                      {formatPercent(
                        recommendation.model_probability
                      )}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      AI-based market signal for the next ~20 trading
                      days.
                    </p>
                  </div>

                  {/* Risk metrics */}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">
                        20D volatility
                      </p>

                      <p className="mt-1 text-lg font-bold text-[#0B3528]">
                        {(
                          recommendation.volatility_20d * 100
                        ).toFixed(2)}
                        %
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">
                        Volatility
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#0B3528]">
                        {volatilityLabel}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {recommendation.volatility_percentile.toFixed(
                          1
                        )}
                        th percentile
                      </p>
                    </div>
                  </div>

                  {/* Suggested allocation */}

                  <div className="mt-5 rounded-2xl border border-[#DCE9E2] p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Suggested paper allocation
                    </p>

                    <p className="mt-1 text-2xl font-bold text-[#0B3528]">
                      {formatCurrency(
                        recommendation.suggested_allocation
                      )}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Suggested amount from your virtual balance
                    </p>
                  </div>

                  {/* Why this pick */}

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-[#0B3528]">
                      Why this pick?
                    </p>

                    <p className="mt-2 text-xs leading-5 text-gray-600">
                      Ranked highly by the ML model and compatible with
                      your selected risk profile.
                    </p>
                  </div>
                </div>

                {/* Card action */}

                <div className="mt-auto border-t border-gray-100 bg-gray-50/70 p-5">
                  <button
                    onClick={() =>
                      handleOpenTrade(
                        recommendation
                      )
                    }
                    className="w-full rounded-xl bg-[#0F4C3A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B3528]"
                  >
                    Paper Trade
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}

        {recommendations.length === 0 && (
          <div className="mt-8 rounded-3xl border border-[#DCE9E2] bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-[#0B3528]">
              No compatible AI picks found
            </p>

            <p className="mt-2 text-sm text-gray-500">
              No stocks currently passed the configured risk
              compatibility rules.
            </p>
          </div>
        )}

        {/* Disclaimer */}

        <div className="mt-8 pb-8 text-center">
          <p className="text-xs leading-5 text-gray-400">
            AI Picks are machine-learning market signals for
            FinGrow&apos;s paper-trading environment. They are not
            guaranteed returns or financial advice.
          </p>
        </div>

        {/* =====================================================
            PAPER TRADE MODAL
        ===================================================== */}

        {tradeStock && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              {/* Header */}

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Paper Trade
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-[#0B3528]">
                    {tradeStock.symbol.replace(
                      ".NS",
                      ""
                    )}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {tradeStock.company_name}
                  </p>
                </div>

                <button
                  onClick={handleCloseTrade}
                  disabled={tradeLoading}
                  className="text-xl text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              {/* Current price */}

              <div className="mt-6 rounded-2xl bg-[#F1F8F4] p-5">
                <p className="text-xs text-gray-500">
                  Current price
                </p>

                <p className="mt-1 text-2xl font-bold text-[#0F4C3A]">
                  ₹
                  {tradePrice.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {/* Trade Mode */}

<div className="mt-5">
  <p className="text-sm font-semibold text-[#0B3528]">
    Buy by
  </p>

  <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
    {/* Invest by ₹ */}

    <button
      type="button"
      onClick={() => {
        if (tradeMode === "quantity") {
          const quantity = Math.max(
            1,
            Math.floor(Number(tradeQuantity) || 1)
          );

          const price = Number(
            tradeStock?.current_price || 0
          );

          if (price > 0) {
            setTradeAmount(
              (quantity * price).toFixed(2)
            );
          }
        }

        setTradeMode("amount");
        setTradeError("");
      }}
      disabled={tradeLoading}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        tradeMode === "amount"
          ? "bg-white text-[#0F4C3A] shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      Invest by ₹
    </button>

    {/* Buy by shares */}

    <button
      type="button"
      onClick={() => {
        if (tradeMode === "amount") {
          const amount = Number(tradeAmount);
          const price = Number(
            tradeStock?.current_price || 0
          );

          if (
            Number.isFinite(amount) &&
            amount > 0 &&
            price > 0
          ) {
            const quantity = Math.floor(
              amount / price
            );

            if (quantity >= 1) {
              setTradeQuantity(quantity);
            } else {
              setTradeQuantity(1);
            }
          }
        }

        setTradeMode("quantity");
        setTradeError("");
      }}
      disabled={tradeLoading}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        tradeMode === "quantity"
          ? "bg-white text-[#0F4C3A] shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      Buy by shares
    </button>
  </div>
</div>

              {/* Input */}

              <div className="mt-5">
                <label
                  htmlFor="trade-input"
                  className="text-sm font-semibold text-[#0B3528]"
                >
                  {tradeMode === "amount"
                    ? "How much do you want to invest?"
                    : "How many shares do you want to buy?"}
                </label>

                {tradeMode === "amount" ? (
                  <div className="mt-2 flex items-center rounded-xl border border-gray-200 px-4 focus-within:border-[#0F4C3A]">
                    <span className="text-sm font-semibold text-gray-500">
                      ₹
                    </span>

                    <input
                      id="trade-input"
                      type="number"
                      min="1"
                      step="1"
                      value={tradeAmount}
                      onChange={(e) => {
                        setTradeAmount(
                          e.target.value
                        );

                        setTradeError("");
                      }}
                      disabled={tradeLoading}
                      placeholder="Enter amount in ₹"
                      className="w-full border-0 px-2 py-3 text-sm focus:outline-none"
                    />
                  </div>
                ) : (
                  <input
                    id="trade-input"
                    type="number"
                    min="1"
                    step="1"
                    value={tradeQuantity}
                    onChange={(e) => {
                      const value = Math.floor(
                        Number(e.target.value) || 1
                      );

                      setTradeQuantity(
                        Math.max(1, value)
                      );

                      setTradeError("");
                    }}
                    disabled={tradeLoading}
                    placeholder="Enter number of shares"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#0F4C3A] focus:outline-none disabled:bg-gray-100"
                  />
                )}
              </div>

              {/* Review */}

              <div className="mt-5 rounded-2xl border border-gray-100 p-5">
                {/* Amount mode */}

                {tradeMode === "amount" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Your budget
                    </span>

                    <span className="font-semibold text-[#0B3528]">
                      ₹
                      {Number.isFinite(enteredAmount)
                        ? enteredAmount.toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )
                        : "0.00"}
                    </span>
                  </div>
                )}

                {/* Shares */}

                <div
                  className={`flex justify-between text-sm ${
                    tradeMode === "amount"
                      ? "mt-3"
                      : ""
                  }`}
                >
                  <span className="text-gray-500">
                    Shares to buy
                  </span>

                  <span className="font-semibold text-[#0B3528]">
                    {calculatedQuantity}
                  </span>
                </div>

                {/* Actual investment */}

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-500">
                    Amount actually invested
                  </span>

                  <span className="font-semibold text-[#0B3528]">
                    ₹
                    {estimatedTradeValue.toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </span>
                </div>

                {/* Unused amount only applies to amount mode */}

                {tradeMode === "amount" &&
                  calculatedQuantity > 0 && (
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-gray-500">
                        Unused amount
                      </span>

                      <span className="font-semibold text-gray-500">
                        ₹
                        {remainingAmount.toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </span>
                    </div>
                  )}
              </div>

              {/* Error */}

              {tradeError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">
                    {tradeError}
                  </p>
                </div>
              )}

              {/* Actions */}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCloseTrade}
                  disabled={tradeLoading}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmBuy}
                  disabled={
                    tradeLoading ||
                    calculatedQuantity < 1
                  }
                  className="flex-1 rounded-xl bg-[#0F4C3A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3528] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tradeLoading
                    ? "Processing..."
                    : calculatedQuantity >= 1
                      ? `Confirm Buy — ₹${estimatedTradeValue.toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}`
                      : "Confirm Buy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}