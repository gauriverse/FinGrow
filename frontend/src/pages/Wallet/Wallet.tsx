import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getPortfolioSummary,
  addFunds,
  getWalletHistory,
} from "../../services/portfolioService";

// Must match the limits enforced in the backend route.
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;
const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];

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

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

// =====================================================
// COMPONENT
// =====================================================

export default function Wallet() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [history, setHistory] = useState<ActivityItem[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [justAdded, setJustAdded] = useState("");

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
  // UI
  // ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans text-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 md:px-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]"
          >
            <span aria-hidden="true">←</span>
            Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Wallet
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Virtual money for paper trading. Nothing real is ever charged.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* =====================================================
              BALANCE
          ===================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 lg:col-start-1">
            <p className="text-sm text-slate-500">Available to trade</p>

            {summary ? (
              <p className="mt-1 font-serif text-5xl font-semibold tracking-tight text-[#0F4C3A] md:text-6xl">
                {inr(available)}
              </p>
            ) : summaryError ? (
              <p className="mt-3 text-sm text-red-600">{summaryError}</p>
            ) : (
              <div className="mt-3 h-14 w-64 animate-pulse rounded-lg bg-slate-100" />
            )}

            {/* Cash vs invested */}
            <div className="mt-8">
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${cashPercent.toFixed(0)} percent cash, ${(
                  100 - cashPercent
                ).toFixed(0)} percent invested`}
              >
                <div
                  className="h-full bg-[#0F4C3A] transition-all duration-500"
                  style={{ width: `${summary ? cashPercent : 0}%` }}
                />
                <div className="h-full flex-1 bg-[#0B1B2E]/80" />
              </div>

              <div className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0F4C3A]" />
                  <span className="text-slate-500">Cash</span>
                  <span className="font-semibold">
                    {summary ? inr(available) : "—"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0B1B2E]/80" />
                  <span className="text-slate-500">In stocks</span>
                  <span className="font-semibold">
                    {summary ? inr(invested) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Key figures */}
            <dl className="mt-8 grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-4 sm:pr-6">
                <dt className="text-xs text-slate-500">Total funds added</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {funded != null ? inr(funded) : "—"}
                </dd>
              </div>

              <div className="py-4 sm:px-6">
                <dt className="text-xs text-slate-500">Portfolio value</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {summary ? inr(totalValue) : "—"}
                </dd>
              </div>

              <div className="py-4 sm:pl-6">
                <dt className="text-xs text-slate-500">Return on funds</dt>
                <dd
                  className={`mt-1 text-lg font-semibold ${
                    returnPercent == null
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
          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 className="font-serif text-xl font-semibold">Add money</h2>
            <p className="mt-1 text-sm text-slate-500">
              Top up your wallet to practise with a bigger budget.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
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
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] disabled:opacity-50 ${
                      selected
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
              className="mt-5 block text-sm font-medium text-slate-700"
            >
              Or enter an amount
            </label>

            <div className="mt-2 flex items-center rounded-xl border border-slate-200 px-4 transition focus-within:border-[#0F4C3A] focus-within:ring-2 focus-within:ring-[#0F4C3A]/20">
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
                className="w-full border-0 bg-transparent px-2 py-3 text-base focus:outline-none"
              />
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Between ₹100 and ₹10,00,000 per deposit.
            </p>

            {amountIsValid && summary && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1F8F4] px-4 py-3 text-sm">
                <span className="text-slate-600">New balance</span>
                <span className="font-semibold text-[#0F4C3A]">
                  {inr(available + parsedAmount)}
                </span>
              </div>
            )}

            {addError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {addError}
              </div>
            )}

            {justAdded && (
              <div
                role="status"
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                {justAdded}
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={adding || !amountIsValid}
              className="mt-5 w-full rounded-xl bg-[#0F4C3A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B3528] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding
                ? "Adding..."
                : amountIsValid
                  ? `Add ${inrShort(parsedAmount)}`
                  : "Add money"}
            </button>
          </section>

          {/* =====================================================
              ACTIVITY
          ===================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white lg:col-start-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <h2 className="font-serif text-xl font-semibold">Activity</h2>

              <div
                className="flex gap-1 rounded-xl bg-slate-100 p-1"
                role="tablist"
                aria-label="Filter activity"
              >
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    role="tab"
                    aria-selected={filter === item.key}
                    onClick={() => setFilter(item.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] ${
                      filter === item.key
                        ? "bg-white text-[#0F4C3A] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {historyError ? (
              <p className="px-6 py-10 text-center text-sm text-red-600">
                {historyError}
              </p>
            ) : !history ? (
              <div className="space-y-px">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="px-6 py-5">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : visibleHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
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
              <ul className="divide-y divide-slate-100">
                {visibleHistory.map((item) => {
                  const style = KIND_STYLE[item.kind] ?? KIND_STYLE.buy;

                  return (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className={`w-14 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold ${style.badge}`}
                        >
                          {style.label}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {item.title}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {item.detail ? `${item.detail} · ` : ""}
                            {formatDate(item.date)}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-semibold ${
                            style.sign === "+"
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {style.sign}
                          {inr(item.amount)}
                        </p>

                        {item.balance_after != null && (
                          <p className="text-xs text-slate-400">
                            Balance {inr(item.balance_after)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}