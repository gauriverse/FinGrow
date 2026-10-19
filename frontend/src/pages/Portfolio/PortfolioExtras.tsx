import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";

// =====================================================
// TYPES — mirror the new read-only /portfolio/* routes
// =====================================================

export type HistoryPoint = {
  date: string;
  market_value: number;
  invested: number;
  twr_index: number | null;
};

export type BenchmarkPoint = {
  date: string;
  close: number;
};

export type HistoryResponse = {
  series: HistoryPoint[];
  benchmark: BenchmarkPoint[] | null;
  benchmark_name: string;
  incomplete_symbols?: string[];
};

export type InsightHolding = {
  stock_id: string;
  symbol: string;
  company_name: string | null;
  sector: string;
  day_change: number | null;
  day_change_percent: number | null;
  day_pnl: number | null;
};

export type SectorSlice = {
  sector: string;
  value: number;
  weight_percent: number;
};

export type InsightsResponse = {
  holdings: InsightHolding[];
  sectors: SectorSlice[];
};

export type Trade = {
  id: string;
  side: string;
  symbol: string;
  company_name: string | null;
  quantity: number;
  price: number;
  amount: number;
  date: string;
  realized_pnl: number | null;
};

export type TradesResponse = {
  trades: Trade[];
  realized_pnl_total: number;
};

// =====================================================
// SMALL HELPERS
// =====================================================

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

const compactNumber = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const signedPct = (value: number | null) =>
  value === null
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

export const pctClass = (value: number | null) =>
  value === null
    ? "text-slate-400"
    : value >= 0
      ? "text-emerald-600"
      : "text-red-600";

const shortSymbol = (symbol: string) =>
  symbol.replace(".NS", "");

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const isoDaysBefore = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - days);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

const RANGES: { label: string; days: number | null }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabledValues = [],
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  disabledValues?: T[];
}) {
  return (
    <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabledValues.includes(option.value)}
          aria-pressed={value === option.value}
          title={option.title}
          className={`px-2.5 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS} ${
            value === option.value
              ? "bg-white text-[#0B3528] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// =====================================================
// HISTORY CARD — value over time + return vs benchmark
// =====================================================

export function HistoryCard({
  data,
  loading,
  fmt,
}: {
  data: HistoryResponse | null;
  loading: boolean;
  fmt: (value: number) => string;
}) {
  const reduceMotion = useReducedMotion();

  const [view, setView] = useState<"value" | "compare">("value");
  const [rangeLabel, setRangeLabel] = useState("All");

  const series = useMemo(() => data?.series ?? [], [data]);
  const lastDate = series.length
    ? series[series.length - 1].date
    : null;

  const visible = useMemo(() => {
    const range = RANGES.find((r) => r.label === rangeLabel);

    if (!range || range.days === null || !lastDate) {
      return series;
    }

    const cutoff = isoDaysBefore(lastDate, range.days);

    return series.filter((point) => point.date >= cutoff);
  }, [series, rangeLabel, lastDate]);

  // Time-weighted return of the holdings, and the benchmark,
  // both rebased to 100 at the start of the selected range.
  const compareRows = useMemo(() => {
    const withIndex = visible.filter(
      (point) => point.twr_index !== null
    );

    if (withIndex.length < 2) return [];

    const base = withIndex[0].twr_index as number;
    const benchmark = data?.benchmark ?? [];

    let pointer = 0;
    let lastClose: number | null = null;
    let benchmarkBase: number | null = null;

    return withIndex.map((point) => {
      while (
        pointer < benchmark.length &&
        benchmark[pointer].date <= point.date
      ) {
        lastClose = benchmark[pointer].close;
        pointer += 1;
      }

      if (benchmarkBase === null && lastClose !== null) {
        benchmarkBase = lastClose;
      }

      return {
        date: point.date,
        portfolio: ((point.twr_index as number) / base) * 100,
        benchmark:
          lastClose !== null && benchmarkBase
            ? (lastClose / benchmarkBase) * 100
            : null,
      };
    });
  }, [visible, data]);

  if (loading) {
    return (
      <div className="mt-2 h-56 rounded-xl bg-white border border-slate-200 animate-pulse motion-reduce:animate-none" />
    );
  }

  if (!data || data.series.length === 0) {
    return null;
  }

  const benchmarkName = data.benchmark_name || "NIFTY 50";
  const hasBenchmark = compareRows.some(
    (row) => row.benchmark !== null
  );

  const lastRow = compareRows[compareRows.length - 1];
  const portfolioReturn = lastRow ? lastRow.portfolio - 100 : null;
  const benchmarkReturn =
    lastRow && lastRow.benchmark !== null
      ? lastRow.benchmark - 100
      : null;

  const notEnough = visible.length < 2;

  return (
    <div className="mt-2 bg-white rounded-xl border border-slate-200 px-4 py-3">

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">

        <div>
          <h2 className="text-sm font-bold text-[#0B3528]">
            {view === "value"
              ? "Portfolio value"
              : `Return vs ${benchmarkName}`}
          </h2>

          <p className="text-xs text-slate-400 mt-0.5">
            {view === "value"
              ? "Market value of holdings vs amount invested"
              : "Time-weighted return of holdings (cash excluded), rebased to 100"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <Segmented
            value={view}
            onChange={setView}
            disabledValues={
              compareRows.length === 0 ? ["compare"] : []
            }
            options={[
              { value: "value", label: "Value" },
              {
                value: "compare",
                label: `vs ${benchmarkName}`,
                title:
                  compareRows.length === 0
                    ? "Needs at least two days of history"
                    : undefined,
              },
            ]}
          />

          <Segmented
            value={rangeLabel}
            onChange={setRangeLabel}
            options={RANGES.map((range) => ({
              value: range.label,
              label: range.label,
            }))}
          />

        </div>

      </div>

      {view === "value" && visible.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">

          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-0.5 rounded bg-blue-600" />
            Market value{" "}
            <span className="font-semibold tabular-nums text-slate-800">
              {fmt(visible[visible.length - 1].market_value)}
            </span>
          </span>

          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 border-t-2 border-dashed border-amber-500" />
            Invested{" "}
            <span className="font-semibold tabular-nums text-slate-800">
              {fmt(visible[visible.length - 1].invested)}
            </span>
          </span>

        </div>
      )}

      {view === "compare" && portfolioReturn !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">

          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-0.5 rounded bg-blue-600" />
            Your holdings{" "}
            <span
              className={`font-semibold tabular-nums ${pctClass(
                portfolioReturn
              )}`}
            >
              {signedPct(portfolioReturn)}
            </span>
          </span>

          {hasBenchmark ? (
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-0.5 rounded bg-amber-500" />
              {benchmarkName}{" "}
              <span
                className={`font-semibold tabular-nums ${pctClass(
                  benchmarkReturn
                )}`}
              >
                {signedPct(benchmarkReturn)}
              </span>
            </span>
          ) : (
            <span className="text-slate-400">
              {benchmarkName} data is unavailable right now
            </span>
          )}

        </div>
      )}

      {data.incomplete_symbols && data.incomplete_symbols.length > 0 && (
        <p
          role="note"
          className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs text-amber-800"
        >
          Daily price history is missing or out of date for{" "}
          <span className="font-semibold">
            {data.incomplete_symbols.join(", ")}
          </span>
          . For those stocks the chart can look flat or jump on the
          latest day. Your table and totals are not affected.
        </p>
      )}

      {notEnough ? (
        <p className="mt-6 mb-3 text-sm text-slate-400 text-center">
          Not enough history yet. The chart appears once you
          hold positions across at least two trading days.
        </p>
      ) : (
        <div
          className="mt-2 h-44"
          role="img"
          aria-label={
            view === "value"
              ? "Line chart of portfolio market value and invested amount over time"
              : `Line chart comparing portfolio return with ${benchmarkName}`
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            {view === "value" ? (
              <ComposedChart
                data={visible}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="marketValueFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#2563EB"
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="100%"
                      stopColor="#2563EB"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="#F1F5F9"
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={64}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />

                <YAxis
                  width={52}
                  domain={["auto", "auto"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(value) =>
                    compactNumber.format(Number(value))
                  }
                />

                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) =>
                    longDate(String(label))
                  }
                  formatter={(value) =>
                    fmt(Number(value ?? 0))
                  }
                />

                <Area
                  type="monotone"
                  dataKey="market_value"
                  name="Market value"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#marketValueFill)"
                  dot={false}
                  isAnimationActive={!reduceMotion}
                />

                <Line
                  type="stepAfter"
                  dataKey="invested"
                  name="Invested"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={!reduceMotion}
                />
              </ComposedChart>
            ) : (
              <ComposedChart
                data={compareRows}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#F1F5F9"
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={64}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />

                <YAxis
                  width={52}
                  domain={["auto", "auto"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(value) =>
                    `${(Number(value) - 100).toFixed(0)}%`
                  }
                />

                <ReferenceLine y={100} stroke="#CBD5E1" />

                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) =>
                    longDate(String(label))
                  }
                  formatter={(value) =>
                    signedPct(Number(value ?? 100) - 100)
                  }
                />

                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Your holdings"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reduceMotion}
                />

                {hasBenchmark && (
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name={benchmarkName}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={!reduceMotion}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}

// =====================================================
// ORDERS PANEL — trade history with realized P&L
// =====================================================

export function OrdersPanel({
  data,
  loading,
  failed,
  fmt,
}: {
  data: TradesResponse | null;
  loading: boolean;
  failed: boolean;
  fmt: (value: number) => string;
}) {
  const signed = (value: number) =>
    value > 0 ? `+${fmt(value)}` : value < 0 ? `+${fmt(Math.abs(value))}` : fmt(value);

  if (loading) {
    return (
      <div className="h-40 rounded-xl bg-white border border-slate-200 animate-pulse motion-reduce:animate-none" />
    );
  }

  if (failed || !data) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500"
      >
        Could not load your order history right now.
      </div>
    );
  }

  if (data.trades.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
        <h3 className="font-bold text-slate-800">
          No orders yet
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Your buy and sell orders will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 bg-slate-50 text-sm">

        <span className="text-slate-500">
          Realized P&L{" "}
          <span className="text-xs text-slate-400">
            (average cost)
          </span>
        </span>

        <span
          className={`font-bold tabular-nums ${pctClass(
            data.realized_pnl_total
          )}`}
        >
          {signed(data.realized_pnl_total)}
        </span>

      </div>

      <div className="max-h-96 overflow-auto">

        <table className="w-full min-w-160">

          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <th scope="col" className="text-left px-4 py-2">Date</th>
              <th scope="col" className="text-left px-4 py-2">Stock</th>
              <th scope="col" className="text-left px-4 py-2">Side</th>
              <th scope="col" className="text-right px-4 py-2">Qty</th>
              <th scope="col" className="text-right px-4 py-2">Price</th>
              <th scope="col" className="text-right px-4 py-2">Amount</th>
              <th scope="col" className="text-right px-4 py-2" title="Profit or loss booked on this sale">
                Realized P&L
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {data.trades.map((trade) => {
              const isBuy = trade.side === "buy";

              return (
                <tr
                  key={trade.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="px-4 py-2 text-sm text-slate-500 tabular-nums whitespace-nowrap">
                    {new Date(trade.date).toLocaleString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    )}
                  </td>

                  <td className="px-4 py-2 text-sm font-bold text-slate-900">
                    {shortSymbol(trade.symbol)}
                  </td>

                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        isBuy
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-right text-sm font-semibold text-slate-700 tabular-nums">
                    {trade.quantity}
                  </td>

                  <td className="px-4 py-2 text-right text-sm text-slate-600 tabular-nums">
                    {fmt(trade.price)}
                  </td>

                  <td className="px-4 py-2 text-right text-sm font-medium text-slate-800 tabular-nums">
                    {fmt(trade.amount)}
                  </td>

                  <td
                    className={`px-4 py-2 text-right text-sm font-bold tabular-nums ${pctClass(
                      trade.realized_pnl
                    )}`}
                  >
                    {trade.realized_pnl === null
                      ? "—"
                      : signed(trade.realized_pnl)}
                  </td>
                </tr>
              );
            })}
          </tbody>

        </table>

      </div>

    </div>
  );
}