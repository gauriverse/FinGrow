import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX,
  FiBell,
  FiBarChart2,
} from "react-icons/fi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { supabase } from "../../lib/supabase";
import {
  getPortfolioHistory,
  getPortfolioInsights,
  getPortfolioSummary,
  getPortfolioTrades,
  sellStock,
} from "../../services/portfolioService";
import {
  HistoryCard,
  OrdersPanel,
  pctClass,
  signedPct,
  type HistoryResponse,
  type InsightsResponse,
  type SectorSlice,
  type TradesResponse,
} from "./PortfolioExtras";

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

type SortKey =
  | "symbol"
  | "quantity"
  | "buy_price"
  | "current_price"
  | "invested_value"
  | "current_value"
  | "pnl"
  | "return_pct"
  | "day_pct";

type SortDir = "asc" | "desc";

// =====================================================
// PRESENTATION HELPERS (UI only)
// =====================================================

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

const PRESS = "motion-safe:active:scale-[0.97]";

const PALETTE = [
  "#0F4C3A",
  "#10B981",
  "#A3E635",
  "#0B1B2E",
  "#34D399",
  "#64748B",
  "#6EE7B7",
  "#334155",
];

const CASH_COLOR = "#CBD5E1";

const POSITIVE = "#059669";
const NEGATIVE = "#DC2626";

// Display-only ratio of two values the API already returns.
const returnPctOf = (holding: Holding): number | null =>
  Number(holding.invested_value) > 0
    ? (Number(holding.pnl) / Number(holding.invested_value)) * 100
    : null;

const shortSymbol = (symbol: string) => symbol.replace(".NS", "");

const compactNumber = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function StatCard({
  label,
  value,
  valueClass = "text-[#0B3528]",
  caption,
  captionClass = "text-slate-400",
}: {
  label: string;
  value: string;
  valueClass?: string;
  caption: string;
  captionClass?: string;
}) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </p>

      <p
        className={`mt-0.5 text-2xl font-bold tabular-nums wrap-break-word ${valueClass}`}
      >
        {value}
      </p>

      <p className={`text-xs ${captionClass}`}>{caption}</p>
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "right",
  title,
  sticky = false,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  title?: string;
  sticky?: boolean;
}) {
  const active = activeKey === sortKey;

  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-2 ${
        align === "left" ? "text-left" : "text-right"
      } ${sticky ? "sticky left-0 z-10 bg-slate-50" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title ?? `Sort by ${label}`}
        className={`inline-flex items-center gap-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
          active ? "text-[#0F4C3A]" : "text-slate-400 hover:text-slate-600"
        } ${FOCUS}`}
      >
        {label}

        <span
          aria-hidden="true"
          className={`text-[9px] ${active ? "opacity-100" : "opacity-0"}`}
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

// -----------------------------------------------------
// CHARTS — built only from the holdings/cash already
// returned by the existing portfolio API.
// -----------------------------------------------------

function PortfolioCharts({
  holdings,
  cash,
  fmt,
  sectors,
}: {
  holdings: Holding[];
  cash: number;
  fmt: (value: number) => string;
  sectors: SectorSlice[] | null;
}) {
  const reduceMotion = useReducedMotion();
  const [groupBy, setGroupBy] = useState<"stock" | "sector">("stock");
  const canGroupBySector = !!sectors && sectors.length > 0;

  // Allocation: current value per holding + cash, largest first.
  const grouped = useMemo(() => {
    const byName = new Map<
      string,
      { name: string; current_value: number; pnl: number }
    >();

    holdings.forEach((holding) => {
      const name = shortSymbol(holding.symbol);
      const entry = byName.get(name) ?? {
        name,
        current_value: 0,
        pnl: 0,
      };

      entry.current_value += Number(holding.current_value) || 0;
      entry.pnl += Number(holding.pnl) || 0;
      byName.set(name, entry);
    });

    return [...byName.values()];
  }, [holdings]);

  const allocation = useMemo(() => {
    const baseSlices =
      groupBy === "sector" && sectors && sectors.length > 0
        ? sectors.map((sector) => ({
            name: sector.sector,
            value: Math.max(0, Number(sector.value) || 0),
            isCash: false,
          }))
        : grouped.map((group) => ({
            name: group.name,
            value: Math.max(0, group.current_value),
            isCash: false,
          }));

    const slices = [
      ...baseSlices,
      {
        name: "Cash",
        value: Math.max(0, Number(cash) || 0),
        isCash: true,
      },
    ]
      .filter((slice) => slice.value > 0)
      .sort((a, b) => b.value - a.value);

    let colorIndex = 0;

    return slices.map((slice) => ({
      ...slice,
      fill: slice.isCash ? CASH_COLOR : PALETTE[colorIndex++ % PALETTE.length],
    }));
  }, [grouped, cash, sectors, groupBy]);

  const allocationTotal = allocation.reduce(
    (sum, slice) => sum + slice.value,
    0,
  );

  const share = (value: number) =>
    allocationTotal > 0 ? (value / allocationTotal) * 100 : 0;

  // P&L contribution, best to worst.
  const pnlData = useMemo(
    () =>
      grouped
        .map((group) => ({
          name: group.name,
          pnl: group.pnl,
        }))
        .sort((a, b) => b.pnl - a.pnl),
    [grouped],
  );

  const shortPnl = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "-" : ""}₹${compactNumber.format(
      Math.abs(value),
    )}`;

  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    fontSize: 12,
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
  };

  return (
    <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
      {/* ALLOCATION */}

      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0B3528]">Allocation</h2>

          {canGroupBySector ? (
            <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              {(["stock", "sector"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGroupBy(option)}
                  aria-pressed={groupBy === option}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors ${FOCUS} ${
                    groupBy === option
                      ? "bg-white text-[#0B3528] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              By current value, incl. cash
            </p>
          )}
        </div>

        {allocation.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 text-center">
            Nothing to chart yet.
          </p>
        ) : (
          <>
            <div
              className="mt-2.5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label="Portfolio allocation by current value"
            >
              {allocation.map((slice) => (
                <div
                  key={slice.name}
                  title={`${slice.name}: ${fmt(
                    slice.value,
                  )} (${share(slice.value).toFixed(1)}%)`}
                  className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${share(slice.value)}%`,
                    backgroundColor: slice.fill,
                  }}
                />
              ))}
            </div>

            <ul className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1 max-h-24 overflow-y-auto pr-1">
              {allocation.map((slice) => (
                <li
                  key={slice.name}
                  title={fmt(slice.value)}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: slice.fill }}
                  />

                  <span className="flex-1 truncate font-medium text-slate-700">
                    {slice.name}
                  </span>

                  <span className="tabular-nums text-slate-400">
                    ₹{compactNumber.format(slice.value)}
                  </span>

                  <span className="w-11 text-right tabular-nums font-semibold text-slate-600">
                    {share(slice.value).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* P&L CONTRIBUTION */}

      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0B3528]">P&L by holding</h2>

          <p className="text-xs text-slate-400">Unrealized, best to worst</p>
        </div>

        <div className="mt-1.5">
          <div
            style={{
              height: Math.max(72, pnlData.length * 28),
            }}
            role="img"
            aria-label="Bar chart of unrealized profit and loss per holding, best to worst"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pnlData}
                layout="vertical"
                margin={{
                  top: 0,
                  right: 72,
                  bottom: 0,
                  left: 0,
                }}
                barCategoryGap={5}
              >
                <CartesianGrid horizontal={false} stroke="#F1F5F9" />

                <XAxis
                  type="number"
                  hide
                  domain={[
                    (min: number) => Math.min(0, min * 1.3),
                    (max: number) => Math.max(0, max * 1.3),
                  ]}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tickMargin={8}
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fontSize: 11,
                    fill: "#475569",
                    fontWeight: 600,
                  }}
                />

                <ReferenceLine x={0} stroke="#CBD5E1" />

                <Tooltip
                  cursor={{ fill: "#F1F5F9" }}
                  contentStyle={tooltipStyle}
                  formatter={(value) => fmt(Number(value ?? 0))}
                />

                <Bar
                  dataKey="pnl"
                  name="P&L"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  isAnimationActive={!reduceMotion}
                >
                  {pnlData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.pnl >= 0 ? POSITIVE : NEGATIVE}
                    />
                  ))}

                  <LabelList
                    dataKey="pnl"
                    position="right"
                    formatter={(value) => shortPnl(Number(value ?? 0))}
                    style={{
                      fontSize: 11,
                      fill: "#475569",
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sellStockData, setSellStockData] = useState<Holding | null>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");

  // Presentation-only: table sorting
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Read-only extras. Each is loaded independently, so if one
  // fails only its own section is hidden.
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [trades, setTrades] = useState<TradesResponse | null>(null);
  const [tradesFailed, setTradesFailed] = useState(false);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [holdingsTab, setHoldingsTab] = useState<"holdings" | "orders">(
    "holdings",
  );

  const reloadTrades = useCallback(async () => {
    try {
      const result = await getPortfolioTrades();
      setTrades(result);
      setTradesFailed(false);
    } catch {
      setTradesFailed(true);
    }
  }, []);

  // =====================================================
  // LOAD USER + PROFILE + PORTFOLIO
  // =====================================================

  const loadPortfolio = useCallback(async () => {
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
        available_balance: Number(portfolioData.available_balance || 0),
        invested_value: Number(portfolioData.invested_value || 0),
        current_value: Number(portfolioData.current_value || 0),
        total_value: Number(portfolioData.total_value || 0),
        overall_pnl: Number(portfolioData.overall_pnl || 0),
        today_pnl: Number(portfolioData.today_pnl || 0),
        today_pnl_percent: Number(portfolioData.today_pnl_percent || 0),
        holdings: Array.isArray(portfolioData.holdings)
          ? portfolioData.holdings
          : [],
      });
    } catch (error) {
      console.error("Portfolio loading failed:", error);

      setError(
        error instanceof Error ? error.message : "Failed to load portfolio",
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // =====================================================
  // LOAD EXTRAS (history, insights, orders) — read-only.
  // Re-runs whenever the portfolio reloads, e.g. after a sell.
  // =====================================================

  useEffect(() => {
    if (!portfolio) return;

    let cancelled = false;

    Promise.allSettled([
      getPortfolioHistory(365),
      getPortfolioInsights(),
      getPortfolioTrades(),
    ]).then(([historyResult, insightsResult, tradesResult]) => {
      if (cancelled) return;

      setHistory(
        historyResult.status === "fulfilled" ? historyResult.value : null,
      );
      setInsights(
        insightsResult.status === "fulfilled" ? insightsResult.value : null,
      );
      setTrades(
        tradesResult.status === "fulfilled" ? tradesResult.value : null,
      );
      setTradesFailed(tradesResult.status === "rejected");
      setExtrasLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  // =====================================================
  // CLOSE PROFILE DROPDOWN
  // =====================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // =====================================================
  // USER INFO
  // =====================================================

  const fullName = profile?.full_name?.trim() || "";

  const nameParts = fullName.split(/\s+/);

  const firstName = nameParts[0] || "User";

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

    if (item === "Watchlist") {
      navigate("/watchlist");
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

    const quantity = Math.floor(Number(sellQuantity));

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setSellError("Quantity must be greater than 0.");
      return;
    }

    if (quantity > sellStockData.quantity) {
      setSellError(
        `You only own ${sellStockData.quantity} share${
          sellStockData.quantity === 1 ? "" : "s"
        }.`,
      );
      return;
    }

    try {
      setSellLoading(true);
      setSellError("");

      // Backend remains authoritative.
      await sellStock(sellStockData.stock_id, quantity);

      await loadPortfolio();

      setSellStockData(null);
      setSellQuantity(1);
      setSellError("");
    } catch (error) {
      console.error("Paper SELL failed:", error);

      setSellError(
        error instanceof Error
          ? error.message
          : "Could not complete paper sell",
      );
    } finally {
      setSellLoading(false);
    }
  };

  // Presentation-only: close the sell dialog with Escape
  // (uses the existing handleCloseSell, so it still
  // respects the sellLoading guard).
  useEffect(() => {
    if (!sellStockData) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseSell();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellStockData, sellLoading]);

  // =====================================================
  // FORMATTING
  // =====================================================

  const formatCurrency = (value: number) =>
    `₹${Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatPnl = (value: number) => {
    const amount = Number(value || 0);

    if (amount > 0) {
      return `+${formatCurrency(amount)}`;
    }

    if (amount < 0) {
      return `-${formatCurrency(Math.abs(amount))}`;
}

    return formatCurrency(amount);
  };

  const formatPercentage = (value: number) =>
    `${Number(value || 0).toFixed(2)}%`;

  // Same expression the modal used inline, computed once.
  const sellEstimate = sellStockData
    ? sellStockData.current_price *
      Math.max(0, Math.floor(Number(sellQuantity) || 0))
    : 0;

  // =====================================================
  // TABLE SORTING (presentation only — sorts a copy)
  // =====================================================

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

  const insightByStock = useMemo(() => {
    const map: Record<string, InsightsResponse["holdings"][number]> = {};

    (insights?.holdings ?? []).forEach((item) => {
      map[item.stock_id] = item;
    });

    return map;
  }, [insights]);

  const dayPctOf = (holding: Holding): number | null =>
    insightByStock[holding.stock_id]?.day_change_percent ?? null;

  const sortedHoldings = useMemo(() => {
    const list = portfolio?.holdings ?? [];

    if (!sortKey) return list;

    const direction = sortDir === "asc" ? 1 : -1;

    const metric = (holding: Holding): number | string | null => {
      switch (sortKey) {
        case "symbol":
          return holding.symbol;
        case "return_pct":
          return returnPctOf(holding);
        case "day_pct":
          return insightByStock[holding.stock_id]?.day_change_percent ?? null;
        default:
          return Number(holding[sortKey]);
      }
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
  }, [portfolio, sortKey, sortDir, insightByStock]);

  const pnlClass = (value: number) =>
    value >= 0 ? "text-emerald-600" : "text-red-600";

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#FAF9F5] font-sans">
        {/* =================================================
            SIDEBAR
        ================================================= */}

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            />

            <motion.aside
              className="relative w-64 bg-[#0B1B2E] text-white flex flex-col shadow-xl"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
                    F
                  </div>

                  <span className="font-bold text-lg font-serif tracking-tight">
                    FinGrow
                  </span>
                </div>

                <button
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close menu"
                  className={`p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors ${FOCUS}`}
                >
                  <FiX size={18} />
                </button>
              </div>

              <nav
                aria-label="Main navigation"
                className="flex-1 px-3 space-y-0.5"
              >
                {navItems.map((item) => {
                  const active =
                    item === "Portfolio" && location.pathname === "/portfolio";

                  return (
                    <button
                      key={item}
                      onClick={() => handleNavigation(item)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${FOCUS} ${
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

              <div className="px-5 py-4 border-t border-white/10">
                <p className="text-[11px] text-slate-500">
                  Paper trading · virtual funds only
                </p>
              </div>
            </motion.aside>
          </div>
        )}

        {/* =================================================
            TOP BAR
        ================================================= */}

        <header className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-700 ${FOCUS}`}
              aria-label="Open menu"
            >
              <FiMenu size={20} />
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className={`flex items-center gap-2 rounded ${FOCUS}`}
            >
              <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
                F
              </div>

              <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
                FinGrow
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            {/* WALLET */}

            <button
              onClick={() => navigate("/wallet")}
              title="Open wallet"
              className={`text-right rounded px-1.5 py-0.5 -mx-1.5 hover:bg-slate-50 transition-colors ${FOCUS}`}
            >
              <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
                WALLET
              </p>

              <p className="text-sm font-bold text-slate-800 tabular-nums">
                {portfolio
                  ? formatCurrency(portfolio.available_balance)
                  : "Loading..."}
              </p>
            </button>

            {/* NOTIFICATION */}

            <button
              aria-label="Notifications"
              className={`w-9 h-9 rounded-full bg-[#FFF8E8] flex items-center justify-center text-amber-700 hover:brightness-95 transition ${FOCUS}`}
            >
              <FiBell size={16} />
            </button>

            {/* PROFILE */}

            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Account menu"
                className={`w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-[#0F4C3A] hover:ring-2 hover:ring-emerald-200 transition ${FOCUS}`}
              >
                {initials.toUpperCase()}
              </button>

              {profileOpen && (
                <motion.div
                  className="absolute right-0 top-11 w-60 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
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
                    onClick={() => navigate("/settings")}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FiSettings />
                    Settings
                  </button>

                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FiLogOut />
                    Logout
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </header>

        {/* =================================================
            MAIN
        ================================================= */}

        <main className="px-4 md:px-8 py-5 max-w-7xl mx-auto">
          <div className="mb-3 flex flex-col md:flex-row md:items-end md:justify-between gap-1">
            <div>
              <p className="text-sm font-semibold text-[#10B981]">
                Your investments
              </p>

              <h1 className="text-3xl font-bold text-[#0B3528] leading-tight">
                Portfolio
              </h1>
            </div>
          </div>

          {/* ERROR */}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* LOADING */}

          {loading ? (
            <div className="space-y-2" role="status" aria-live="polite">
              <span className="sr-only">Loading portfolio...</span>

              <div className="h-18 rounded-xl bg-white border border-slate-200 animate-pulse motion-reduce:animate-none" />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="h-32 rounded-xl bg-white border border-slate-200 animate-pulse motion-reduce:animate-none" />
                <div className="h-32 rounded-xl bg-white border border-slate-200 animate-pulse motion-reduce:animate-none" />
              </div>

              <div className="h-64 rounded-xl bg-white border border-slate-200 animate-pulse motion-reduce:animate-none" />
            </div>
          ) : portfolio ? (
            <>
              {/* =================================================
                  SUMMARY + AVAILABLE CASH
              ================================================= */}

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                  <StatCard
                    label="Total Value"
                    value={formatCurrency(portfolio.total_value)}
                    caption="Cash + current holdings"
                  />

                  <StatCard
                    label="Invested Value"
                    value={formatCurrency(portfolio.invested_value)}
                    caption="Amount used to buy holdings"
                  />

                  <StatCard
                    label="Overall P&L"
                    value={formatPnl(portfolio.overall_pnl)}
                    valueClass={pnlClass(portfolio.overall_pnl)}
                    caption="Unrealized portfolio P&L"
                  />

                  <StatCard
                    label="Today's P&L"
                    value={formatPnl(portfolio.today_pnl)}
                    valueClass={pnlClass(portfolio.today_pnl)}
                    caption={formatPercentage(portfolio.today_pnl_percent)}
                    captionClass={`font-medium ${pnlClass(
                      portfolio.today_pnl_percent,
                    )}`}
                  />
                </div>

                <div className="rounded-xl bg-[#0B3528] text-white px-4 py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-emerald-100">
                      Available virtual cash
                    </p>

                    <p className="text-2xl font-bold tabular-nums wrap-break-word">
                      {formatCurrency(portfolio.available_balance)}
                    </p>
                  </div>

                  <button
                    onClick={() => navigate("/ai-picks")}
                    className={`shrink-0 px-4 py-2 rounded-lg bg-[#A3E635] text-[#0B3528] font-semibold text-sm hover:opacity-90 transition ${PRESS} ${FOCUS}`}
                  >
                    Explore AI Picks
                  </button>
                </div>
              </div>

              {/* =================================================
                  CHARTS (real holdings data only)
              ================================================= */}

              <HistoryCard
                data={history}
                loading={extrasLoading}
                fmt={formatCurrency}
              />

              {portfolio.holdings.length > 0 && (
                <PortfolioCharts
                  holdings={portfolio.holdings}
                  cash={portfolio.available_balance}
                  fmt={formatCurrency}
                  sectors={insights?.sectors ?? null}
                />
              )}

              {/* =================================================
                  HOLDINGS
              ================================================= */}

              <section className="mt-4">
                <div className="flex items-end justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-[#0B3528]">
                      Your Holdings
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                      {(
                        [
                          ["holdings", "Holdings"],
                          ["orders", "Orders"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setHoldingsTab(value); 
                            reloadTrades();}}
                          aria-pressed={holdingsTab === value}
                          className={`px-3 py-1 rounded-md transition-colors ${FOCUS} ${
                            holdingsTab === value
                              ? "bg-white text-[#0B3528] shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <span className="hidden sm:inline text-sm text-slate-400 tabular-nums">
                      {" "}
                      {portfolio.holdings.length}{" "}
                      {portfolio.holdings.length === 1
                        ? "holding"
                        : "holdings"}{" "}
                    </span>
                  </div>
                </div>

                {holdingsTab === "orders" ? (
                  <OrdersPanel
                    data={trades}
                    loading={extrasLoading}
                    failed={tradesFailed}
                    fmt={formatCurrency}
                  />
                ) : portfolio.holdings.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl px-6 py-8 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-[#0F4C3A]">
                      <FiBarChart2 size={22} />
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-800">
                      No holdings yet
                    </h3>

                    <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
                      Your purchased stocks will appear here. Start by exploring
                      FinGrow's AI Picks.
                    </p>

                    <button
                      onClick={() => navigate("/ai-picks")}
                      className={`mt-4 px-5 py-2 rounded-lg bg-[#0F4C3A] text-white text-sm font-semibold hover:bg-[#0B3528] transition-colors ${PRESS} ${FOCUS}`}
                    >
                      View AI Picks
                    </button>
                  </div>
                ) : (
                  <>
                    {/* DESKTOP / TABLET TABLE */}

                    <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-240">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <SortableTh
                                label="Stock"
                                sortKey="symbol"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                align="left"
                                sticky
                              />

                              <SortableTh
                                label="Quantity"
                                sortKey="quantity"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                title="Number of shares held"
                              />

                              <SortableTh
                                label="Avg. Buy"
                                sortKey="buy_price"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                title="Average buy price per share"
                              />

                              <SortableTh
                                label="Current"
                                sortKey="current_price"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                title="Current price per share"
                              />

                              <SortableTh
                                label="Day"
                                sortKey="day_pct"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                title="Change today vs previous close"
                              />

                              <SortableTh
                                label="Invested"
                                sortKey="invested_value"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                              />

                              <SortableTh
                                label="Current Value"
                                sortKey="current_value"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                              />

                              <SortableTh
                                label="P&L"
                                sortKey="pnl"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                title="Profit and loss (unrealized)"
                              />

                              <SortableTh
                                label="Return"
                                sortKey="return_pct"
                                activeKey={sortKey}
                                dir={sortDir}
                                onSort={handleSort}
                                title="P&L as a percentage of the amount invested"
                              />

                              <th
                                scope="col"
                                className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide"
                              >
                                Action
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {sortedHoldings.map((holding, index) => (
                              <tr
                                key={`${holding.stock_id}-${holding.buy_price}-${index}`}
                                className="group hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors px-4 py-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/stock/${encodeURIComponent(
                                          holding.symbol,
                                        )}`,
                                      )
                                    }
                                    title="View stock details"
                                    className={`font-bold text-slate-900 hover:text-[#0F4C3A] hover:underline rounded ${FOCUS}`}
                                  >
                                    {shortSymbol(holding.symbol)}
                                  </button>

                                  <span className="ml-1.5 text-[10px] text-slate-400">
                                    NSE
                                  </span>
                                </td>

                                <td className="px-4 py-2 text-right text-sm font-semibold text-slate-700 tabular-nums">
                                  {holding.quantity}
                                </td>

                                <td className="px-4 py-2 text-right text-sm text-slate-600 tabular-nums">
                                  {formatCurrency(holding.buy_price)}
                                </td>

                                <td className="px-4 py-2 text-right text-sm text-slate-700 font-medium tabular-nums">
                                  {formatCurrency(holding.current_price)}
                                </td>

                                <td
                                  className={`px-4 py-2 text-right text-sm font-medium tabular-nums ${pctClass(
                                    dayPctOf(holding),
                                  )}`}
                                >
                                  {signedPct(dayPctOf(holding))}
                                </td>

                                <td className="px-4 py-2 text-right text-sm text-slate-600 tabular-nums">
                                  {formatCurrency(holding.invested_value)}
                                </td>

                                <td className="px-4 py-2 text-right text-sm font-semibold text-slate-800 tabular-nums">
                                  {formatCurrency(holding.current_value)}
                                </td>

                                <td
                                  className={`px-4 py-2 text-right text-sm font-bold tabular-nums ${pnlClass(
                                    holding.pnl,
                                  )}`}
                                >
                                  {formatPnl(holding.pnl)}
                                </td>

                                <td
                                  className={`px-4 py-2 text-right text-sm font-semibold tabular-nums ${pctClass(
                                    returnPctOf(holding),
                                  )}`}
                                >
                                  {signedPct(returnPctOf(holding))}
                                </td>

                                <td className="px-4 py-2 text-right">
                                  <button
                                    onClick={() => handleOpenSell(holding)}
                                    aria-label={`Sell ${shortSymbol(
                                      holding.symbol,
                                    )}`}
                                    className={`px-3.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-sm font-semibold hover:bg-red-100 transition-colors ${PRESS} ${FOCUS}`}
                                  >
                                    Sell
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* MOBILE CARDS */}

                    <ul className="md:hidden space-y-2">
                      {portfolio.holdings.map((holding, index) => (
                        <li
                          key={`${holding.stock_id}-${holding.buy_price}-${index}`}
                          className="bg-white border border-slate-200 rounded-xl p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/stock/${encodeURIComponent(
                                      holding.symbol,
                                    )}`,
                                  )
                                }
                                className={`font-bold text-slate-900 hover:text-[#0F4C3A] rounded ${FOCUS}`}
                              >
                                {shortSymbol(holding.symbol)}
                              </button>

                              <p className="text-xs text-slate-400">NSE</p>
                            </div>

                            <div className="text-right">
                              <p
                                className={`text-sm font-bold tabular-nums ${pnlClass(
                                  holding.pnl,
                                )}`}
                              >
                                {formatPnl(holding.pnl)}
                              </p>

                              <p className="text-xs text-slate-400">P&L</p>
                            </div>
                          </div>

                          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-400">Quantity</dt>
                              <dd className="font-semibold text-slate-700 tabular-nums">
                                {holding.quantity}
                              </dd>
                            </div>

                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-400">Avg. Buy</dt>
                              <dd className="text-slate-600 tabular-nums">
                                {formatCurrency(holding.buy_price)}
                              </dd>
                            </div>

                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-400">Current</dt>
                              <dd className="font-medium text-slate-700 tabular-nums">
                                {formatCurrency(holding.current_price)}
                              </dd>
                            </div>

                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-400">Invested</dt>
                              <dd className="text-slate-600 tabular-nums">
                                {formatCurrency(holding.invested_value)}
                              </dd>
                            </div>

                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-400">Day</dt>
                              <dd
                                className={`font-medium tabular-nums ${pctClass(
                                  dayPctOf(holding),
                                )}`}
                              >
                                {signedPct(dayPctOf(holding))}
                              </dd>
                            </div>

                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-400">Return</dt>
                              <dd
                                className={`font-semibold tabular-nums ${pctClass(
                                  returnPctOf(holding),
                                )}`}
                              >
                                {signedPct(returnPctOf(holding))}
                              </dd>
                            </div>

                            <div className="col-span-2 flex justify-between gap-2">
                              <dt className="text-slate-400">Current Value</dt>
                              <dd className="font-semibold text-slate-800 tabular-nums">
                                {formatCurrency(holding.current_value)}
                              </dd>
                            </div>
                          </dl>

                          <button
                            onClick={() => handleOpenSell(holding)}
                            className={`mt-3 w-full py-2 rounded-lg bg-red-50 text-red-600 border border-red-100 text-sm font-semibold hover:bg-red-100 transition-colors ${PRESS} ${FOCUS}`}
                          >
                            Sell
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </>
          ) : null}
        </main>

        {/* =================================================
            SELL MODAL
        ================================================= */}

        {sellStockData && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-dialog-title"
          >
            <motion.div
              className="absolute inset-0 bg-black/40"
              onClick={handleCloseSell}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            />

            <motion.div
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                    Paper Trade
                  </p>

                  <h2
                    id="sell-dialog-title"
                    className="mt-0.5 text-2xl font-bold text-[#0B3528]"
                  >
                    Sell {shortSymbol(sellStockData.symbol)}
                  </h2>
                </div>

                <button
                  onClick={handleCloseSell}
                  disabled={sellLoading}
                  aria-label="Close"
                  className={`p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 ${FOCUS}`}
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Current price</span>

                  <span className="font-semibold text-slate-800 tabular-nums">
                    {formatCurrency(sellStockData.current_price)}
                  </span>
                </div>

                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-500">Shares owned</span>

                  <span className="font-semibold text-slate-800 tabular-nums">
                    {sellStockData.quantity}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="sell-quantity"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Shares to sell
                  </label>

                  <button
                    type="button"
                    onClick={() => setSellQuantity(sellStockData.quantity)}
                    disabled={sellLoading}
                    title="Sell all shares you own"
                    className={`text-xs font-semibold text-[#0F4C3A] hover:underline disabled:opacity-50 rounded ${FOCUS}`}
                  >
                    Max
                  </button>
                </div>

                <input
                  id="sell-quantity"
                  type="number"
                  min={1}
                  max={sellStockData.quantity}
                  step={1}
                  value={sellQuantity}
                  onChange={(event) =>
                    setSellQuantity(Number(event.target.value))
                  }
                  disabled={sellLoading}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-shadow"
                />
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Estimated proceeds</span>

                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatCurrency(sellEstimate)}
                  </span>
                </div>
              </div>

              {sellError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700"
                >
                  {sellError}
                </div>
              )}

              <button
                onClick={handleConfirmSell}
                disabled={sellLoading}
                aria-busy={sellLoading}
                className={`mt-5 w-full py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${PRESS} ${FOCUS}`}
              >
                {sellLoading
                  ? "Selling..."
                  : `Confirm Sell — ${formatCurrency(sellEstimate)}`}
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
