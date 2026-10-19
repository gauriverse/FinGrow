import React, { useEffect, useState, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getNifty,
  getSensex,
  getMarketMovers,
  searchStocks,
  getStock,
} from "../../services/marketService";

import { useNavigate } from "react-router-dom";

import {
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX,
  FiSearch,
  FiBell,
  FiGrid,
  FiZap,
  FiBriefcase,
  FiCreditCard,
  FiStar,
  FiBookOpen,
  FiChevronRight,
} from "react-icons/fi";

import { supabase } from "../../lib/supabase";

import {
  getPortfolioSummary,
  buyStock,
  addFunds,
} from "../../services/portfolioService";

import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
} from "../../services/watchlist";

// =====================================================
// SMALL PRESENTATION HELPERS (no logic, no data access)
// =====================================================

function Skeleton({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded bg-slate-200/80 motion-reduce:animate-none ${className}`}
    />
  );
}

function StatCard({ label, value, sub, footnote = null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-sm motion-reduce:transition-none">
      <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
        {label}
      </p>

      <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
        {value}
      </div>

      <div className="mt-0.5">{sub}</div>

      {footnote && (
        <p className="mt-0.5 text-[11px] text-slate-400">{footnote}</p>
      )}
    </div>
  );
}

function MoverRow({ stock, change, positive, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(stock)}
      title={`View ${stock.symbol.replace(".NS", "")}`}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-1.5 text-left transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] motion-reduce:transition-none"
    >
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-sm font-semibold text-slate-900">
          {stock.symbol.replace(".NS", "")}
        </span>

        <span className="text-[10px] text-slate-400">NSE</span>
      </span>

      <span className="flex shrink-0 items-center gap-2.5">
        <span className="text-base font-bold text-slate-900 tabular-nums">
          ₹
          {Number(stock.price).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
          })}
        </span>

        <span
          className={`min-w-[4rem] rounded-md px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${positive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
            }`}
        >
          {change}
        </span>
      </span>
    </button>
  );
}

function MoverColumn({ title, stocks, positive, onSelect }) {
  const rows = stocks?.slice(0, 5) || [];

  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{title}</h3>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          Nothing to show right now.
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map((stock) => (
            <MoverRow
              key={stock.symbol}
              stock={stock}
              positive={positive}
              onSelect={onSelect}
              change={
                positive
                  ? `▲ ${stock.change_percent}%`
                  : `▼ ${Math.abs(stock.change_percent)}%`
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IndexChip({ label, data }) {
  const hasChange = data && data.changePercent != null;
  const up = hasChange && Number(data.changePercent) >= 0;

  return (
    <div
      className="flex shrink-0 items-center gap-2 text-sm"
      title={`${label} benchmark index`}
    >
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </span>

      {!data ? (
        <Skeleton className="h-3.5 w-32" />
      ) : (
        <>
          <span className="font-semibold text-slate-900 tabular-nums">
            {data.price
              ? `₹${Number(data.price).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}`
              : "N/A"}
          </span>

          {hasChange && (
            <span
              className={`font-semibold tabular-nums ${up ? "text-emerald-600" : "text-red-600"
                }`}
            >
              {`${up ? "▲ +" : "▼ -"}${Math.abs(
                Number(data.changePercent),
              ).toFixed(2)}%`}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function MoverTooltip({ active = false, payload = [] }) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{d.label}</p>

      <p
        className={`font-semibold tabular-nums ${d.value >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
      >
        {`${d.value >= 0 ? "▲ +" : "▼ -"}${Math.abs(d.value).toFixed(2)}%`}
      </p>
    </div>
  );
}

function MoversChart({ data, onSelect }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <div className="h-56 min-w-[520px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#E2E8F0"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="label"
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748B" }}
            />

            <YAxis
              width={40}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748B" }}
              tickFormatter={(v) => `${v}%`}
            />

            <ReferenceLine y={0} stroke="#CBD5E1" />

            <Tooltip
              cursor={{ fill: "rgba(15,76,58,0.06)" }}
              content={<MoverTooltip />}
            />

            <Bar
              dataKey="value"
              maxBarSize={28}
              radius={[3, 3, 3, 3]}
              cursor="pointer"
              isAnimationActive={!reduceMotion}
              onClick={(_entry, index) => {
                const symbol = data[index]?.symbol;

                if (symbol) {
                  onSelect({ symbol });
                }
              }}
            >
              {data.map((d) => (
                <Cell
                  key={d.symbol}
                  fill={d.value >= 0 ? "#10B981" : "#EF4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  // =====================================================
  // USER / UI STATE
  // =====================================================

  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Re-renders the clock-based bits (date, trading-hours dot) every minute.
  // Display only: it does not fetch anything.
  const [now, setNow] = useState(() => new Date());

  const profileRef = useRef(null);
  const skipNextSearch = useRef(false);

  // =====================================================
  // MARKET / PORTFOLIO STATE
  // =====================================================

  const [nifty, setNifty] = useState(null);
  const [sensex, setSensex] = useState(null);

  const [marketMovers, setMarketMovers] = useState(null);

  const [portfolio, setPortfolio] = useState(null);

  // =====================================================
  // STOCK SEARCH STATE
  // =====================================================

  const [searchQuery, setSearchQuery] = useState("");

  const [searchResults, setSearchResults] = useState([]);

  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);

  // =====================================================
  // WATCHLIST STATE
  // =====================================================

  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState("");

  // =====================================================
  // PAPER TRADE STATE
  // =====================================================

  const [tradeStock, setTradeStock] = useState(null);

  const [tradeMode, setTradeMode] = useState("quantity");

  const [tradeAmount, setTradeAmount] = useState("");

  const [tradeQuantity, setTradeQuantity] = useState(1);

  const [tradeLoading, setTradeLoading] = useState(false);

  const [tradeError, setTradeError] = useState("");

  // ADD FUNDS STATE
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

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

      // Prevent an unnecessary search
      // immediately after selecting a stock.
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
    let cancelled = false;

    // Start market + portfolio calls immediately and render each as it arrives
    getNifty()
      .then((v) => !cancelled && setNifty(v))
      .catch((e) => console.error("Nifty failed:", e));

    getSensex()
      .then((v) => !cancelled && setSensex(v))
      .catch((e) => console.error("Sensex failed:", e));

    getMarketMovers()
      .then((v) => !cancelled && setMarketMovers(v))
      .catch((e) => console.error("Market movers failed:", e));

    getPortfolioSummary()
      .then((v) => !cancelled && setPortfolio(v))
      .catch((e) => console.error("Portfolio failed:", e));

    // Auth + profile run in parallel with the above
    (async () => {
      // getSession reads the local session, no network round trip
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const googleName =
        user.user_metadata?.full_name || user.user_metadata?.name || "";

      setProfile({
        full_name: profileData?.full_name?.trim() || googleName.trim() || "",
        email: user.email,
      });
    })();

    return () => {
      cancelled = true;
    };
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
  // MINUTE TICK (display only)
  // =====================================================

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);

    return () => clearInterval(id);
  }, []);

  // =====================================================
  // ESCAPE KEY CLOSES OPEN OVERLAYS (UI convenience only)
  // =====================================================

  useEffect(() => {
    if (!tradeStock && !sidebarOpen && !profileOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      // Same rule as the Cancel button: never close mid-trade.
      if (tradeStock) {
        if (!tradeLoading) {
          setTradeStock(null);
          setTradeMode("quantity");
          setTradeQuantity(1);
          setTradeAmount("");
          setTradeError("");
        }

        return;
      }

      setSidebarOpen(false);
      setProfileOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tradeStock, tradeLoading, sidebarOpen, profileOpen]);

  // =====================================================
  // CHECK WATCHLIST STATUS FOR SELECTED STOCK
  // =====================================================

  useEffect(() => {
    const checkWatchlist = async () => {
      setWatchlistError("");

      if (!selectedStock?.stock_id) {
        setIsWatchlisted(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsWatchlisted(false);
          return;
        }

        const exists = await isInWatchlist(user.id, selectedStock.stock_id);
        setIsWatchlisted(exists);
      } catch (error) {
        console.error("Failed to check watchlist:", error);
      }
    };

    checkWatchlist();
  }, [selectedStock]);
  // =====================================================
  // SELECT STOCK
  // =====================================================

  const handleStockSelect = async (stock) => {
    try {
      const data = await getStock(stock.symbol);

      // =================================================
      // GET REAL SUPABASE STOCK ID
      // =================================================

      const { data: stockRow, error: stockError } = await supabase
        .from("stocks")
        .select("id")
        .eq("symbol", stock.symbol)
        .maybeSingle();

      if (stockError || !stockRow) {
        throw new Error("Could not find this stock in FinGrow.");
      }

      // Add stock_id to the
      // live market response.
      const stockWithId = {
        ...data,
        stock_id: stockRow.id,
      };

      setSelectedStock(stockWithId);

      // Prevent the selected stock
      // symbol from triggering a new search.
      skipNextSearch.current = true;

      setSearchQuery(stock.symbol.replace(".NS", ""));

      setSearchResults([]);

      setSearchLoading(false);
    } catch (error) {
      console.error("Failed to load stock:", error);
    }
  };

  // =====================================================
  // WATCHLIST TOGGLE
  // =====================================================

  const handleWatchlistToggle = async (e) => {
    // Card par navigate onClick hai, isliye ye zaroori hai
    e.stopPropagation();

    if (!selectedStock?.stock_id) {
      setWatchlistError("Stock information is unavailable.");
      return;
    }

    try {
      setWatchlistLoading(true);
      setWatchlistError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWatchlistError("Please log in to manage your watchlist.");
        return;
      }

      if (isWatchlisted) {
        await removeFromWatchlist(user.id, selectedStock.stock_id);
        setIsWatchlisted(false);
      } else {
        await addToWatchlist(user.id, selectedStock.stock_id);
        setIsWatchlisted(true);
      }
    } catch (error) {
      console.error("Watchlist update failed:", error);
      setWatchlistError("Unable to update watchlist.");
    } finally {
      setWatchlistLoading(false);
    }
  };
  // =====================================================
  // OPEN PAPER TRADE
  // =====================================================

  const handleOpenTrade = (stock) => {
    setTradeStock(stock);

    // Start with quantity mode
    // for a stock searched directly.
    setTradeMode("quantity");

    setTradeQuantity(1);
    setTradeAmount("");
    setTradeError("");
  };

  // =====================================================
  // CLOSE PAPER TRADE
  // =====================================================

  const handleCloseTrade = () => {
    if (tradeLoading) {
      return;
    }

    setTradeStock(null);
    setTradeMode("quantity");
    setTradeQuantity(1);
    setTradeAmount("");
    setTradeError("");
  };

  // =====================================================
  // PAPER TRADE CALCULATIONS
  // =====================================================

  const tradePrice = tradeStock ? Number(tradeStock.price) : 0;

  const enteredAmount = Number(tradeAmount);

  const calculatedQuantity =
    tradeMode === "amount"
      ? tradePrice > 0 && Number.isFinite(enteredAmount) && enteredAmount > 0
        ? Math.floor(enteredAmount / tradePrice)
        : 0
      : tradeQuantity;

  const estimatedTradeValue = tradePrice * calculatedQuantity;

  const remainingAmount =
    tradeMode === "amount" && enteredAmount > 0 && calculatedQuantity > 0
      ? Math.max(0, enteredAmount - estimatedTradeValue)
      : 0;

  // =====================================================
  // CONFIRM BUY
  // =====================================================

  const handleConfirmBuy = async () => {
    if (!tradeStock) {
      return;
    }

    let quantity;

    // =================================================
    // INVEST BY AMOUNT
    // =================================================

    if (tradeMode === "amount") {
      const amount = Number(tradeAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        setTradeError("Please enter a valid investment amount.");
        return;
      }

      if (!Number.isFinite(tradePrice) || tradePrice <= 0) {
        setTradeError("Stock price is not available.");
        return;
      }

      // Whole-share execution.
      quantity = Math.floor(amount / tradePrice);

      if (quantity < 1) {
        setTradeError(
          `Minimum amount required for 1 share is ${formatINR(tradePrice)}.`,
        );
        return;
      }
    } else {
      // =================================================
      // BUY BY SHARES
      // =================================================

      quantity = Math.floor(Number(tradeQuantity));

      if (!Number.isInteger(quantity) || quantity <= 0) {
        setTradeError("Number of shares must be greater than 0.");
        return;
      }
    }

    try {
      setTradeLoading(true);
      setTradeError("");

      // =================================================
      // EXECUTE EXISTING PAPER TRADE
      // =================================================

      await buyStock(tradeStock.stock_id, quantity);

      // =================================================
      // REFRESH WALLET
      // =================================================

      const updatedPortfolio = await getPortfolioSummary();

      setPortfolio(updatedPortfolio);

      // =================================================
      // CLOSE MODAL
      // =================================================

      setTradeStock(null);
      setTradeMode("quantity");
      setTradeQuantity(1);
      setTradeAmount("");
      setTradeError("");
    } catch (error) {
      console.error("Paper BUY failed:", error);

      setTradeError(
        error instanceof Error
          ? error.message
          : "Could not complete paper trade.",
      );
    } finally {
      setTradeLoading(false);
    }
  };

  const handleCloseAddFunds = () => {
    if (addLoading) return;
    setAddFundsOpen(false);
    setAddAmount("");
    setAddError("");
  };

  const handleAddFunds = async () => {
    const amount = Number(addAmount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 1000000) {
      setAddError("Enter an amount between ₹100 and ₹10,00,000.");
      return;
    }

    try {
      setAddLoading(true);
      setAddError("");

      await addFunds(amount);

      const updatedPortfolio = await getPortfolioSummary();
      setPortfolio(updatedPortfolio);

      setAddFundsOpen(false);
      setAddAmount("");
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Could not add funds.",
      );
    } finally {
      setAddLoading(false);
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

  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // =====================================================
  // REGULAR NSE TRADING HOURS (display only, IST)
  // Exchange holidays are not reflected.
  // =====================================================

  const istNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const istMinutes = istNow.getHours() * 60 + istNow.getMinutes();
  const istDay = istNow.getDay();
  const inTradingHours =
    istDay >= 1 && istDay <= 5 && istMinutes >= 555 && istMinutes < 930;

  // =====================================================
  // MARKET INDICES (shown in the top bar on wide screens,
  // in a slim strip on smaller ones)
  // =====================================================

  const marketIndices = (
    <div className="flex shrink-0 items-center gap-5">
      <IndexChip label="NIFTY 50" data={nifty} />

      <span aria-hidden="true" className="h-4 w-px bg-slate-300/70" />

      <IndexChip label="SENSEX" data={sensex} />

      <span aria-hidden="true" className="h-4 w-px bg-slate-300/70" />

      <div
        className="flex items-center gap-2 text-sm"
        title="Regular NSE hours: Mon–Fri, 9:15 AM–3:30 PM IST. Exchange holidays aren't reflected."
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${inTradingHours ? "bg-emerald-500" : "bg-slate-300"
            }`}
        />

        <span className="font-medium text-slate-600">
          {inTradingHours ? "Market hours" : "Off hours"}
        </span>
      </div>
    </div>
  );

  // =====================================================
  // TODAY'S % CHANGE COMPARISON (existing values only)
  // Portfolio sign follows today_pnl, same as the P&L card.
  // =====================================================

  const toPercent = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const compareRows = [
    {
      label: "Your portfolio",
      loading: !portfolio,
      value: portfolio
        ? (() => {
          const pct = toPercent(portfolio.today_pnl_percent);
          return pct == null
            ? null
            : (portfolio.today_pnl >= 0 ? 1 : -1) * Math.abs(pct);
        })()
        : null,
    },
    {
      label: "NIFTY 50",
      loading: !nifty,
      value: nifty ? toPercent(nifty.changePercent) : null,
    },
    {
      label: "SENSEX",
      loading: !sensex,
      value: sensex ? toPercent(sensex.changePercent) : null,
    },
  ];

  const compareMax = Math.max(
    0.5,
    ...compareRows.map((row) => (row.value == null ? 0 : Math.abs(row.value))),
  );

  // =====================================================
  // MOVERS CHART DATA (same gainers/losers the lists use)
  // Signs follow the lists: gainers up, losers down.
  // =====================================================

  const moverChartData = marketMovers
    ? [
      ...(marketMovers.gainers?.slice(0, 5) || []).map((stock) => ({
        symbol: stock.symbol,
        label: stock.symbol.replace(".NS", ""),
        value: Math.abs(Number(stock.change_percent)),
      })),
      ...(marketMovers.losers?.slice(0, 5) || []).map((stock) => ({
        symbol: stock.symbol,
        label: stock.symbol.replace(".NS", ""),
        value: -Math.abs(Number(stock.change_percent)),
      })),
    ]
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => b.value - a.value)
    : null;

  // =====================================================
  // KEY TERMS (static definitions)
  // =====================================================

  const keyTerms = [
    {
      term: "NIFTY 50",
      meaning: "An index tracking 50 large companies listed on the NSE.",
    },
    {
      term: "SENSEX",
      meaning: "An index tracking 30 large companies listed on the BSE.",
    },
    {
      term: "P&L",
      meaning: "Profit or loss: what you have gained or lost versus what you paid.",
    },
    {
      term: "Volume",
      meaning: "How many shares have changed hands today.",
    },
    {
      term: "Paper trading",
      meaning: "Practising with virtual money. No real funds are involved.",
    },
  ];

  // =====================================================
  // NAV ITEMS (same labels, same order, same routes)
  // =====================================================



  // Shared market stat definitions for the selected-stock card
  const stockStats = selectedStock
    ? [
      {
        label: "Previous Close",
        value: formatINR(selectedStock.previousClose),
        hint: "Price at the end of the previous trading day",
      },
      {
        label: "Open",
        value: formatINR(selectedStock.open),
        hint: "Price at the start of today's trading",
      },
      {
        label: "Day High",
        value: formatINR(selectedStock.dayHigh),
        hint: "Highest price today",
      },
      {
        label: "Day Low",
        value: formatINR(selectedStock.dayLow),
        hint: "Lowest price today",
      },
      {
        label: "Volume",
        value: formatVolume(selectedStock.volume),
        hint: "Number of shares traded today",
      },
      {
        label: "Market Cap",
        value: formatMarketCap(selectedStock.marketCap),
        hint: "Total market value of all the company's shares",
      },
      {
        label: "Exchange",
        value: displayExchange(selectedStock.exchange, selectedStock.symbol),
        hint: "The stock exchange where this stock is listed",
      },
    ]
    : [];

  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] focus-visible:ring-offset-1";

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#FAF9F5] font-sans">
        {/* =====================================================
            SIDEBAR
        ===================================================== */}

        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onDashboardClick={() => {
            setSelectedStock(null);
            setSearchQuery("");
            setSearchResults([]);
          }}
        />

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <div className="flex flex-1 flex-col">
          {/* =====================================================
              TOP BAR
          ===================================================== */}

          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
            {/* Left */}

            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {/* Hamburger */}

              <button
                onClick={() => setSidebarOpen(true)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
                aria-label="Open menu"
                title="Menu"
              >
                <FiMenu size={20} />
              </button>

              {/* Search */}

              <div className="relative w-full max-w-xs">
                <FiSearch
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Search stocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search stocks"
                  className="w-full rounded-lg border border-slate-200 bg-[#FAFBFD] py-1.5 pr-8 pl-9 text-sm transition focus:border-[#0F4C3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C3A]/10 motion-reduce:transition-none"
                />

                {searchLoading && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-[#0F4C3A] motion-reduce:animate-none"
                  />
                )}

                {searchQuery && (searchResults.length > 0 || searchLoading) && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                  >
                    {searchLoading && (
                      <p className="px-3 py-2.5 text-sm text-slate-400">
                        Searching...
                      </p>
                    )}

                    {!searchLoading && searchResults.length === 0 && (
                      <p className="px-3 py-2.5 text-sm text-slate-400">
                        No stocks found
                      </p>
                    )}

                    {!searchLoading &&
                      searchResults.map((stock) => (
                        <button
                          key={stock.symbol}
                          onClick={() => handleStockSelect(stock)}
                          className="flex w-full cursor-pointer items-baseline gap-2 px-3 py-2 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none motion-reduce:transition-none"
                        >
                          <span className="shrink-0 text-sm font-semibold text-slate-900">
                            {stock.symbol.replace(".NS", "")}
                          </span>

                          <span className="truncate text-xs text-slate-400">
                            {stock.name}
                          </span>
                        </button>
                      ))}
                  </motion.div>
                )}
              </div>

              <div className="ml-2 hidden shrink-0 xl:block">
                {marketIndices}
              </div>
            </div>

            {/* Right */}

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Wallet */}

              <button
                type="button"
                onClick={() => navigate("/wallet")}
                aria-label="Open wallet"
                title="Wallet balance"
                className="flex items-center gap-2 rounded-full bg-[#F1F8F4] py-1 pr-3 pl-1 text-sm font-semibold text-[#0F4C3A] tabular-nums transition hover:bg-[#E4F1EA] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F4C3A] text-white">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="6" width="18" height="14" rx="3" />
                    <path d="M7 6V5a2 2 0 0 1 2-2h8" />
                    <path d="M17 13h.01" />
                  </svg>
                </span>

                {portfolio ? (
                  `₹${Number(portfolio.available_balance).toLocaleString(
                    "en-IN",
                    { minimumFractionDigits: 2 },
                  )}`
                ) : (
                  <span className="h-4 w-20 animate-pulse rounded bg-emerald-100 motion-reduce:animate-none" />
                )}
              </button>

              {/* Notification */}

              <button
                type="button"
                title="Notifications"
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF8E8] text-amber-700 transition hover:bg-[#FFF1D1] active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
                aria-label="Notifications"
              >
                <FiBell size={16} />
              </button>

              {/* Profile */}

              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-[#0F4C3A] transition hover:ring-2 hover:ring-emerald-200 motion-reduce:transition-none ${focusRing}`}
                  aria-label="Open profile menu"
                  aria-expanded={profileOpen}
                >
                  {initials ? initials.toUpperCase() : "U"}
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-11 right-0 z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      {/* User Info */}

                      <div className="border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-[#0F4C3A]">
                            {initials ? initials.toUpperCase() : "U"}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {firstName === "there" ? "User" : firstName}
                            </p>

                            <p className="truncate text-xs text-slate-400">
                              {profile?.email}
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
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 motion-reduce:transition-none"
                      >
                        <FiSettings size={16} />
                        Settings
                      </button>

                      {/* Logout */}

                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 motion-reduce:transition-none"
                      >
                        <FiLogOut size={16} />
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* =====================================================
              DASHBOARD
          ===================================================== */}

          {/* Market indices strip (smaller screens; wide screens show them in the top bar) */}

          <div className="border-b border-emerald-900/10 bg-[#F1F8F4]/70 xl:hidden">
            <div className="flex h-11 items-center overflow-x-auto px-4 whitespace-nowrap md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {marketIndices}
            </div>
          </div>

          <main className="w-full flex-1 space-y-3 px-4 py-3 md:px-6">
            {/* Greeting */}

            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h1 className="font-serif text-3xl font-semibold text-slate-900">
                Hello, {firstName} 👋
              </h1>

              <p className="pb-1 text-xs font-bold tracking-widest text-slate-400 uppercase">
                {today}
              </p>
            </div>

            {/* =================================================
                SELECTED STOCK
            ================================================= */}

            {selectedStock && (
              <motion.div
                key={selectedStock.symbol}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => navigate(`/stock/${selectedStock.symbol}`)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm motion-reduce:transition-none"
              >
                {/* Header */}

                <div className="flex items-start justify-between gap-4">
                  {/* Stock Information */}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-2xl font-bold text-slate-900">
                        {selectedStock.symbol.replace(".NS", "")}
                      </h2>

                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {displayExchange(
                          selectedStock.exchange,
                          selectedStock.symbol,
                        )}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-sm text-slate-400">
                      {selectedStock.company || "Company name unavailable"}
                      <span className="text-xs text-slate-300"> · </span>
                      <span className="text-xs">{selectedStock.symbol}</span>
                    </p>
                  </div>

                  {/* Current Price */}

                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {formatINR(selectedStock.price)}
                    </p>

                    {selectedStock.change != null &&
                      selectedStock.changePercent != null && (
                        <p
                          className={`mt-0.5 text-sm font-semibold tabular-nums ${Number(selectedStock.change) >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                            }`}
                        >
                          {Number(selectedStock.change) >= 0 ? "▲" : "▼"}{" "}
                          {Number(selectedStock.change) >= 0 ? "+" : "-"}₹
                          {Math.abs(Number(selectedStock.change)).toFixed(2)} (
                          {Math.abs(
                            Number(selectedStock.changePercent),
                          ).toFixed(2)}
                          %)
                          {" today"}
                        </p>
                      )}
                  </div>
                </div>

                {/* Market Statistics */}

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3 sm:grid-cols-4 lg:grid-cols-7">
                  {stockStats.map((stat) => (
                    <div key={stat.label} title={stat.hint}>
                      <p className="text-xs text-slate-400">{stat.label}</p>

                      <p className="mt-0.5 text-sm font-semibold text-slate-800 tabular-nums">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Actions */}

                <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleWatchlistToggle}
                    disabled={watchlistLoading || !selectedStock.stock_id}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <span
                      className={`text-base ${isWatchlisted ? "text-amber-500" : ""
                        }`}
                    >
                      {isWatchlisted ? "★" : "☆"}
                    </span>

                    {watchlistLoading
                      ? isWatchlisted
                        ? "Removing..."
                        : "Adding..."
                      : isWatchlisted
                        ? "In Watchlist"
                        : "Add to Watchlist"}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      handleOpenTrade(selectedStock);
                    }}
                    className="flex-1 rounded-lg bg-[#0F4C3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B3528] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    Paper Trade
                  </button>
                </div>

                {watchlistError && (
                  <p
                    role="alert"
                    className="mt-2 text-xs text-red-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {watchlistError}
                  </p>
                )}
              </motion.div>
            )}

            {/* =================================================
                STAT CARDS
            ================================================= */}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Portfolio */}

              <StatCard
                label="Total Portfolio Value"
                value={
                  portfolio ? (
                    `₹${Number(portfolio.total_value).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}`
                  ) : (
                    <Skeleton className="h-8 w-36" />
                  )
                }
                sub={
                  portfolio ? (
                    <p
                      className={`text-xs font-semibold tabular-nums ${portfolio.overall_pnl >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                        }`}
                    >
                      {`${portfolio.overall_pnl >= 0 ? "▲ +" : "▼ -"}₹${Math.abs(
                        Number(portfolio.overall_pnl),
                      ).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })} overall`}
                    </p>
                  ) : (
                    <Skeleton className="h-3.5 w-24" />
                  )
                }
              />

              {/* Today's P&L */}

              <StatCard
                label="Today's P&L"
                value={
                  portfolio ? (
                    `${portfolio.today_pnl >= 0 ? "+" : "-"}₹${Math.abs(
                      Number(portfolio.today_pnl),
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}`
                  ) : (
                    <Skeleton className="h-8 w-32" />
                  )
                }
                sub={
                  portfolio ? (
                    <p
                      className={`text-xs font-semibold tabular-nums ${portfolio.today_pnl >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                        }`}
                    >
                      {`${portfolio.today_pnl >= 0 ? "▲ +" : "▼ "}${Math.abs(
                        Number(portfolio.today_pnl_percent),
                      ).toFixed(2)}% today`}
                    </p>
                  ) : (
                    <Skeleton className="h-3.5 w-20" />
                  )
                }
              />

              {/* Market */}

              <StatCard
                label="Market Today"
                value={
                  nifty?.price ? (
                    `₹${Number(nifty.price).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}`
                  ) : (
                    <Skeleton className="h-8 w-32" />
                  )
                }
                sub={
                  nifty ? (
                    <p
                      className={`text-xs font-semibold tabular-nums ${nifty.changePercent >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                        }`}
                    >
                      {`${nifty.changePercent >= 0 ? "▲ +" : "▼ -"}${Math.abs(
                        nifty.changePercent,
                      ).toFixed(2)}% today`}
                    </p>
                  ) : (
                    <Skeleton className="h-3.5 w-20" />
                  )
                }
                footnote="NIFTY 50"
              />

              {/* Wallet */}

              <StatCard
                label="Available Balance"
                value={
                  portfolio ? (
                    `₹${Number(portfolio.available_balance).toLocaleString(
                      "en-IN",
                      { minimumFractionDigits: 2 },
                    )}`
                  ) : (
                    <Skeleton className="h-8 w-32" />
                  )
                }
                sub={
                  <button
                    type="button"
                    onClick={() => navigate("/wallet")}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0F4C3A] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]"
                  >
                    Open wallet
                    <FiChevronRight size={13} />
                  </button>
                }
                footnote="Virtual funds"
              />
            </div>


            {/* =================================================
                MARKET STOCKS
            ================================================= */}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-stretch">
              <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold text-slate-900">
                    Market Stocks
                  </h2>

                  <p className="text-xs text-slate-400">Latest market prices</p>
                </div>

                {!marketMovers ? (
                  <div
                    className="grid grid-cols-1 gap-4 md:grid-cols-2"
                    aria-busy="true"
                    aria-label="Loading stocks"
                  >
                    {[0, 1].map((col) => (
                      <div key={col} className="space-y-1.5">
                        <Skeleton className="mb-2 h-4 w-24" />

                        {[0, 1, 2, 3, 4].map((row) => (
                          <Skeleton key={row} className="h-[50px] w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* TOP GAINERS */}

                    <MoverColumn
                      title="Top Gainers"
                      stocks={marketMovers.gainers}
                      positive={true}
                      onSelect={handleStockSelect}
                    />

                    {/* TOP LOSERS */}

                    <MoverColumn
                      title="Top Losers"
                      stocks={marketMovers.losers}
                      positive={false}
                      onSelect={handleStockSelect}
                    />
                  </div>
                )}
              </div>

              {/* =================================================
                YOU VS MARKET (today's % change)
            ================================================= */}

              <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold text-slate-900">
                    You vs Market
                  </h2>

                  <p className="text-xs text-slate-400">% change today</p>
                </div>

                <div className="flex flex-1 flex-col justify-around gap-3">
                  {compareRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3"
                    >
                      <span className="truncate text-sm text-slate-600">
                        {row.label}
                      </span>

                      <div className="relative h-2 rounded-full bg-slate-100">
                        <span
                          aria-hidden="true"
                          className="absolute top-[-3px] bottom-[-3px] left-1/2 w-px bg-slate-300"
                        />

                        {row.value != null && (
                          <span
                            aria-hidden="true"
                            className={`absolute top-0 h-2 rounded-full transition-[width] duration-500 motion-reduce:transition-none ${row.value >= 0
                                ? "left-1/2 bg-emerald-500"
                                : "right-1/2 bg-red-500"
                              }`}
                            style={{
                              width: `${Math.min(
                                50,
                                (Math.abs(row.value) / compareMax) * 50,
                              )}%`,
                            }}
                          />
                        )}
                      </div>

                      <span
                        className={`text-right text-sm font-semibold tabular-nums ${row.value == null
                            ? "text-slate-400"
                            : row.value >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                      >
                        {row.loading ? (
                          <Skeleton className="ml-auto h-3.5 w-12" />
                        ) : row.value == null ? (
                          "N/A"
                        ) : (
                          `${row.value >= 0 ? "+" : "-"}${Math.abs(
                            row.value,
                          ).toFixed(2)}%`
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* =================================================
              MOVERS CHART + KEY TERMS
          ================================================= */}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-stretch">
              <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold text-slate-900">
                    Movers at a Glance
                  </h2>

                  <p className="text-xs text-slate-400">% change today</p>
                </div>

                {!moverChartData ? (
                  <Skeleton className="h-56 w-full" />
                ) : moverChartData.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-10 text-center text-xs text-slate-400">
                    Nothing to show right now.
                  </p>
                ) : (
                  <MoversChart data={moverChartData} onSelect={handleStockSelect} />
                )}
              </div>

              <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold text-slate-900">
                    Key Terms
                  </h2>

                  <button
                    type="button"
                    onClick={() => navigate("/learn")}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0F4C3A] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]"
                  >
                    More in Learn
                    <FiChevronRight size={13} />
                  </button>
                </div>

                <dl className="flex flex-1 flex-col justify-between divide-y divide-slate-100">
                  {keyTerms.map((item) => (
                    <div key={item.term} className="py-2 first:pt-0 last:pb-0">
                      <dt className="text-sm font-semibold text-slate-900">
                        {item.term}
                      </dt>

                      <dd className="mt-0.5 text-xs text-slate-500">
                        {item.meaning}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </main>
        </div>

        {/* =====================================================
            PAPER TRADE MODAL
        ===================================================== */}

        <AnimatePresence>
          {tradeStock && (
            <motion.div
              key="trade-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  handleCloseTrade();
                }
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`Paper trade ${tradeStock.symbol.replace(".NS", "")}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
              >
                {/* Header */}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                      Paper Trade
                    </p>

                    <h2 className="mt-0.5 text-2xl font-bold text-[#0B3528]">
                      {tradeStock.symbol.replace(".NS", "")}
                    </h2>

                    <p className="truncate text-sm text-gray-500">
                      {tradeStock.company || tradeStock.name || "Stock"}
                    </p>
                  </div>

                  <button
                    onClick={handleCloseTrade}
                    disabled={tradeLoading}
                    aria-label="Close"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* Current Price */}

                <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1F8F4] px-4 py-3">
                  <p className="text-xs text-gray-500">Current price</p>

                  <p className="text-xl font-bold text-[#0F4C3A] tabular-nums">
                    {formatINR(tradePrice)}
                  </p>
                </div>

                {/* Buy Mode */}

                <div className="mt-4">
                  <p className="text-sm font-semibold text-[#0B3528]">Buy by</p>

                  <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                    {/* Invest by ₹ */}

                    <button
                      type="button"
                      onClick={() => {
                        if (tradeMode === "quantity" && tradePrice > 0) {
                          const quantity = Math.max(
                            1,
                            Math.floor(Number(tradeQuantity) || 1),
                          );

                          setTradeAmount((quantity * tradePrice).toFixed(2));
                        }

                        setTradeMode("amount");

                        setTradeError("");
                      }}
                      disabled={tradeLoading}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition motion-reduce:transition-none ${tradeMode === "amount"
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
                        if (
                          tradeMode === "amount" &&
                          tradePrice > 0 &&
                          Number.isFinite(enteredAmount) &&
                          enteredAmount > 0
                        ) {
                          setTradeQuantity(
                            Math.max(1, Math.floor(enteredAmount / tradePrice)),
                          );
                        }

                        setTradeMode("quantity");

                        setTradeAmount("");

                        setTradeError("");
                      }}
                      disabled={tradeLoading}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition motion-reduce:transition-none ${tradeMode === "quantity"
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
                    htmlFor="dashboard-trade-input"
                    className="text-sm font-semibold text-[#0B3528]"
                  >
                    {tradeMode === "amount"
                      ? "How much do you want to invest?"
                      : "How many shares do you want to buy?"}
                  </label>

                  {tradeMode === "amount" ? (
                    <div className="mt-1.5 flex items-center rounded-xl border border-gray-200 px-4 transition focus-within:border-[#0F4C3A] focus-within:ring-2 focus-within:ring-[#0F4C3A]/10 motion-reduce:transition-none">
                      <span className="text-sm font-semibold text-gray-500">
                        ₹
                      </span>

                      <input
                        id="dashboard-trade-input"
                        type="number"
                        min="1"
                        step="1"
                        value={tradeAmount}
                        onChange={(e) => {
                          setTradeAmount(e.target.value);

                          setTradeError("");
                        }}
                        disabled={tradeLoading}
                        placeholder="Enter amount in ₹"
                        className="w-full border-0 px-2 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <input
                      id="dashboard-trade-input"
                      type="number"
                      min="1"
                      step="1"
                      value={tradeQuantity}
                      onChange={(e) => {
                        const value = Math.floor(Number(e.target.value) || 1);

                        setTradeQuantity(Math.max(1, value));

                        setTradeError("");
                      }}
                      disabled={tradeLoading}
                      placeholder="Enter number of shares"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10 focus:outline-none disabled:bg-gray-100 motion-reduce:transition-none"
                    />
                  )}
                </div>

                {/* Review */}

                <div className="mt-4 space-y-2 rounded-xl border border-gray-100 px-4 py-3 tabular-nums">
                  {/* Budget */}

                  {tradeMode === "amount" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Your budget</span>

                      <span className="font-semibold text-[#0B3528]">
                        ₹
                        {Number.isFinite(enteredAmount)
                          ? enteredAmount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                          : "0.00"}
                      </span>
                    </div>
                  )}

                  {/* Shares */}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shares to buy</span>

                    <span className="font-semibold text-[#0B3528]">
                      {calculatedQuantity}
                    </span>
                  </div>

                  {/* Actual Investment */}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Amount actually invested
                    </span>

                    <span className="font-semibold text-[#0B3528]">
                      {formatINR(estimatedTradeValue)}
                    </span>
                  </div>

                  {/* Remaining Budget */}

                  {tradeMode === "amount" && calculatedQuantity > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Unused amount</span>

                      <span className="font-semibold text-gray-500">
                        {formatINR(remainingAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Error */}

                {tradeError && (
                  <div
                    role="alert"
                    className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5"
                  >
                    <p className="text-sm text-red-600">{tradeError}</p>
                  </div>
                )}

                {/* Actions */}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={handleCloseTrade}
                    disabled={tradeLoading}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleConfirmBuy}
                    disabled={tradeLoading || calculatedQuantity < 1}
                    className="flex-1 rounded-xl bg-[#0F4C3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B3528] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    {tradeLoading
                      ? "Processing..."
                      : calculatedQuantity >= 1
                        ? `Confirm Buy — ${formatINR(estimatedTradeValue)}`
                        : "Confirm Buy"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}