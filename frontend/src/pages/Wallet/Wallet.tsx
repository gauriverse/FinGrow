import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiDownload, FiMenu, FiRefreshCw } from "react-icons/fi";
import { MotionConfig, motion } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import {
  getPortfolioSummary,
  addFunds,
  getWalletHistory,
} from "../../services/portfolioService";

// Must match the limits enforced in the backend route.
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;
const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];

// The backend returns at most this many activity items.
const HISTORY_LIMIT = 50;

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

// Desktop activity ledger: fixed-width numeric columns so the name,
// details, time, amount and balance stay close together and aligned.
const LEDGER_COLS =
  "lg:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem_9rem_10rem]";

// =====================================================
// TYPES
// =====================================================

type ActivityKind = "deposit" | "buy" | "sell";
type FilterKey = "all" | ActivityKind;

interface PortfolioSummary {
  available_balance: number;
  initial_balance?: number;
  invested_value: number;
  current_value: number;
  total_value: number;
  overall_pnl: number;
  today_pnl: number;
  today_pnl_percent: number;
}

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  amount: number;
  balance_after?: number | null;
  date: string;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Added" },
  { key: "buy", label: "Buys" },
  { key: "sell", label: "Sells" },
];

const KIND_STYLE: Record<
  ActivityKind,
  { label: string; badge: string; sign: "+" | "−" }
> = {
  deposit: { label: "Added", badge: "bg-emerald-50 text-emerald-700", sign: "+" },
  sell: { label: "Sell", badge: "bg-sky-50 text-sky-700", sign: "+" },
  buy: { label: "Buy", badge: "bg-slate-100 text-slate-600", sign: "−" },
};

// =====================================================
// HELPERS
// =====================================================

const inr = (value: number | string | null | undefined): string =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const inrShort = (value: number): string => inr(value).replace(".00", "");

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

const startOfDay = (date: Date): number =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();

// =====================================================
// COMPONENT
// =====================================================

export default function Wallet() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [history, setHistory] = useState<ActivityItem[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [justAdded, setJustAdded] = useState("");

  // Presentation-only: fixed "now" used to label Today / Yesterday
  const [now] = useState(() => new Date());

  // ---------------------------------------------------------------
  // LOAD: each section renders as soon as its own data arrives
  // ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    getPortfolioSummary()
      .then((v: PortfolioSummary) => {
        if (!cancelled) setSummary(v);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Wallet summary failed:", e);

        if (e instanceof Error && e.message.includes("not authenticated")) {
          navigate("/login");
        } else {
          setSummaryError("Could not load your balance.");
        }
      });

    getWalletHistory()
      .then((v: ActivityItem[]) => {
        if (!cancelled) setHistory(v);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Wallet history failed:", e);
        setHistoryError("Could not load your activity.");
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Hide the success message after a few seconds
  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(""), 5000);
    return () => clearTimeout(timer);
  }, [justAdded]);

  // Retry buttons: same two calls as above, triggered by the user
  const retrySummary = () => {
    setSummaryError("");

    getPortfolioSummary()
      .then((v: PortfolioSummary) => setSummary(v))
      .catch((e: unknown) => {
        console.error("Wallet summary failed:", e);
        setSummaryError("Could not load your balance.");
      });
  };

  const retryHistory = () => {
    setHistoryError("");

    getWalletHistory()
      .then((v: ActivityItem[]) => setHistory(v))
      .catch((e: unknown) => {
        console.error("Wallet history failed:", e);
        setHistoryError("Could not load your activity.");
      });
  };

  // ---------------------------------------------------------------
  // DERIVED VALUES
  // ---------------------------------------------------------------
  const available = Number(summary?.available_balance ?? 0);
  const invested = Number(summary?.current_value ?? 0);
  const totalValue = Number(summary?.total_value ?? available + invested);
  const funded =
    summary?.initial_balance != null ? Number(summary.initial_balance) : null;

  const cashPercent =
    available + invested > 0 ? (available / (available + invested)) * 100 : 100;

  const returnPercent =
    funded != null && funded > 0
      ? ((totalValue - funded) / funded) * 100
      : null;

  const parsedAmount = Number(amount);
  const amountIsValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_AMOUNT &&
    parsedAmount <= MAX_AMOUNT;

  const visibleHistory = useMemo<ActivityItem[]>(() => {
    if (!history) return [];
    return filter === "all"
      ? history
      : history.filter((item) => item.kind === filter);
  }, [history, filter]);

  // Display only: counts for the filter tabs
  const counts = useMemo<Record<FilterKey, number>>(() => {
    const list = history ?? [];
    return {
      all: list.length,
      deposit: list.filter((i) => i.kind === "deposit").length,
      buy: list.filter((i) => i.kind === "buy").length,
      sell: list.filter((i) => i.kind === "sell").length,
    };
  }, [history]);

  // Display only: group rows under Today / Yesterday / date headings
  const groupedHistory = useMemo(() => {
    const groups: { label: string; items: ActivityItem[] }[] = [];
    const today = startOfDay(now);

    visibleHistory.forEach((item) => {
      const date = new Date(item.date);
      const diff = Math.round((today - startOfDay(date)) / 86400000);

      const label =
        diff === 0
          ? "Today"
          : diff === 1
            ? "Yesterday"
            : date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

      const last = groups[groups.length - 1];

      if (last && last.label === label) {
        last.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    });

    return groups;
  }, [visibleHistory, now]);

  // ---------------------------------------------------------------
  // ADD MONEY
  // ---------------------------------------------------------------
  const handleAdd = async () => {
    if (!amountIsValid) {
      setAddError(
        `Enter an amount between ${inrShort(MIN_AMOUNT)} and ${inrShort(MAX_AMOUNT)}.`,
      );
      return;
    }

    try {
      setAdding(true);
      setAddError("");

      await addFunds(parsedAmount);

      setJustAdded(`${inr(parsedAmount)} added to your wallet.`);
      setAmount("");

      // Refresh both sections without blocking the success message
      getPortfolioSummary()
        .then((v: PortfolioSummary) => setSummary(v))
        .catch(console.error);

      getWalletHistory()
        .then((v: ActivityItem[]) => setHistory(v))
        .catch(console.error);
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Could not add money.",
      );
    } finally {
      setAdding(false);
    }
  };

  // ---------------------------------------------------------------
  // EXPORT (client-side, from the activity already loaded)
  // ---------------------------------------------------------------
  const handleExport = () => {
    if (visibleHistory.length === 0) return;

    const rows: string[][] = [
      ["Date", "Type", "Description", "Detail", "Amount (INR)", "Balance after (INR)"],
      ...visibleHistory.map((item) => {
        const style = KIND_STYLE[item.kind] ?? KIND_STYLE.buy;

        return [
          new Date(item.date).toISOString(),
          style.label,
          item.title,
          item.detail ?? "",
          `${style.sign === "+" ? "" : "-"}${Number(item.amount).toFixed(2)}`,
          item.balance_after != null
            ? Number(item.balance_after).toFixed(2)
            : "",
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `fingrow-wallet-activity-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#FAF9F5] font-sans text-slate-900 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm lg:shrink-0">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-1">
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
                className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 ${FOCUS}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform motion-safe:group-hover:-translate-x-0.5"
                >
                  ←
                </span>
                Dashboard
              </button>
            </div>

            <button
              onClick={() => navigate("/portfolio")}
              className={`group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#0F4C3A] transition-colors hover:bg-slate-100 ${FOCUS}`}
            >
              Portfolio
              <FiArrowRight
                size={14}
                className="transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </header>

        <main className="px-4 py-4 md:px-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="md:flex md:items-baseline md:gap-3">
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight">
              Wallet
            </h1>
          </div>

          <div className="mt-3 grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
            <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
              {/* =====================================================
                BALANCE
            ===================================================== */}
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">Available to trade</p>

                  {summary && (
                    <button
                      onClick={() => navigate("/portfolio")}
                      className={`text-xs font-semibold text-[#0F4C3A] hover:underline rounded ${FOCUS}`}
                    >
                      View portfolio
                    </button>
                  )}
                </div>

                {summary ? (
                  <p className="mt-0.5 font-serif break-words text-4xl font-semibold tracking-tight tabular-nums text-[#0F4C3A] md:text-5xl lg:text-4xl">
                    {inr(available)}
                  </p>
                ) : summaryError ? (
                  <div className="mt-3 flex items-center gap-3" role="alert">
                    <p className="text-sm text-red-600">{summaryError}</p>
                    <button
                      onClick={retrySummary}
                      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 ${FOCUS}`}
                    >
                      <FiRefreshCw size={12} />
                      Try again
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 h-11 w-60 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
                )}

                {/* Cash vs invested */}
                <div className="mt-5">
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                    role="img"
                    aria-label={`${cashPercent.toFixed(0)} percent cash, ${(
                      100 - cashPercent
                    ).toFixed(0)} percent invested`}
                  >
                    <div
                      className="h-full bg-[#0F4C3A] transition-all duration-500 motion-reduce:transition-none"
                      style={{ width: `${summary ? cashPercent : 0}%` }}
                    />
                    <div className="h-full flex-1 bg-[#0B1B2E]/80" />
                  </div>

                  <div className="mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0F4C3A]" />
                      <span className="text-slate-500">Cash</span>
                      <span className="font-semibold tabular-nums">
                        {summary ? inr(available) : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0B1B2E]/80" />
                      <span className="text-slate-500">In stocks</span>
                      <span className="font-semibold tabular-nums">
                        {summary ? inr(invested) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key figures */}
                <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-3">
                  <div className="pr-3 sm:pr-5">
                    <dt
                      className="text-xs text-slate-500"
                      title="Your starting balance with FinGrow"
                    >
                      Total funds added
                    </dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">
                      {funded != null ? inr(funded) : "—"}
                    </dd>
                  </div>

                  <div className="px-3 sm:px-5">
                    <dt className="text-xs text-slate-500">Portfolio value</dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">
                      {summary ? inr(totalValue) : "—"}
                    </dd>
                  </div>

                  <div className="pl-3 sm:pl-5">
                    <dt
                      className="text-xs text-slate-500"
                      title="Portfolio value compared with funds added"
                    >
                      Return on funds
                    </dt>
                    <dd
                      className={`mt-0.5 text-base font-semibold tabular-nums sm:text-lg ${returnPercent == null
                          ? ""
                          : returnPercent >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                    >
                      {returnPercent == null
                        ? "—"
                        : `${returnPercent >= 0 ? "+" : "−"}${Math.abs(
                          returnPercent,
                        ).toFixed(2)}%`}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* =====================================================
                ADD MONEY
            ===================================================== */}
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-serif text-xl font-semibold leading-tight">
                  Add money
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Top up your wallet to practise with a bigger budget.
                </p>

                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {QUICK_AMOUNTS.map((value) => {
                    const selected = parsedAmount === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setAmount(String(value));
                          setAddError("");
                        }}
                        disabled={adding}
                        aria-pressed={selected}
                        className={`rounded-lg border px-1 py-2 text-sm font-semibold tabular-nums transition-colors motion-safe:active:scale-[0.97] disabled:opacity-50 ${FOCUS} ${selected
                            ? "border-[#0F4C3A] bg-[#F1F8F4] text-[#0F4C3A]"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        ₹{value.toLocaleString("en-IN")}
                      </button>
                    );
                  })}
                </div>

                <label
                  htmlFor="wallet-amount"
                  className="mt-4 block text-sm font-medium text-slate-700"
                >
                  Or enter an amount
                </label>

                <div className="mt-1.5 flex items-center rounded-lg border border-slate-200 px-3 transition-colors focus-within:border-[#0F4C3A] focus-within:ring-2 focus-within:ring-[#0F4C3A]/20">
                  <span className="text-sm font-semibold text-slate-400">₹</span>
                  <input
                    id="wallet-amount"
                    type="number"
                    inputMode="numeric"
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    step="1"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAddError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                    }}
                    disabled={adding}
                    placeholder="0"
                    className="w-full border-0 bg-transparent px-2 py-2.5 text-base tabular-nums focus:outline-none"
                  />
                </div>

                <p className="mt-1.5 text-xs text-slate-400">
                  Between {inrShort(MIN_AMOUNT)} and {inrShort(MAX_AMOUNT)} per
                  deposit.
                </p>

                {amountIsValid && summary && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-[#F1F8F4] px-3.5 py-2.5 text-sm">
                    <span className="text-slate-600">New balance</span>
                    <span className="font-semibold tabular-nums text-[#0F4C3A]">
                      {inr(available + parsedAmount)}
                    </span>
                  </div>
                )}

                {addError && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
                  >
                    {addError}
                  </motion.div>
                )}

                {justAdded && (
                  <motion.div
                    role="status"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700"
                  >
                    {justAdded}
                  </motion.div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={adding || !amountIsValid}
                  aria-busy={adding}
                  className={`mt-4 w-full rounded-lg bg-[#0F4C3A] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#0B3528] motion-safe:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} focus-visible:ring-offset-2`}
                >
                  {adding
                    ? "Adding..."
                    : amountIsValid
                      ? `Add ${inrShort(parsedAmount)}`
                      : "Add money"}
                </button>
              </section>

            </div>

            {/* =====================================================
                ACTIVITY
            ===================================================== */}
            <section className="flex flex-col rounded-xl border border-slate-200 bg-white lg:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                <h2 className="font-serif text-xl font-semibold leading-tight">
                  Activity
                </h2>

                <div className="flex items-center gap-2">
                  <div
                    className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5"
                    role="tablist"
                    aria-label="Filter activity"
                  >
                    {FILTERS.map((item) => (
                      <button
                        key={item.key}
                        role="tab"
                        aria-selected={filter === item.key}
                        onClick={() => setFilter(item.key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${FOCUS} ${filter === item.key
                            ? "bg-white text-[#0F4C3A] shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                          }`}
                      >
                        {item.label}
                        {history && (
                          <span className="ml-1 tabular-nums opacity-60">
                            {counts[item.key]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={visibleHistory.length === 0}
                    title="Download this view as a CSV file"
                    aria-label="Export activity as CSV"
                    className={`rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                  >
                    <FiDownload size={14} />
                  </button>
                </div>
              </div>

              <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {historyError ? (
                  <div className="px-5 py-8 text-center" role="alert">
                    <p className="text-sm text-red-600">{historyError}</p>
                    <button
                      onClick={retryHistory}
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 ${FOCUS}`}
                    >
                      <FiRefreshCw size={12} />
                      Try again
                    </button>
                  </div>
                ) : !history ? (
                  <div
                    className="divide-y divide-slate-100"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="sr-only">Loading activity...</span>

                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="px-5 py-3 animate-pulse motion-reduce:animate-none"
                      >
                        <div className="h-4 w-40 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-28 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : visibleHistory.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {history.length === 0
                        ? "No activity yet"
                        : "Nothing in this view"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {history.length === 0
                        ? "Add money or place a paper trade and it will show up here."
                        : "Try a different filter."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className={`sticky top-0 z-10 hidden border-b border-slate-100 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:grid lg:items-center lg:gap-4 ${LEDGER_COLS}`}
                    >
                      <span>Type</span>
                      <span>Description</span>
                      <span>Details</span>
                      <span>Time</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Balance</span>
                    </div>

                    {groupedHistory.map((group) => (
                      <div key={group.label}>
                        <p className="border-b border-slate-100 bg-slate-50 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {group.label}
                        </p>

                        <ul className="divide-y divide-slate-100">
                          {group.items.map((item) => {
                            const style = KIND_STYLE[item.kind] ?? KIND_STYLE.buy;

                            return (
                              <li
                                key={`${item.kind}-${item.id}`}
                                className="px-5 py-2.5 transition-colors hover:bg-slate-50/70"
                              >
                                {/* Mobile / tablet */}
                                <div className="flex items-center justify-between gap-3 lg:hidden">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span
                                      className={`w-14 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold ${style.badge}`}
                                    >
                                      {style.label}
                                    </span>

                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold">
                                        {item.title}
                                      </p>
                                      <p className="truncate text-xs text-slate-400 tabular-nums">
                                        {item.detail ? `${item.detail} · ` : ""}
                                        {formatTime(item.date)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <p
                                      className={`text-sm font-semibold tabular-nums ${style.sign === "+"
                                          ? "text-emerald-600"
                                          : "text-slate-800"
                                        }`}
                                    >
                                      {style.sign}
                                      {inr(item.amount)}
                                    </p>

                                    {item.balance_after != null && (
                                      <p className="text-xs text-slate-400 tabular-nums">
                                        Balance {inr(item.balance_after)}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Desktop ledger */}
                                <div
                                  className={`hidden lg:grid lg:items-center lg:gap-4 ${LEDGER_COLS}`}
                                >
                                  <span
                                    className={`rounded-md px-2 py-1 text-center text-xs font-semibold ${style.badge}`}
                                  >
                                    {style.label}
                                  </span>

                                  <p
                                    className="truncate text-sm font-semibold"
                                    title={item.title}
                                  >
                                    {item.title}
                                  </p>

                                  <p className="truncate text-sm text-slate-500 tabular-nums">
                                    {item.detail || "—"}
                                  </p>

                                  <p className="text-xs text-slate-400 tabular-nums">
                                    {formatTime(item.date)}
                                  </p>

                                  <p
                                    className={`text-right text-sm font-semibold tabular-nums ${style.sign === "+"
                                        ? "text-emerald-600"
                                        : "text-slate-800"
                                      }`}
                                  >
                                    {style.sign}
                                    {inr(item.amount)}
                                  </p>

                                  <p className="text-right text-xs text-slate-400 tabular-nums">
                                    {item.balance_after != null
                                      ? inr(item.balance_after)
                                      : "—"}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}

                    {history.length >= HISTORY_LIMIT && (
                      <p className="border-t border-slate-100 px-5 py-2 text-center text-xs text-slate-400">
                        Showing your latest {HISTORY_LIMIT} transactions.
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}