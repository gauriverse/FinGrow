import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../lib/supabase";
import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  getStockId,
} from "../../services/watchlist";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";

interface StockData {
  symbol: string;
  company: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: string | null;
  exchange: string | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  bookValue: number | null;
  priceToBook: number | null;
  returnOnEquity: number | null;
  sector: string | null;
  industry: string | null;
}

interface AiSignal {
  prediction: string;
  confidence: number | null;
}

interface Indicators {
  rsi: number | null;
  macd: number | null;
}

interface Position {
  quantity: number;
  avgBuy: number;
}

interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
}

interface HistoryResponse {
  symbol: string;
  period: string;
  data: HistoryPoint[];
}


const API = "http://127.0.0.1:8000/market";

// =====================================================
// PRESENTATION HELPERS (UI only)
// =====================================================

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

const PRESS = "motion-safe:active:scale-[0.97]";

const CARD = "bg-white rounded-xl border border-slate-200";

const POSITIVE = "#059669";
const NEGATIVE = "#DC2626";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

const RANGE_OPTIONS = ["1W", "1M", "6M", "1Y"];

// Label above value (used for the fundamentals grid).
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>

      <p
        className="mt-0.5 text-sm font-semibold text-slate-800 tabular-nums truncate"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

// Display-only: how far the current price is below the 52-week high.
const highNote = (
  price: number | null,
  high: number | null
): string | undefined => {
  if (price == null || high == null || Number.isNaN(price) || !(high > 0)) {
    return undefined;
  }

  return price >= high
    ? "At 52-week high"
    : `${(((high - price) / high) * 100).toFixed(1)}% below 52-week high`;
};

// Display-only: shows where the current price sits between a low and a
// high that the API already returned. Hidden if any value is missing.
function RangeBar({
  label,
  low,
  high,
  current,
  fmt,
  note,
}: {
  label: string;
  low: number | null;
  high: number | null;
  current: number | null;
  fmt: (value: number | null) => string;
  note?: string;
}) {
  if (
    low == null ||
    high == null ||
    current == null ||
    Number.isNaN(low) ||
    Number.isNaN(high) ||
    Number.isNaN(current) ||
    high <= low
  ) {
    return null;
  }

  const pct = Math.min(
    100,
    Math.max(0, ((current - low) / (high - low)) * 100)
  );

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div
        className="relative mt-2 h-1.5 rounded-full bg-slate-100"
        role="img"
        aria-label={`${label}: the current price is ${pct.toFixed(
          0
        )} percent of the way from the low to the high`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#0F4C3A]/25 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />

        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0F4C3A] shadow transition-[left] duration-500 motion-reduce:transition-none"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-slate-600">
        <span>{fmt(low)}</span>
        <span>{fmt(high)}</span>
      </div>

      {note && <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

export default function StockDetails() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState("1Y");

  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [stockId, setStockId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const [aiSignal, setAiSignal] = useState<AiSignal | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  useEffect(() => {
    const fetchStock = async () => {
      if (!symbol) return;

      try {
        setLoading(true);
        setError("");

        // Fetch current stock data
        const response = await axios.get(`${API}/stock/${symbol}`);

        setStock(response.data);

         // Fetch historical price data
        const historyResponse = await axios.get<HistoryResponse>(
          `${API}/history/${symbol}`,
        );

        setHistory(historyResponse.data.data);
      } catch (err) {
  console.error("Failed to load stock:", err);

  if (axios.isAxiosError(err)) {
    console.error("API error:", err.response?.data);
    console.error("Status:", err.response?.status);
  }

  setError("Unable to load stock data.");
} finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [symbol]);

  useEffect(() => {
  const checkWatchlist = async () => {
    if (!symbol) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsWatchlisted(false);
        return;
      }

      const id = await getStockId(symbol);
      setStockId(id);

      if (!id) {
        setIsWatchlisted(false);
        return;
      }

      const exists = await isInWatchlist(user.id, id);
      setIsWatchlisted(exists);
    } catch (err) {
      console.error("Failed to check watchlist:", err);
    }
  };

  checkWatchlist();
}, [symbol]);

  // Extra read-only info for this stock (own AI signal, latest RSI/MACD,
  // own holding). Any failure just hides the block; nothing else is affected.
  useEffect(() => {
    if (!stockId) return;

    let cancelled = false;

    const loadExtras = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) return;

        const toNum = (v: unknown) => {
          const n = Number(v);
          return v == null || Number.isNaN(n) ? null : n;
        };

        const [ai, ind, pos] = await Promise.all([
          supabase
            .from("ai_predictions")
            .select("prediction, confidence")
            .eq("user_id", user.id)
            .eq("stock_id", stockId)
            .maybeSingle(),
          supabase
            .from("technical_indicators")
            .select("rsi, macd")
            .eq("stock_id", stockId)
            .order("indicator_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("portfolio")
            .select("quantity, buy_price")
            .eq("user_id", user.id)
            .eq("stock_id", stockId),
        ]);

        if (cancelled) return;

        setAiSignal(
          ai.data?.prediction
            ? {
                prediction: String(ai.data.prediction).toUpperCase(),
                confidence: toNum(ai.data.confidence),
              }
            : null
        );

        setIndicators(
          ind.data
            ? { rsi: toNum(ind.data.rsi), macd: toNum(ind.data.macd) }
            : null
        );

        const rows = (pos.data ?? []) as {
          quantity: number | string;
          buy_price: number | string;
        }[];

        const qty = rows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
        const cost = rows.reduce(
          (sum, r) => sum + Number(r.quantity || 0) * Number(r.buy_price || 0),
          0
        );

        setPosition(qty > 0 ? { quantity: qty, avgBuy: cost / qty } : null);
      } catch (err) {
        console.error("Failed to load extra stock info:", err);
      }
    };

    loadExtras();

    return () => {
      cancelled = true;
    };
  }, [stockId]);

const handleWatchlistToggle = async () => {
  try {
    setWatchlistLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please log in to manage your watchlist.");
      return;
    }

    if (!stockId) {
      setError("Stock information is unavailable.");
      return;
    }

    if (isWatchlisted) {
      await removeFromWatchlist(user.id, stockId);
      setIsWatchlisted(false);
    } else {
      await addToWatchlist(user.id, stockId);
      setIsWatchlisted(true);
    }
  } catch (err) {
    console.error("Watchlist update failed:", err);
    setError("Unable to update watchlist.");
  } finally {
    setWatchlistLoading(false);
  }
};

  const formatINR = (value: number | null) => {
    if (value == null || Number.isNaN(value)) {
      return "N/A";
    }

    return `₹${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatVolume = (value: number | null) => {
    if (value == null || Number.isNaN(value)) {
      return "N/A";
    }

    if (value >= 1e7) {
      return `${(value / 1e7).toFixed(2)} Cr`;
    }

    if (value >= 1e5) {
      return `${(value / 1e5).toFixed(2)} L`;
    }

    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)} K`;
    }

    return value.toLocaleString("en-IN");
  };

  const formatMarketCap = (value: number | null) => {
    if (value == null || Number.isNaN(value)) {
      return "N/A";
    }

    if (value >= 1e12) {
      return `₹${(value / 1e12).toFixed(2)} L Cr`;
    }

    if (value >= 1e7) {
      return `₹${(value / 1e7).toFixed(2)} Cr`;
    }

    return `₹${value.toLocaleString("en-IN")}`;
  };

  const displayExchange = (exchange: string | null, symbol: string) => {
    if (symbol.endsWith(".NS")) return "NSE";
    if (symbol.endsWith(".BO")) return "BSE";

    return exchange || "N/A";
  };

  // Filter historical data according to selected range
  const chartData = useMemo(() => {
    if (!history.length) {
      return [];
    }

    const daysMap: Record<string, number> = {
      "1W": 7,
      "1M": 30,
      "6M": 180,
      "1Y": 365,
    };

    const days = daysMap[selectedRange] || 365;

    return history.slice(-days);
  }, [history, selectedRange]);

  // =====================================================
  // PRESENTATION ONLY — everything below just lays out the
  // data and handlers defined above.
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-4 md:px-6">
        <div
          className="mx-auto max-w-6xl space-y-3"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading stock data...</span>

          <div className="h-5 w-36 rounded bg-slate-200 animate-pulse motion-reduce:animate-none" />

          <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse motion-reduce:animate-none" />

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse motion-reduce:animate-none lg:col-span-2" />
            <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse motion-reduce:animate-none" />
          </div>

          <div className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => navigate("/dashboard")}
            className={`mb-3 rounded text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 ${FOCUS}`}
          >
            ← Back to Dashboard
          </button>

          <div
            role="alert"
            className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-4`}
          >
            <p className="text-sm font-medium text-red-600">
              {error || "Stock data unavailable."}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${PRESS} ${FOCUS}`}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display-only: change over the selected range, from the same
  // history points the chart already uses.
  const firstPoint = chartData[0];
  const lastPoint = chartData[chartData.length - 1];

  const periodChange =
    chartData.length > 1 && firstPoint.close
      ? ((lastPoint.close - firstPoint.close) / firstPoint.close) * 100
      : null;

  const lineColor =
    periodChange === null || periodChange >= 0 ? POSITIVE : NEGATIVE;

  // Display-only: high / low of the closing prices in the selected range,
  // and the date of the latest close, from the same history points.
  const closes = chartData.map((point) => point.close);
  const periodLow = closes.length ? Math.min(...closes) : null;
  const periodHigh = closes.length ? Math.max(...closes) : null;

  const latestCloseDate = chartData.length
    ? new Date(lastPoint.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-slate-50 px-4 py-3 md:px-6 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col lg:min-h-full">

          {/* TOP ROW: back + watchlist */}

          <div className="mb-1.5 flex items-center justify-between gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className={`rounded text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 ${FOCUS}`}
            >
              ← Back to Dashboard
            </button>

            <button
              type="button"
              onClick={handleWatchlistToggle}
              disabled={watchlistLoading || !stockId}
              aria-pressed={isWatchlisted}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${PRESS} ${FOCUS}`}
            >
              <span
                aria-hidden="true"
                className={`text-base leading-none ${
                  isWatchlisted ? "text-amber-500" : ""
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
          </div>

          {/* HEADER: name + price */}

          <motion.section
            className={`${CARD} px-4 py-2.5`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    {stock.symbol.replace(".NS", "")}
                  </h1>

                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {displayExchange(stock.exchange, stock.symbol)}
                  </span>
                </div>

                <p className="mt-0.5 truncate text-sm text-slate-400">
                  {stock.company || "Company name unavailable"}
                  <span className="text-xs"> · {stock.symbol}</span>
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
                  {formatINR(stock.price)}
                </p>

                {stock.change != null && stock.changePercent != null && (
                  <p
                    className={`mt-0.5 text-sm font-semibold tabular-nums ${
                      stock.change >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    <span aria-hidden="true">
                      {stock.change >= 0 ? "▲" : "▼"}
                    </span>{" "}
                    {stock.change >= 0 ? "+" : "-"}₹
                    {Math.abs(stock.change).toFixed(2)} (
                    {Math.abs(stock.changePercent).toFixed(2)}%)
                  </p>
                )}
              </div>

            </div>
          </motion.section>

          {/* CHART + MARKET STATISTICS */}

          <div className="mt-2 grid gap-2 lg:min-h-[300px] lg:flex-1 lg:grid-cols-3">

            {/* PRICE HISTORY */}

            <motion.section
              className={`${CARD} flex flex-col px-4 py-3 lg:col-span-2`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut", delay: 0.05 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">

                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Price History
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Historical closing price
                    {periodChange !== null && (
                      <>
                        {" · "}
                        <span
                          className={`font-semibold tabular-nums ${
                            periodChange >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {periodChange >= 0 ? "+" : "-"}
                          {Math.abs(periodChange).toFixed(2)}% in {selectedRange}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Range Buttons */}
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                  {RANGE_OPTIONS.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setSelectedRange(range)}
                      aria-pressed={selectedRange === range}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${FOCUS} ${
                        selectedRange === range
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

              </div>

              {/* Chart */}
              <div
                className="relative mt-2 h-60 w-full md:h-72 lg:h-auto lg:min-h-[200px] lg:flex-1"
                role="img"
                aria-label={`Line chart of ${stock.symbol.replace(
                  ".NS",
                  ""
                )} closing price over the selected range`}
              >
                <div className="absolute inset-0">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="priceFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={lineColor}
                            stopOpacity={0.16}
                          />
                          <stop
                            offset="100%"
                            stopColor={lineColor}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                      />

                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          fill: "#64748b",
                        }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={40}
                        tickMargin={6}
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        }
                      />

                      <YAxis
                        tick={{
                          fontSize: 11,
                          fill: "#64748b",
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                        tickFormatter={(value) =>
                          `₹${Number(value).toLocaleString("en-IN")}`
                        }
                        domain={["auto", "auto"]}
                      />

                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) =>
                          new Date(String(label)).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        }
                        formatter={(value) => formatINR(Number(value ?? 0))}
                      />

                      <Area
                        type="monotone"
                        dataKey="close"
                        name="Close"
                        stroke={lineColor}
                        strokeWidth={2}
                        fill="url(#priceFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={!reduceMotion}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-slate-400">
                      Historical price data unavailable.
                    </p>
                  </div>
                )}
                </div>
              </div>

              {chartData.length > 0 && periodLow !== null && periodHigh !== null && (
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-xs tabular-nums text-slate-500">
                  <span>
                    Low{" "}
                    <span className="font-semibold text-slate-700">
                      {formatINR(periodLow)}
                    </span>
                    {" · "}High{" "}
                    <span className="font-semibold text-slate-700">
                      {formatINR(periodHigh)}
                    </span>{" "}
                    in {selectedRange}
                  </span>

                  <span className="text-slate-400">
                    Latest close: {latestCloseDate}
                  </span>
                </div>
              )}
            </motion.section>

            {/* MARKET STATISTICS */}

            <motion.section
              className={`${CARD} px-4 py-3`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut", delay: 0.1 }}
            >
              <h2 className="text-base font-semibold text-slate-900">
                Market Statistics
              </h2>

              <div className="mt-2 grid grid-cols-2 gap-x-4 empty:hidden">
                <RangeBar
                  label="Day range"
                  low={stock.dayLow}
                  high={stock.dayHigh}
                  current={stock.price}
                  fmt={formatINR}
                />

                <RangeBar
                  label="52-week range"
                  low={stock.week52Low}
                  high={stock.week52High}
                  current={stock.price}
                  fmt={formatINR}
                  note={highNote(stock.price, stock.week52High)}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5">
                <Metric
                  label="Previous Close"
                  value={formatINR(stock.previousClose)}
                />
                <Metric label="Open" value={formatINR(stock.open)} />
                <Metric label="Day High" value={formatINR(stock.dayHigh)} />
                <Metric label="Day Low" value={formatINR(stock.dayLow)} />
                <Metric label="Volume" value={formatVolume(stock.volume)} />
                <Metric
                  label="Market Cap"
                  value={formatMarketCap(stock.marketCap)}
                />
                <Metric
                  label="Exchange"
                  value={displayExchange(stock.exchange, stock.symbol)}
                />

                {aiSignal && (
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">AI Signal</p>

                    <p className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                          aiSignal.prediction === "BUY"
                            ? "bg-emerald-50 text-emerald-700"
                            : aiSignal.prediction === "SELL"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {aiSignal.prediction}
                      </span>

                      {aiSignal.confidence != null && (
                        <span className="text-xs tabular-nums text-slate-500">
                          {aiSignal.confidence.toFixed(0)}%
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {indicators && indicators.rsi != null && (
                  <Metric
                    label="RSI (14)"
                    value={`${indicators.rsi.toFixed(1)} · ${
                      indicators.rsi >= 70
                        ? "Overbought"
                        : indicators.rsi <= 30
                          ? "Oversold"
                          : "Neutral"
                    }`}
                  />
                )}

                {indicators && indicators.macd != null && (
                  <Metric
                    label="MACD"
                    value={`${indicators.macd.toFixed(2)} · ${
                      indicators.macd >= 0 ? "Bullish" : "Bearish"
                    }`}
                  />
                )}

                {position && (
                  <Metric
                    label="Your Position"
                    value={`${position.quantity.toLocaleString(
                      "en-IN"
                    )} @ ${formatINR(position.avgBuy).replace(/\.\d+$/, "")}`}
                  />
                )}

                {position && stock.price != null && (
                  <Metric
                    label="Your P&L"
                    value={`${
                      stock.price >= position.avgBuy ? "+" : "-"
                    }${formatINR(
                      Math.abs((stock.price - position.avgBuy) * position.quantity)
                    )}`}
                  />
                )}
              </div>
            </motion.section>

          </div>

          {/* FUNDAMENTALS */}

          <motion.section
            className={`${CARD} mt-2 px-4 py-3`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut", delay: 0.15 }}
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-base font-semibold text-slate-900">
                Fundamentals
              </h2>

              <p className="text-xs text-slate-400">Key financial metrics</p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <Metric
                label="P/E Ratio"
                value={stock.peRatio != null ? stock.peRatio.toFixed(2) : "N/A"}
              />

              <Metric
                label="EPS"
                value={stock.eps != null ? formatINR(stock.eps) : "N/A"}
              />

              <Metric
                label="Dividend Yield"
                value={
                  stock.dividendYield != null
                    ? `${stock.dividendYield.toFixed(2)}%`
                    : "N/A"
                }
              />

              <Metric
                label="P/B Ratio"
                value={
                  stock.priceToBook != null
                    ? stock.priceToBook.toFixed(2)
                    : "N/A"
                }
              />

              <Metric
                label="Book Value"
                value={
                  stock.bookValue != null ? formatINR(stock.bookValue) : "N/A"
                }
              />

              <Metric
                label="52W High"
                value={
                  stock.week52High != null
                    ? formatINR(stock.week52High)
                    : "N/A"
                }
              />

              <Metric
                label="52W Low"
                value={
                  stock.week52Low != null ? formatINR(stock.week52Low) : "N/A"
                }
              />

              <Metric
                label="ROE"
                value={
                  stock.returnOnEquity != null
                    ? `${(stock.returnOnEquity * 100).toFixed(2)}%`
                    : "N/A"
                }
              />

              <Metric label="Sector" value={stock.sector || "N/A"} />

              <Metric label="Industry" value={stock.industry || "N/A"} />
            </div>
          </motion.section>

        </div>
      </div>
    </MotionConfig>
  );
}