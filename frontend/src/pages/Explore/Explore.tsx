import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  FiAlertTriangle,
  FiChevronDown,
  FiFilter,
  FiMenu,
  FiSearch,
  FiStar,
  FiX,
} from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import {
  addToWatchlist,
  getUserWatchlist,
  removeFromWatchlist,
} from "../../services/watchlist";
import { getPortfolioSummary } from "../../services/portfolioService";
import {
  getExplore,
  type AssetType,
  type ChangeFilter,
  type ExploreFacets,
  type ExploreItem,
  type ExploreParams,
  type ExploreResponse,
  type SortKey,
} from "../../services/exploreservice";
import Sidebar from "../../components/Sidebar";
import HeaderActions from "../../components/HeaderActions";

// ---------------------------------------------------------------------------
// Constants + small helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const SECTORS_COLLAPSED = 6;
const SECTOR_SEARCH_MIN = 8;

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

const TABS: { value: AssetType; label: string; one: string; many: string }[] = [
  { value: "equity", label: "Stocks", one: "stock", many: "stocks" },
  { value: "etf", label: "ETFs", one: "ETF", many: "ETFs" },
  { value: "index", label: "Indices", one: "index", many: "indices" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "mcap", label: "Market cap: high to low" },
  { value: "price", label: "Price: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "change", label: "Day change: best first" },
  { value: "change_asc", label: "Day change: worst first" },
  { value: "az", label: "Name A–Z" },
];

const isAssetType = (v: string | null): v is AssetType =>
  v === "equity" || v === "etf" || v === "index";
const isChange = (v: string | null): v is ChangeFilter =>
  v === "all" || v === "gainers" || v === "losers";
const isSort = (v: string | null): v is SortKey =>
  SORT_OPTIONS.some((o) => o.value === v);

const toNumber = (v: string | null): number | undefined => {
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const toParam = (n: number | undefined): string | undefined =>
  n === undefined ? undefined : String(n);

const stripSuffix = (symbol: string) => symbol.replace(/\.(NS|BO)$/, "");

const formatINR = (value: number | null) =>
  value == null
    ? "—"
    : `₹${value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

// Market cap arrives in Rs crore. 1 lakh crore = 1,00,000 crore.
const formatMcap = (cr: number | null) => {
  if (cr == null) return "—";
  if (cr >= 100000) return `₹${(cr / 100000).toFixed(2)} L Cr`;
  return `₹${Math.round(cr).toLocaleString("en-IN")} Cr`;
};

const IST_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const formatAsOf = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${IST_FORMAT.format(date)} IST`;
};

type PanelValue = {
  sectors: string[];
  mcapMin?: number;
  mcapMax?: number;
  change: ChangeFilter;
  minPrice?: number;
  maxPrice?: number;
};

const EMPTY_PANEL: PanelValue = { sectors: [], change: "all" };

const panelFromFilters = (f: ExploreParams): PanelValue => ({
  sectors: f.sectors ?? [],
  mcapMin: f.mcapMin,
  mcapMax: f.mcapMax,
  change: f.change ?? "all",
  minPrice: f.minPrice,
  maxPrice: f.maxPrice,
});

// ---------------------------------------------------------------------------
// Filter panel (one component, used by the desktop rail and the mobile sheet)
// ---------------------------------------------------------------------------

function Group({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 py-3 last:border-0">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className={`flex w-full items-center justify-between rounded text-sm font-semibold text-slate-800 ${FOCUS}`}
        >
          {title}
          <FiChevronDown
            size={16}
            aria-hidden="true"
            className={`text-slate-400 transition-transform motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </h3>
      <div id={id} hidden={!open} className="mt-2.5">
        {children}
      </div>
    </section>
  );
}

function PriceRange({
  value,
  range,
  onCommit,
}: {
  value: { min?: number; max?: number };
  range: { min: number | null; max: number | null };
  onCommit: (min?: number, max?: number) => void;
}) {
  const [minText, setMinText] = useState(value.min === undefined ? "" : String(value.min));
  const [maxText, setMaxText] = useState(value.max === undefined ? "" : String(value.max));

  const commit = () => {
    const min = toNumber(minText);
    const max = toNumber(maxText);
    if (min === value.min && max === value.max) return;
    onCommit(min, max);
  };

  const onEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
  };

  const inputClass = `h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 ${FOCUS}`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={minText}
          onChange={(e) => setMinText(e.target.value)}
          onBlur={commit}
          onKeyDown={onEnter}
          placeholder="Min ₹"
          aria-label="Minimum price in rupees"
          className={inputClass}
        />
        <span className="text-slate-400" aria-hidden="true">–</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={maxText}
          onChange={(e) => setMaxText(e.target.value)}
          onBlur={commit}
          onKeyDown={onEnter}
          placeholder="Max ₹"
          aria-label="Maximum price in rupees"
          className={inputClass}
        />
      </div>
      {range.min !== null && range.max !== null && (
        <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
          Available: {formatINR(range.min)} – {formatINR(range.max)}
        </p>
      )}
    </div>
  );
}

function FilterPanel({
  idPrefix,
  type,
  facets,
  value,
  dayChangeAvailable,
  onChange,
}: {
  idPrefix: string;
  type: AssetType;
  facets: ExploreFacets | null;
  value: PanelValue;
  dayChangeAvailable: boolean;
  onChange: (next: PanelValue) => void;
}) {
  const [open, setOpen] = useState({
    sector: true,
    mcap: true,
    change: true,
    price: true,
  });
  const [sectorQuery, setSectorQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!facets) {
    return (
      <div role="status" className="space-y-3 py-2 animate-pulse motion-reduce:animate-none">
        <span className="sr-only">Loading filters...</span>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  const toggle = (key: keyof typeof open) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const chip = (selected: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors motion-reduce:transition-none ${FOCUS} ${
      selected
        ? "bg-[#0F4C3A] font-medium text-white"
        : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
    }`;

  // Sector
  const needle = sectorQuery.trim().toLowerCase();
  const matching = needle
    ? facets.sectors.filter((s) => s.name.toLowerCase().includes(needle))
    : facets.sectors;
  const visibleSectors =
    showAll || needle ? matching : matching.slice(0, SECTORS_COLLAPSED);

  const toggleSector = (name: string) =>
    onChange({
      ...value,
      sectors: value.sectors.includes(name)
        ? value.sectors.filter((s) => s !== name)
        : [...value.sectors, name],
    });

  const showEquityGroups = type === "equity";

  return (
    <div>
      {showEquityGroups && facets.sectors.length > 0 && (
        <Group
          id={`${idPrefix}-sector`}
          title="Sector"
          open={open.sector}
          onToggle={() => toggle("sector")}
        >
          {facets.sectors.length > SECTOR_SEARCH_MIN && (
            <div className="relative mb-2">
              <FiSearch
                size={13}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={sectorQuery}
                onChange={(e) => setSectorQuery(e.target.value)}
                placeholder="Search sectors"
                aria-label="Search sectors"
                className={`h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm placeholder:text-slate-400 ${FOCUS}`}
              />
            </div>
          )}

          <ul className="space-y-0.5">
            {visibleSectors.map((sector) => {
              const checkboxId = `${idPrefix}-sector-${sector.name}`;
              return (
                <li key={sector.name}>
                  <label
                    htmlFor={checkboxId}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={value.sectors.includes(sector.name)}
                      onChange={() => toggleSector(sector.name)}
                      className={`h-4 w-4 rounded border-slate-300 accent-[#0F4C3A] ${FOCUS}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{sector.name}</span>
                    <span className="text-xs tabular-nums text-slate-400">
                      {sector.count}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {needle && matching.length === 0 && (
            <p className="px-1 py-1 text-xs text-slate-400">No sector matches.</p>
          )}

          {!needle && matching.length > SECTORS_COLLAPSED && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={`mt-1 rounded px-1 text-xs font-semibold text-[#0F4C3A] hover:underline ${FOCUS}`}
            >
              {showAll
                ? "Show less"
                : `Show ${matching.length - SECTORS_COLLAPSED} more`}
            </button>
          )}
        </Group>
      )}

      {showEquityGroups && facets.mcap.length > 0 && (
        <Group
          id={`${idPrefix}-mcap`}
          title="Market cap"
          open={open.mcap}
          onToggle={() => toggle("mcap")}
        >
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              aria-pressed={value.mcapMin === undefined && value.mcapMax === undefined}
              onClick={() => onChange({ ...value, mcapMin: undefined, mcapMax: undefined })}
              className={chip(value.mcapMin === undefined && value.mcapMax === undefined)}
            >
              Any
            </button>
            {facets.mcap.map((bucket) => {
              const selected =
                value.mcapMin === bucket.min &&
                (value.mcapMax ?? null) === bucket.max;
              return (
                <button
                  key={bucket.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...value,
                      mcapMin: bucket.min,
                      mcapMax: bucket.max ?? undefined,
                    })
                  }
                  className={`${chip(selected)} flex items-center justify-between`}
                >
                  <span>{bucket.label}</span>
                  <span className="text-xs tabular-nums opacity-70">{bucket.count}</span>
                </button>
              );
            })}
          </div>
        </Group>
      )}

      <Group
        id={`${idPrefix}-change`}
        title="Day change"
        open={open.change}
        onToggle={() => toggle("change")}
      >
        {dayChangeAvailable ? (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { v: "all", label: "All", count: facets.change.all },
                { v: "gainers", label: "Gainers", count: facets.change.gainers },
                { v: "losers", label: "Losers", count: facets.change.losers },
              ] as { v: ChangeFilter; label: string; count: number }[]
            )
              .filter((o) => o.v === "all" || o.count > 0 || value.change === o.v)
              .map((o) => (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={value.change === o.v}
                  onClick={() => onChange({ ...value, change: o.v })}
                  className={chip(value.change === o.v)}
                >
                  {o.label}{" "}
                  <span className="text-xs tabular-nums opacity-70">{o.count}</span>
                </button>
              ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Day change is unavailable right now.
          </p>
        )}
      </Group>

      <Group
        id={`${idPrefix}-price`}
        title="Price range"
        open={open.price}
        onToggle={() => toggle("price")}
      >
        <PriceRange
          key={`${value.minPrice ?? ""}-${value.maxPrice ?? ""}`}
          value={{ min: value.minPrice, max: value.maxPrice }}
          range={facets.price}
          onCommit={(min, max) => onChange({ ...value, minPrice: min, maxPrice: max })}
        />
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function ChangeBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-slate-400">—</span>;
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-sm font-semibold tabular-nums ${
        value >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      }`}
    >
      {value >= 0 ? "▲ +" : "▼ "}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

type RowActions = {
  held: Set<string>;
  watched: Set<string>;
  busyId: string | null;
  onToggleWatch: (item: ExploreItem) => void;
  onOpen: (item: ExploreItem) => void;
};

function WatchStar({ item, actions }: { item: ExploreItem; actions: RowActions }) {
  const active = actions.watched.has(item.id);
  const name = stripSuffix(item.symbol);
  return (
    <button
      type="button"
      onClick={() => actions.onToggleWatch(item)}
      disabled={actions.busyId === item.id}
      aria-pressed={active}
      aria-label={`${active ? "Remove" : "Add"} ${name} ${active ? "from" : "to"} watchlist`}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 motion-reduce:transition-none ${FOCUS} ${
        active ? "text-amber-500" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      <FiStar size={16} className={active ? "fill-current" : ""} />
    </button>
  );
}

function HeldBadge() {
  return (
    <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[#0F4C3A]">
      Held
    </span>
  );
}

function ResultsTable({ items, actions }: { items: ExploreItem[]; actions: RowActions }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-400">
            <th scope="col" className="py-2.5 font-semibold">STOCK</th>
            <th scope="col" className="py-2.5 font-semibold">SECTOR</th>
            <th scope="col" className="py-2.5 text-right font-semibold">PRICE</th>
            <th scope="col" className="py-2.5 text-right font-semibold">DAY CHANGE</th>
            <th scope="col" className="py-2.5 text-right font-semibold">MARKET CAP</th>
            <th scope="col" className="py-2.5 text-right font-semibold">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70 motion-reduce:transition-none"
            >
              <td className="py-2.5 pr-3">
                <button
                  type="button"
                  onClick={() => actions.onOpen(item)}
                  title="View stock details"
                  className={`block rounded text-left ${FOCUS}`}
                >
                  <span className="block text-sm font-semibold text-slate-900 hover:text-[#0F4C3A]">
                    {stripSuffix(item.symbol)}
                    {actions.held.has(item.id) && <HeldBadge />}
                  </span>
                  <span className="mt-0.5 block max-w-[240px] truncate text-xs text-slate-400">
                    {item.company}
                  </span>
                </button>
              </td>
              <td className="py-2.5 pr-3 text-sm text-slate-600">
                {item.sector ?? "Unclassified"}
              </td>
              <td className="py-2.5 text-right text-sm font-semibold tabular-nums text-slate-800">
                {formatINR(item.price)}
              </td>
              <td className="py-2.5 text-right">
                <ChangeBadge value={item.changePercent} />
              </td>
              <td className="py-2.5 text-right text-sm tabular-nums text-slate-700">
                {formatMcap(item.marketCapCr)}
              </td>
              <td className="py-2.5">
                <div className="flex items-center justify-end gap-2">
                  <WatchStar item={item} actions={actions} />
                  <button
                    type="button"
                    onClick={() => actions.onOpen(item)}
                    className={`rounded text-xs font-semibold text-[#0F4C3A] hover:underline ${FOCUS}`}
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsCards({ items, actions }: { items: ExploreItem[]; actions: RowActions }) {
  return (
    <ul className="space-y-2 md:hidden">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">
                {stripSuffix(item.symbol)}
                {actions.held.has(item.id) && <HeldBadge />}
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-400">{item.company}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {item.sector ?? "Unclassified"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-bold tabular-nums text-slate-900">{formatINR(item.price)}</p>
              <div className="mt-0.5">
                <ChangeBadge value={item.changePercent} />
              </div>
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {formatMcap(item.marketCapCr)}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
            <WatchStar item={item} actions={actions} />
            <button
              type="button"
              onClick={() => actions.onOpen(item)}
              className={`rounded text-xs font-semibold text-[#0F4C3A] ${FOCUS}`}
            >
              View Details
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="divide-y divide-slate-100 animate-pulse motion-reduce:animate-none"
    >
      <span className="sr-only">Loading stocks...</span>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-[58px] items-center justify-between">
          <div className="space-y-2">
            <div className="h-3.5 w-24 rounded bg-slate-100" />
            <div className="h-3 w-40 rounded bg-slate-100" />
          </div>
          <div className="h-4 w-24 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type SummaryState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ok"; balance: number; held: Set<string> };

export default function Explore() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const panelId = useId();
  const sheetId = useId();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<PanelValue>(EMPTY_PANEL);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // ----- filters live in the URL -----
  const filters = useMemo<ExploreParams>(() => {
    const type = params.get("type");
    const change = params.get("change");
    const sort = params.get("sort");
    const page = toNumber(params.get("page"));
    return {
      q: params.get("q") ?? "",
      type: isAssetType(type) ? type : "equity",
      sectors: (params.get("sector") ?? "").split(",").filter(Boolean),
      mcapMin: toNumber(params.get("mcap_min")),
      mcapMax: toNumber(params.get("mcap_max")),
      change: isChange(change) ? change : "all",
      minPrice: toNumber(params.get("min_price")),
      maxPrice: toNumber(params.get("max_price")),
      sort: isSort(sort) ? sort : "mcap",
      page: page && page >= 1 ? Math.floor(page) : 1,
      pageSize: PAGE_SIZE,
    };
  }, [params]);

  const update = useCallback(
    (
      patch: Record<string, string | undefined>,
      options?: { replace?: boolean; keepPage?: boolean },
    ) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          if (!options?.keepPage) next.delete("page");
          return next;
        },
        { replace: options?.replace },
      );
    },
    [setParams],
  );

  const applyPanel = useCallback(
    (value: PanelValue) =>
      update({
        sector: value.sectors.length ? value.sectors.join(",") : undefined,
        mcap_min: toParam(value.mcapMin),
        mcap_max: toParam(value.mcapMax),
        change: value.change === "all" ? undefined : value.change,
        min_price: toParam(value.minPrice),
        max_price: toParam(value.maxPrice),
      }),
    [update],
  );

  // ----- debounced search (250ms) -----
  const urlQ = params.get("q") ?? "";
  const [qInput, setQInput] = useState(urlQ);
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ);
  const [pendingQ, setPendingQ] = useState<string | null>(null);

  // Back/forward or a link changed ?q= (not our own typing) -> follow it.
  if (urlQ !== seenUrlQ) {
    setSeenUrlQ(urlQ);
    if (urlQ !== pendingQ) setQInput(urlQ);
    setPendingQ(null);
  }

  useEffect(() => {
    if (qInput.trim() === urlQ) return;
    const timer = setTimeout(() => {
      const next = qInput.trim();
      setPendingQ(next);
      update({ q: next || undefined }, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [qInput, urlQ, update]);

  // ----- data -----
  const [retry, setRetry] = useState(0);
  const requestKey = `${JSON.stringify(filters)}|${retry}`;
  const [loaded, setLoaded] = useState<{ key: string; data: ExploreResponse } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getExplore(filters, controller.signal)
      .then((data) => setLoaded({ key: requestKey, data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setFailed({
          key: requestKey,
          message: err instanceof Error ? err.message : "Failed to load stocks",
        });
      });
    return () => controller.abort();
  }, [filters, requestKey]);

  const data = loaded?.data ?? null; // last good response (keeps facets visible while refetching)
  const refetching = loaded !== null && loaded.key !== requestKey;
  const error = failed?.key === requestKey ? failed.message : null;
  const firstLoad = loaded === null && error === null;

  // ----- portfolio summary (Held badge + wallet pill) -----
  const [summary, setSummary] = useState<SummaryState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getPortfolioSummary()
      .then((raw: unknown) => {
        if (cancelled) return;
        const s = raw as {
          available_balance?: number;
          holdings?: { stock_id: string }[];
        };
        setSummary({
          status: "ok",
          balance: Number(s.available_balance || 0),
          held: new Set((s.holdings ?? []).map((h) => h.stock_id)),
        });
      })
      .catch((err: unknown) => {
        console.error("Explore: portfolio summary failed", err);
        if (!cancelled) setSummary({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- watchlist -----
  const [watch, setWatch] = useState<{ userId: string | null; ids: Set<string> }>({
    userId: null,
    ids: new Set(),
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const rows = (await getUserWatchlist(user.id)) as { stock_id: string }[];
        if (cancelled) return;
        setWatch({ userId: user.id, ids: new Set(rows.map((r) => r.stock_id)) });
      } catch (err) {
        console.error("Explore: watchlist load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleWatch = async (item: ExploreItem) => {
    if (!watch.userId) {
      setNotice("Please sign in again to use your watchlist.");
      return;
    }
    const wasWatched = watch.ids.has(item.id);
    setBusyId(item.id);
    setNotice("");
    try {
      if (wasWatched) await removeFromWatchlist(watch.userId, item.id);
      else await addToWatchlist(watch.userId, item.id);
      setWatch((prev) => {
        const ids = new Set(prev.ids);
        if (wasWatched) ids.delete(item.id);
        else ids.add(item.id);
        return { ...prev, ids };
      });
    } catch (err) {
      console.error("Explore: watchlist update failed", err);
      setNotice(
        `Could not update your watchlist for ${stripSuffix(item.symbol)}. Please try again.`,
      );
    } finally {
      setBusyId(null);
    }
  };

  const actions: RowActions = {
    held: summary.status === "ok" ? summary.held : new Set<string>(),
    watched: watch.ids,
    busyId,
    onToggleWatch: toggleWatch,
    onOpen: (item) => navigate(`/stock/${encodeURIComponent(item.symbol)}`),
  };

  // ----- mobile sheet behaviour -----
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetOpen]);

  // ----- derived view state -----
  const type = filters.type ?? "equity";
  const tab = TABS.find((t) => t.value === type) ?? TABS[0];
  const panel = panelFromFilters(filters);
  const facets = data?.facets ?? null;
  const dayChangeAvailable = data?.meta.dayChangeAvailable ?? true;

  const activeFilterCount =
    panel.sectors.length +
    (panel.mcapMin !== undefined || panel.mcapMax !== undefined ? 1 : 0) +
    (panel.change !== "all" ? 1 : 0) +
    (panel.minPrice !== undefined || panel.maxPrice !== undefined ? 1 : 0);
  const anythingActive = activeFilterCount > 0 || (filters.q ?? "") !== "";

  const clearAll = () => {
    setQInput("");
    update({
      q: undefined,
      sector: undefined,
      mcap_min: undefined,
      mcap_max: undefined,
      change: undefined,
      min_price: undefined,
      max_price: undefined,
    });
  };

  const mcapLabel = () => {
    const bucket = facets?.mcap.find(
      (b) => b.min === panel.mcapMin && b.max === (panel.mcapMax ?? null),
    );
    if (bucket) return `Market cap: ${bucket.label}`;
    const low = panel.mcapMin !== undefined ? formatMcap(panel.mcapMin) : "Any";
    const high = panel.mcapMax !== undefined ? formatMcap(panel.mcapMax) : "Any";
    return `Market cap: ${low} – ${high}`;
  };

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if ((filters.q ?? "") !== "") {
    chips.push({
      key: "q",
      label: `Search: ${filters.q}`,
      onRemove: () => {
        setQInput("");
        update({ q: undefined });
      },
    });
  }
  panel.sectors.forEach((name) =>
    chips.push({
      key: `sector-${name}`,
      label: name,
      onRemove: () => applyPanel({ ...panel, sectors: panel.sectors.filter((s) => s !== name) }),
    }),
  );
  if (panel.mcapMin !== undefined || panel.mcapMax !== undefined) {
    chips.push({
      key: "mcap",
      label: mcapLabel(),
      onRemove: () => applyPanel({ ...panel, mcapMin: undefined, mcapMax: undefined }),
    });
  }
  if (panel.change !== "all") {
    chips.push({
      key: "change",
      label: panel.change === "gainers" ? "Gainers" : "Losers",
      onRemove: () => applyPanel({ ...panel, change: "all" }),
    });
  }
  if (panel.minPrice !== undefined || panel.maxPrice !== undefined) {
    chips.push({
      key: "price",
      label: `Price: ${panel.minPrice !== undefined ? formatINR(panel.minPrice) : "Any"} – ${
        panel.maxPrice !== undefined ? formatINR(panel.maxPrice) : "Any"
      }`,
      onRemove: () => applyPanel({ ...panel, minPrice: undefined, maxPrice: undefined }),
    });
  }

  const quickViews: { label: string; active: boolean; onClick: () => void }[] = [
    {
      label: "Largest by market cap",
      active: filters.sort === "mcap" && panel.change === "all",
      onClick: () => update({ sort: undefined, change: undefined }),
    },
    {
      label: "Top gainers",
      active: panel.change === "gainers" && filters.sort === "change",
      onClick: () => update({ change: "gainers", sort: "change" }),
    },
    {
      label: "Top losers",
      active: panel.change === "losers" && filters.sort === "change_asc",
      onClick: () => update({ change: "losers", sort: "change_asc" }),
    },
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const asOf = formatAsOf(data?.meta.pricesAsOf ?? null);
  const delayed = data !== null && (data.meta.staleCount > 0 || !data.meta.dayChangeAvailable);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#FAF9F5] font-sans">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Top bar (same pattern as the other pages) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm md:px-8">
          <div className="flex items-center gap-2 md:gap-3">
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
              className={`group rounded text-sm font-medium text-slate-600 transition-colors hover:text-[#0F4C3A] ${FOCUS}`}
            >
              <span className="inline-block transition-transform motion-safe:group-hover:-translate-x-0.5">
                ←
              </span>{" "}
              Dashboard
            </button>
          </div>
          <HeaderActions
            balance={
              summary.status === "ok"
                ? summary.balance
                : summary.status === "loading"
                  ? null
                  : undefined
            }
          />
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 md:px-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              FINGROW / MARKETS
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight text-slate-900">
              Explore Stocks
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Search and filter every stock available for paper trading.
            </p>
          </div>

          {/* Asset type tabs */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() =>
                  update({
                    type: t.value === "equity" ? undefined : t.value,
                    sector: undefined,
                    mcap_min: undefined,
                    mcap_max: undefined,
                  })
                }
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors motion-safe:active:scale-[0.97] motion-reduce:transition-none ${FOCUS} ${
                  type === t.value
                    ? "bg-[#0B1B2E] text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}{" "}
                {facets && (
                  <span className="tabular-nums opacity-70">{facets.types[t.value]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Quick views: real filters/sorts, nothing invented */}
          {type === "equity" && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {quickViews.map((view) => (
                <button
                  key={view.label}
                  type="button"
                  aria-pressed={view.active}
                  onClick={view.onClick}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors motion-reduce:transition-none ${FOCUS} ${
                    view.active
                      ? "bg-emerald-50 text-[#0F4C3A] ring-1 ring-[#0F4C3A]/30"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          )}

          {/* Sticky toolbar */}
          <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200/70 bg-[#FAF9F5]/95 px-4 py-2 backdrop-blur-sm md:-mx-8 md:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <FiSearch
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search by symbol or company..."
                  aria-label="Search stocks"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0F4C3A]/40 focus:ring-2 focus:ring-[#0F4C3A]/10"
                />
                {qInput && (
                  <button
                    type="button"
                    onClick={() => setQInput("")}
                    aria-label="Clear search"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 ${FOCUS}`}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-500">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={filters.sort}
                  onChange={(e) =>
                    update({ sort: e.target.value === "mcap" ? undefined : e.target.value })
                  }
                  className={`h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 ${FOCUS}`}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setDraft(panel);
                  setSheetOpen(true);
                }}
                aria-haspopup="dialog"
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden ${FOCUS}`}
              >
                <FiFilter size={14} aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-[#0F4C3A] px-1.5 text-xs font-semibold tabular-nums text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <p
                aria-live="polite"
                className="ml-auto text-sm tabular-nums text-slate-500"
              >
                {data
                  ? `${data.total} ${data.total === 1 ? tab.one : tab.many}`
                  : "Loading…"}
              </p>

              {anythingActive && (
                <button
                  type="button"
                  onClick={clearAll}
                  className={`rounded text-sm font-medium text-[#0F4C3A] hover:underline ${FOCUS}`}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notices */}
          {delayed && (
            <p
              role="status"
              className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <FiAlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                Prices may be delayed
                {asOf ? ` (last updated ${asOf})` : ""}.
                {!dayChangeAvailable && " Day change is unavailable right now."}
              </span>
            </p>
          )}
          {!delayed && asOf && (
            <p className="mt-2 text-xs text-slate-400">Prices as of {asOf}</p>
          )}
          {notice && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {notice}
            </p>
          )}

          {/* Applied filter chips */}
          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
              {chips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={c.onRemove}
                    aria-label={`Remove filter: ${c.label}`}
                    className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}
                  >
                    {c.label}
                    <FiX size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-start gap-5">
            {/* Desktop filter rail */}
            <aside
              aria-label="Filters"
              className="sticky top-[7.5rem] hidden max-h-[calc(100vh-8.5rem)] w-[260px] shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white px-4 py-1 lg:block"
            >
              <FilterPanel
                idPrefix={`${panelId}-rail`}
                type={type}
                facets={facets}
                value={panel}
                dayChangeAvailable={dayChangeAvailable}
                onChange={applyPanel}
              />
            </aside>

            {/* Results */}
            <section
              aria-label="Results"
              aria-busy={refetching || firstLoad}
              className={`min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-opacity motion-reduce:transition-none md:px-5 ${
                refetching ? "opacity-60" : ""
              }`}
            >
              {firstLoad ? (
                <ResultsSkeleton />
              ) : error && !data ? (
                <div className="py-8 text-center" role="alert">
                  <p className="mb-4 text-sm text-red-600">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRetry((n) => n + 1)}
                    className={`rounded-lg bg-[#0F4C3A] px-4 py-2 text-sm text-white transition-colors hover:bg-[#0B3528] motion-safe:active:scale-[0.98] ${FOCUS}`}
                  >
                    Retry
                  </button>
                </div>
              ) : data && data.items.length === 0 ? (
                <div className="py-10 text-center">
                  <h2 className="font-semibold text-slate-800">No {tab.many} match</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Try a different search or fewer filters.
                  </p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className={`mt-3 rounded text-sm font-medium text-[#0F4C3A] hover:underline ${FOCUS}`}
                  >
                    Clear filters
                  </button>
                </div>
              ) : data ? (
                <>
                  {error && (
                    <p role="alert" className="mb-3 text-sm text-red-600">
                      {error}{" "}
                      <button
                        type="button"
                        onClick={() => setRetry((n) => n + 1)}
                        className={`rounded font-semibold underline ${FOCUS}`}
                      >
                        Retry
                      </button>
                    </p>
                  )}
                  <ResultsTable items={data.items} actions={actions} />
                  <ResultsCards items={data.items} actions={actions} />

                  {totalPages > 1 && (
                    <nav
                      aria-label="Pagination"
                      className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          update({ page: String(data.page - 1) }, { keepPage: true })
                        }
                        disabled={data.page <= 1}
                        className={`rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 ${FOCUS}`}
                      >
                        Previous
                      </button>
                      <span className="text-sm tabular-nums text-slate-500">
                        Page {data.page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          update({ page: String(data.page + 1) }, { keepPage: true })
                        }
                        disabled={data.page >= totalPages}
                        className={`rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 ${FOCUS}`}
                      >
                        Next
                      </button>
                    </nav>
                  )}
                </>
              ) : null}
            </section>
          </div>
        </main>

        {/* Mobile filter sheet */}
        <AnimatePresence>
          {sheetOpen && (
            <div key="sheet" className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={() => setSheetOpen(false)}
              />
              <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                tabIndex={-1}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white outline-none"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="font-serif text-lg font-semibold text-slate-900">Filters</h2>
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close filters"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 ${FOCUS}`}
                  >
                    <FiX size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4">
                  <FilterPanel
                    idPrefix={`${sheetId}-sheet`}
                    type={type}
                    facets={facets}
                    value={draft}
                    dayChangeAvailable={dayChangeAvailable}
                    onChange={setDraft}
                  />
                </div>

                <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setDraft(EMPTY_PANEL)}
                    className={`flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyPanel(draft);
                      setSheetOpen(false);
                    }}
                    className={`flex-1 rounded-lg bg-[#0F4C3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3528] ${FOCUS}`}
                  >
                    Apply
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}