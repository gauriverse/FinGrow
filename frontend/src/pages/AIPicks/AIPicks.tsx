import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useNavigate } from
"react-router-dom";

import { supabase } from "../../lib/supabase";
import {
  getRecommendations,
  getStockExplanation,
  getRankingInsights,
} from "../../services/recommendationService";
import {
  getPortfolioSummary,
  buyStock,
} from "../../services/portfolioService";
import Sidebar from "../../components/Sidebar";
import HeaderActions from "../../components/HeaderActions";

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
type RankingCandidate = {
  symbol: string;
  company_name: string;
  current_price: number;
  model_probability: number;
  volatility_20d: number;
  volatility_percentile: number;
  rank: number;
  risk_compatible: boolean;
  fuzzy_risk_score?: number | null;
  fuzzy_risk_category?: string;
};

type FeatureContribution = {
  feature_name: string;
  feature_value: number;
  shap_value: number;
  direction: "positive" | "negative" | "neutral";
};

type StockExplanation = {
  symbol: string;
  predicted_class: number;
  predicted_probability: number;
  baseline_probability: number;
  contributions: FeatureContribution[];
  top_positive_features: FeatureContribution[];
  top_negative_features: FeatureContribution[];
  explanation_method: string;
  warning: string | null;
};

const formatFeatureName = (name: string) => {
  const featureNames: Record<string, string> = {
  SMA_Ratio_20: "Price vs. 20-day average",
  SMA_Ratio_50: "Price vs. 50-day average",
  Return_1D: "Price change (1 day)",
  Return_5D: "Price change (5 days)",
  Return_20D: "Price change (20 days)",
  Volatility_5D: "Price fluctuations (5 days)",
  Volatility_20D: "Price fluctuations (20 days)",
  Volume_Ratio_20: "Trading activity vs. usual",
  High_Low_Range: "Today's highest-to-lowest price range",
  Close_Open_Range: "Today's opening-to-closing price change",
};

  const cleanName = name
    .replace(/&#x[0-9a-f]+;/gi, "")
    .replace(/&amp;/gi, "&")
    .trim();

  console.log("XAI feature name:", {
    original: name,
    cleanName,
    formatted: featureNames[cleanName] ?? featureNames[name] ?? cleanName.replace(/_/g, " "),
  });

  return featureNames[cleanName] ?? featureNames[name] ?? cleanName.replace(/_/g, " ");
};

// =====================================================
// PRESENTATION HELPERS (UI only)
// =====================================================

// Lightweight keyframes. All of them are switched off for users who
// prefer reduced motion.
const MOTION_CSS = `
@keyframes fg-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes fg-pop-in { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes fg-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.fg-fade-in { animation: fg-fade-in .15s ease-out both }
.fg-pop-in { animation: fg-pop-in .18s ease-out both }
.fg-rise { animation: fg-rise .25s ease-out both }
@media (prefers-reduced-motion: reduce) {
  .fg-fade-in, .fg-pop-in, .fg-rise { animation: none }
}
`;

const getRiskDot = (percentile: number) => {
  if (percentile <= 25) return "bg-emerald-500";
  if (percentile <= 50) return "bg-amber-400";
  if (percentile <= 75) return "bg-amber-500";
  return "bg-red-500";
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none ${className}`}
    />
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label={text}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-400 transition-colors hover:border-[#0F4C3A] hover:text-[#0F4C3A] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 motion-reduce:transition-none"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 w-48 rounded-md bg-[#0B1B2E] px-2.5 py-1.5 text-[11px] font-normal normal-case leading-4 tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
      >
        {text}
      </span>
    </span>
  );
}

type ChromeProps = {
  children: ReactNode;

  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;

  onLogoClick: () => void;
  portfolio: any;
  profileRef: RefObject<HTMLDivElement | null>;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  initials: string | undefined;
  firstName: string;
  email: string;
};

// Sidebar + top bar shared by the loading, error and main views.
function PageChrome({
  children,


  sidebarOpen,
  onSidebarOpenChange,

  onLogoClick,
  portfolio,

}: ChromeProps) {


  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      <style>{MOTION_CSS}</style>

      {/* Sidebar */}

      <Sidebar
        open={sidebarOpen}
        onClose={() => onSidebarOpenChange(false)}
      />

      {/* Top bar */}

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSidebarOpenChange(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-700 transition hover:bg-slate-100 active:scale-95 motion-reduce:transform-none"
            aria-label="Open menu"
          >
            ☰
          </button>

          <button
            onClick={onLogoClick}
            className="flex items-center gap-2"
            aria-label="Go to dashboard"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#0F4C3A] font-serif text-base font-bold text-white">
              F
            </div>

            <span className="font-serif text-lg font-bold tracking-tight text-[#0F4C3A]">
              FinGrow
            </span>
          </button>
        </div>

        <HeaderActions
          balance={portfolio ? portfolio.available_balance : null}
        />
      </header>

      {children}
    </div>
  );
}

export default function AIPicks() {
  const navigate = useNavigate();


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
  const [tradeSuccess, setTradeSuccess] = useState("");

  // =====================================================
  // AI RECOMMENDATION STATE
  // =====================================================

  const [recommendations, setRecommendations] = useState<
    Recommendation[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const [explanations, setExplanations] = useState<
    Record<string, StockExplanation>
  >({});
  const [expandedExplanation, setExpandedExplanation] = useState<
    Record<string, boolean>
  >({});
  const [explanationLoading, setExplanationLoading] = useState<
    Record<string, boolean>
  >({});

  const [explanationErrors, setExplanationErrors] = useState<
    Record<string, string>
  >({});
  const [activeTab, setActiveTab] = useState<"picks" | "ranking">("picks");

  const [rankingCandidates, setRankingCandidates] =
    useState<RankingCandidate[]>([]);

  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState("");


  const handleLoadExplanation = async (symbol: string) => {
    // If the explanation is already cached, simply toggle its visibility.
    if (explanations[symbol]) {
      setExpandedExplanation((previous) => ({
        ...previous,
        [symbol]: !previous[symbol],
      }));
      return;
    }

    // Prevent duplicate requests for the same stock.
    if (explanationLoading[symbol]) {
      return;
    }

    setExpandedExplanation((previous) => ({
      ...previous,
      [symbol]: true,
    }));
    setExplanationLoading((previous) => ({
      ...previous,
      [symbol]: true,
    }));
    setExplanationErrors((previous) => ({
      ...previous,
      [symbol]: "",
    }));

    try {
      const data = (await getStockExplanation(symbol)) as StockExplanation;

      setExplanations((previous) => ({
        ...previous,
        [symbol]: data,
      }));
    } catch (requestError) {
      setExplanationErrors((previous) => ({
        ...previous,
        [symbol]:
          requestError instanceof Error
            ? requestError.message
            : "Failed to load the stock explanation. Please try again.",
      }));
    } finally {
      setExplanationLoading((previous) => ({
        ...previous,
        [symbol]: false,
      }));
    }
  };


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
  const handleOpenRanking = async () => {
  setActiveTab("ranking");

  if (rankingCandidates.length > 0) {
    return;
  }

  setRankingLoading(true);
  setRankingError("");

  try {
    const data = await getRankingInsights();
    setRankingCandidates(data.ranking ?? []);
  } catch (error) {
    setRankingError(
      error instanceof Error
        ? error.message
        : "Failed to load ranking insights",
    );
  } finally {
    setRankingLoading(false);
  }
};

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
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]
      }`
      : nameParts[0]?.slice(0, 2);

  // =====================================================
  // NAVIGATION
  // =====================================================



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
    setTradeSuccess("");

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

  // UI only: allow Esc to dismiss the trade dialog (same reset as Cancel).
  useEffect(() => {
    if (!tradeStock) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !tradeLoading) {
        setTradeStock(null);
        setTradeQuantity(1);
        setTradeMode("amount");
        setTradeAmount("");
        setTradeError("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tradeStock, tradeLoading]);

  const handleConfirmBuy = async () => {
    if (!tradeStock || tradeLoading) {
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

    const stock = tradeStock;

    setTradeLoading(true);
    setTradeError("");
    setTradeSuccess("");

    // The backend is authoritative for executing the paper trade.
    try {
      await buyStock(stock.stock_id, quantity);
    } catch (error) {
      console.error("Paper BUY failed:", error);
      setTradeError(
        error instanceof Error
          ? error.message
          : "Could not complete paper trade"
      );
      setTradeLoading(false);
      return;
    }

    // The buy request succeeded. Do not treat later refresh failures
    // as a failed purchase, because the transaction has already run.
    setTradeLoading(false);
    setTradeStock(null);
    setTradeQuantity(1);
    setTradeMode("amount");
    setTradeAmount("");
    setTradeError("");
    setTradeSuccess(
      `${stock.symbol.replace(".NS", "")} bought successfully in paper trading.`
    );

    // Refresh the wallet independently. If this fails, preserve the
    // success confirmation and explain that displayed data may be stale.
    void getPortfolioSummary()
      .then((updatedPortfolio) => {
        setPortfolio(updatedPortfolio);
      })
      .catch((refreshError) => {
        console.error("Portfolio refresh failed after successful buy:", refreshError);
        setTradeSuccess(
          `${stock.symbol.replace(".NS", "")} was bought successfully, but the portfolio could not refresh. Open Portfolio or reload to see the latest holdings.`
        );
      });

    // Recommendation refresh is also independent of trade execution.
    void getRecommendations()
      .then((updatedRecommendations) => {
        setRecommendations(updatedRecommendations.recommendations || []);
      })
      .catch((refreshError) => {
        console.error("Recommendation refresh failed:", refreshError);
      });
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
  // SHARED PAGE CHROME (sidebar + top bar)
  // =====================================================

  const chromeProps = {


    sidebarOpen,
    onSidebarOpenChange: setSidebarOpen,

    onLogoClick: () => navigate("/dashboard"),
    portfolio,
    profileRef,
    profileOpen,
    onToggleProfile: () => setProfileOpen(!profileOpen),
    onOpenSettings: () => {
      setProfileOpen(false);
      navigate("/settings");
    },
    onLogout: handleLogout,
    initials,
    firstName,
    email: profile?.email || "",
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <PageChrome {...chromeProps}>
        <main
          className="px-4 py-4 md:px-6"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="mt-2 h-7 w-40 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />

          <div className="mt-4 h-12 animate-pulse rounded-xl bg-white shadow-sm motion-reduce:animate-none" />

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-[#DCE9E2] bg-white p-4 shadow-sm motion-reduce:animate-none"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-20 rounded-full bg-gray-200" />
                  <div className="h-4 w-24 rounded bg-gray-200" />
                </div>
                <div className="mt-4 h-6 w-28 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-40 rounded bg-gray-100" />
                <div className="mt-4 h-20 rounded-xl bg-gray-100" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-14 rounded-lg bg-gray-100" />
                  <div className="h-14 rounded-lg bg-gray-100" />
                </div>
                <div className="mt-3 h-10 rounded-lg bg-gray-100" />
                <div className="mt-4 h-10 rounded-xl bg-gray-200" />
              </div>
            ))}
          </div>
        </main>
      </PageChrome>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <PageChrome {...chromeProps}>
        <main className="px-4 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
            FinGrow Intelligence
          </p>

          <h1 className="mt-1 font-serif text-2xl font-semibold text-slate-900">
            AI Picks
          </h1>

          <div
            role="alert"
            className="fg-fade-in mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700">
                Could not load your AI picks.
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 active:scale-95 motion-reduce:transform-none"
            >
              Reload page
            </button>
          </div>
        </main>
      </PageChrome>
    );
  }

  // =====================================================
  // MAIN PAGE
  // =====================================================

  return (
    <PageChrome {...chromeProps}>
      {/* =====================================================
          AI PICKS CONTENT
      ===================================================== */}

      <main className="flex-1 px-4 py-4 md:px-6">
        {/* Header */}

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Personalized recommendations
            </p>

            <h1 className="mt-0.5 font-serif text-2xl font-semibold text-slate-900">
              AI Picks
            </h1>

            <p className="mt-1 text-sm leading-5 text-gray-600">
              Personalized stock signals based on market data and your
              investment profile.
            </p>
          </div>

          {recommendations.length > 0 && (
            <span className="rounded-full border border-[#DCE9E2] bg-white px-3 py-1 text-xs font-semibold text-[#0F4C3A]">
              {recommendations.length}{" "}
              {recommendations.length === 1 ? "pick" : "picks"}
            </span>
          )}
        </div>

        {tradeSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <p className="font-semibold">✓ {tradeSuccess}</p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/portfolio")}
                className="font-semibold underline underline-offset-2"
              >
                View Portfolio
              </button>
              <button
                type="button"
                onClick={() => setTradeSuccess("")}
                className="text-xs font-medium underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* How FinGrow generates these picks */}

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#DCE9E2] bg-white px-3.5 py-3 shadow-sm">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8F7EF] text-sm text-[#0F4C3A]">
            ✦
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#0B3528]">
              How FinGrow generates these picks
            </h2>

            <p className="mt-0.5 text-xs leading-5 text-gray-600">
              FinGrow analyzes recent market data, ranks stocks using
              machine learning, and matches the results with your risk
              profile to create personalized paper-trading picks.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-2 border-b border-[#DCE9E2] pb-2">
  <button
    type="button"
    onClick={() => setActiveTab("picks")}
    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
      activeTab === "picks"
        ? "bg-[#0F4C3A] text-white"
        : "bg-white text-gray-600 hover:bg-gray-50"
    }`}
  >
    For You
  </button>

  <button
    type="button"
    onClick={handleOpenRanking}
    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
      activeTab === "ranking"
        ? "bg-[#0F4C3A] text-white"
        : "bg-white text-gray-600 hover:bg-gray-50"
    }`}
  >
    How Ranking Works
  </button>
</div>
    {activeTab === "picks" && (
      <>

        {/* Recommendation cards */}


        <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((recommendation, index) => {
            const volatilityLabel =
              getRiskLabel(
                recommendation.volatility_percentile
              );

            const signalWidth = Math.min(
              100,
              Math.max(0, recommendation.model_probability * 100)
            );

            const explanation = explanations[recommendation.symbol];
            const isExpanded = !!expandedExplanation[recommendation.symbol];
            const isExplaining = !!explanationLoading[recommendation.symbol];
            const explanationError = explanationErrors[recommendation.symbol];

            return (
              <article
                key={recommendation.symbol}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                className="fg-rise group flex flex-col self-start overflow-hidden rounded-2xl border border-[#DCE9E2] bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BFD9CC] hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
              >
                {/* Card content */}

                <div className="p-4">
                  {/* Rank + risk */}

                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#E8F7EF] px-2.5 py-1 text-[11px] font-semibold text-[#0F4C3A]">
                      AI Rank #{recommendation.rank}
                    </span>

                    {recommendation.risk_compatible && (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#10B981]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                        Risk compatible
                      </span>
                    )}
                  </div>

                  {/* Stock name + price */}

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-xl font-bold tracking-tight text-[#0B3528]">
                          {recommendation.symbol.replace(
                            ".NS",
                            ""
                          )}
                        </h2>

                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                          NSE
                        </span>
                      </div>

                      <p
                        className="truncate text-xs text-gray-500"
                        title={recommendation.company_name}
                      >
                        {recommendation.company_name}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-gray-400">
                        Price
                      </p>

                      <p className="text-sm font-bold text-[#0B3528]">
                        ₹
                        {Number(
                          recommendation.current_price
                        ).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* ML Signal */}

                  <div className="mt-3 rounded-xl bg-[#F1F8F4] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        ML Signal
                        <InfoTip text="AI-based market signal for the next ~20 trading days." />
                      </p>

                      <span className="text-[11px] font-medium text-[#0F4C3A]">
                        ~20D outlook
                      </span>
                    </div>

                    <p className="mt-1 text-2xl font-bold tracking-tight text-[#0F4C3A]">
                      {formatPercent(
                        recommendation.model_probability
                      )}
                    </p>

                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-[#10B981] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                        style={{ width: `${signalWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Risk metrics */}

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-[11px] text-gray-500">
                        20D volatility
                      </p>

                      <p className="mt-0.5 text-base font-bold text-[#0B3528]">
                        {(
                          recommendation.volatility_20d * 100
                        ).toFixed(2)}
                        %
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-[11px] text-gray-500">
                        Volatility
                      </p>

                      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold leading-4 text-[#0B3528]">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${getRiskDot(
                            recommendation.volatility_percentile
                          )}`}
                        />
                        {volatilityLabel}
                      </p>

                      <p className="mt-0.5 text-[10px] text-gray-400">
                        {recommendation.volatility_percentile.toFixed(
                          1
                        )}
                        th percentile
                      </p>
                    </div>
                  </div>

                  {/* Suggested allocation */}

                  <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-[#DCE9E2] px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Suggested paper allocation
                      <InfoTip text="Suggested amount from your virtual balance." />
                    </p>

                    <p className="shrink-0 text-base font-bold text-[#0B3528]">
                      {formatCurrency(
                        recommendation.suggested_allocation
                      )}
                    </p>
                  </div>

                  {/* Why this pick — SHAP explanation */}

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#0B3528]">
                        Why this pick?
                      </p>

                      <button
                        type="button"
                        onClick={() => handleLoadExplanation(recommendation.symbol)}
                        disabled={isExplaining}
                        aria-expanded={isExpanded}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#0F4C3A] px-2.5 py-1.5
                          text-[11px] font-semibold text-[#0F4C3A] transition
                          hover:bg-[#F0F7F3] active:scale-95 disabled:cursor-not-allowed
                          disabled:opacity-60 motion-reduce:transform-none"
                      >
                        {isExplaining && <Spinner />}
                        {isExplaining
                          ? "Analyzing market factors..."
                          : explanation && isExpanded
                            ? "Hide explanation"
                            : explanationError
                              ? "Try again"
                              : explanation
                                ? "Show explanation"
                                : "Explain this pick"}
                      </button>
                    </div>

                    <p className="mt-1.5 text-[11px] leading-4 text-gray-500">
                      Ranked by the ML model and checked against your selected
                      risk profile. Explore which market factors influenced
                      this stock's prediction.
                    </p>

                    {isExpanded && (
                      <div className="fg-fade-in mt-2.5 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                        {isExplaining && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Spinner />
                            <p>
                              Calculating the factors behind this prediction...
                            </p>
                          </div>
                        )}

                        {explanationError && (
                          <p className="text-xs text-red-600">
                            {explanationError}
                          </p>
                        )}

                        {explanation && (
                          <>
                            <div className="flex items-end justify-between gap-3">
                              <p className="text-[11px] leading-4 text-gray-600">
                                Model-estimated probability of outperforming the
                                peer median over the next 20 trading days:
                              </p>

                              <p className="shrink-0 text-lg font-bold leading-none text-[#0B3528]">
                                {formatPercent(
                                  explanation.predicted_probability
                                )}
                              </p>
                            </div>

                            <p className="mt-1.5 text-[11px] leading-4 text-gray-500">
                              Factors below show how individual features influenced
                              the model's prediction. They do not guarantee future
                              performance or represent direct percentage-point changes.
                            </p>


                            {explanation.top_positive_features.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-emerald-700">
                                  Factors supporting the prediction
                                </p>

                                {explanation.top_positive_features.map(
                                  (feature) => (
                                    <div
                                      key={feature.feature_name}
                                      className="mt-1.5 flex items-start justify-between gap-3 rounded px-1 py-0.5 transition-colors hover:bg-white"
                                    >
                                      <span className="text-xs text-gray-700">
                                        {formatFeatureName(feature.feature_name)}
                                      </span>
                                      <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700">
                                        +{feature.shap_value.toFixed(4)}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {explanation.top_negative_features.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-red-700">
                                  Factors weighing against the prediction
                                </p>

                                {explanation.top_negative_features.map(
                                  (feature) => (
                                    <div
                                      key={feature.feature_name}
                                      className="mt-1.5 flex items-start justify-between gap-3 rounded px-1 py-0.5 transition-colors hover:bg-white"
                                    >
                                      <span className="text-xs text-gray-700">
                                        {formatFeatureName(feature.feature_name)}
                                      </span>
                                      <span className="shrink-0 text-xs font-semibold tabular-nums text-red-700">
                                        {feature.shap_value.toFixed(4)}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {explanation.warning && (
                              <p className="mt-2.5 text-xs leading-5 text-amber-700">
                                {explanation.warning}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card action */}

                <div className="mt-auto border-t border-gray-100 bg-gray-50/70 p-3">
                  <button
                    onClick={() =>
                      handleOpenTrade(
                        recommendation
                      )
                    }
                    className="w-full rounded-lg bg-[#0F4C3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B3528] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.98] motion-reduce:transform-none"
                  >
                    Paper Trade
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Empty state */}

        {recommendations.length === 0 && (
          <div className="fg-fade-in mt-4 rounded-2xl border border-[#DCE9E2] bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F7EF] text-lg text-[#0F4C3A]">
              ✦
            </div>

            <p className="mt-3 text-sm font-semibold text-[#0B3528]">
              No compatible AI picks found
            </p>

            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500">
              No stocks currently passed the configured risk
              compatibility rules.
            </p>
          </div>
        )}
         </>
)}
        {activeTab === "ranking" && (
  <section className="mt-5 rounded-2xl border border-[#DCE9E2] bg-white p-4 shadow-sm">
    <h2 className="text-lg font-bold text-[#0B3528]">
      How your stocks are ranked
    </h2>

    <p className="mt-1 text-sm text-gray-500">
      Stocks are ordered by the model's estimated probability of
      outperforming the peer median over the next 20 trading days.
      Your risk profile is then used to select suitable stocks.
    </p>
    <div className="mt-4 rounded-xl border border-[#DCE9E2] bg-[#F1F8F4] p-4">
  <h3 className="text-sm font-semibold text-[#0B3528]">
    How to understand your rankings
  </h3>

  <div className="mt-3 space-y-3 text-sm leading-5 text-gray-700">
    <p>
      <span className="font-semibold text-[#0F4C3A]">
        1. The model compares stocks.
      </span>{" "}
      It studies recent price movements, trading activity and
      volatility to estimate which stocks may perform better
      than the typical stock in their comparison group over
      the next 20 trading days.
    </p>

    <p>
      <span className="font-semibold text-[#0F4C3A]">
        2. Your risk profile matters.
      </span>{" "}
      A stock may rank highly but still be filtered out if its
      volatility does not meet your selected risk limit.
    </p>

    <p>
      <span className="font-semibold text-[#0F4C3A]">
        3. Your final picks are selected.
      </span>{" "}
      FinGrow considers eligible stocks in ranking order and
      selects the first three that pass the configured risk filter.
    </p>
  </div>

  <p className="mt-3 border-t border-[#DCE9E2] pt-3 text-xs leading-5 text-gray-500">
    <span className="font-semibold">What does the model score mean?</span>{" "}
    It is an estimate of the chance of outperforming the comparison
    group's median, not a predicted return or a guarantee of profit.
  </p>
</div>

    {rankingLoading ? (
      <p className="mt-5 text-sm text-gray-500">Loading rankings...</p>
    ) : rankingError ? (
      <p className="mt-5 text-sm text-red-600">{rankingError}</p>
    ) : rankingCandidates.length === 0 ? (
      <p className="mt-5 text-sm text-gray-500">
        No ranking data available.
      </p>
    ) : (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Model score</th>
              <th className="px-3 py-3">Volatility</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...rankingCandidates]
              .sort((a, b) => a.rank - b.rank)
              .map((candidate) => {
                const selected = recommendations.some(
                  (item) => item.symbol === candidate.symbol,
                );

                let status = "Passed risk filter; not in top 3";
                if (selected) {
                  status = "Selected for you";
                } else if (!candidate.risk_compatible) {
                  status = "Filtered by risk profile";
                }

                return (
                  <tr
                    key={candidate.symbol}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-3 py-3 font-semibold text-[#0F4C3A]">
                      #{candidate.rank}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-[#0B3528]">
                        {candidate.symbol.replace(".NS", "")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {candidate.company_name}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {formatPercent(candidate.model_probability)}
                    </td>
                    <td className="px-3 py-3">
                      {candidate.volatility_percentile.toFixed(1)}th percentile
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {status}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    )}

    <p className="mt-4 text-xs leading-5 text-gray-500">
      Model score is not an expected return or a guarantee of profit.
      Stocks must also pass the configured risk filter to be selected.
    </p>
  </section>
)}

        {/* Disclaimer */}

        <div className="mt-5 pb-6 text-center">
          <p className="text-[11px] leading-4 text-gray-400">
            AI Picks are machine-learning market signals for
            FinGrow&apos;s paper-trading environment. They are not
            guaranteed returns or financial advice.
          </p>
        </div>


        {/* =====================================================
            PAPER TRADE MODAL
        ===================================================== */}

        {tradeStock && (
          <div
            className="fg-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                handleCloseTrade();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="trade-title"
              className="fg-pop-in max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            >
              {/* Header */}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Paper Trade
                  </p>

                  <h2
                    id="trade-title"
                    className="mt-0.5 text-xl font-bold text-[#0B3528]"
                  >
                    {tradeStock.symbol.replace(
                      ".NS",
                      ""
                    )}
                  </h2>

                  <p className="truncate text-xs text-gray-500">
                    {tradeStock.company_name}
                  </p>
                </div>

                <button
                  onClick={handleCloseTrade}
                  disabled={tradeLoading}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              {/* Current price */}

              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1F8F4] px-4 py-3">
                <p className="text-xs text-gray-500">
                  Current price
                </p>

                <p className="text-xl font-bold text-[#0F4C3A]">
                  ₹
                  {tradePrice.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {/* Trade Mode */}

              <div className="mt-4">
                <p className="text-xs font-semibold text-[#0B3528]">
                  Buy by
                </p>

                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                  {/* Invest by ₹ */}

                  <button
                    type="button"
                    aria-pressed={tradeMode === "amount"}
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
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tradeMode === "amount"
                      ? "bg-white text-[#0F4C3A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Invest by ₹
                  </button>

                  {/* Buy by shares */}

                  <button
                    type="button"
                    aria-pressed={tradeMode === "quantity"}
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
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tradeMode === "quantity"
                      ? "bg-white text-[#0F4C3A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Buy by shares
                  </button>
                </div>
              </div>

              {/* Input */}

              <div className="mt-4">
                <label
                  htmlFor="trade-input"
                  className="text-xs font-semibold text-[#0B3528]"
                >
                  {tradeMode === "amount"
                    ? "How much do you want to invest?"
                    : "How many shares do you want to buy?"}
                </label>

                {tradeMode === "amount" ? (
                  <div className="mt-1.5 flex items-center rounded-lg border border-gray-200 px-3 transition focus-within:border-[#0F4C3A] focus-within:ring-2 focus-within:ring-emerald-100">
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
                      className="w-full border-0 bg-transparent px-2 py-2.5 text-sm focus:outline-none"
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
                    className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm transition focus:border-[#0F4C3A] focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
                  />
                )}
              </div>

              {/* Review */}

              <div className="mt-4 space-y-2 rounded-xl border border-gray-100 p-3.5">
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

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Shares to buy
                  </span>

                  <span className="font-semibold text-[#0B3528]">
                    {calculatedQuantity}
                  </span>
                </div>

                {/* Actual investment */}

                <div className="flex justify-between text-sm">
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
                    <div className="flex justify-between text-sm">
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
                <div
                  role="alert"
                  className="fg-fade-in mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                >
                  <p className="text-sm text-red-600">
                    {tradeError}
                  </p>
                </div>
              )}

              {/* Actions */}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleCloseTrade}
                  disabled={tradeLoading}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmBuy}
                  disabled={
                    tradeLoading ||
                    calculatedQuantity < 1
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0F4C3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B3528] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none"
                >
                  {tradeLoading && <Spinner />}
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
    </PageChrome>
  );
}