// Read-only client for GET /market/explore (public route, same as /market/stock).
// Filters live in the URL on the page; this file only turns them into a request.

const BASE_URL = "http://127.0.0.1:8000";

export type AssetType = "equity" | "etf" | "index";
export type SortKey = "mcap" | "price" | "price_asc" | "change" | "change_asc" | "az";
export type ChangeFilter = "all" | "gainers" | "losers";

export type ExploreItem = {
  id: string;
  symbol: string; // e.g. RELIANCE.NS (show without ".NS")
  company: string;
  sector: string | null;
  assetType: AssetType;
  exchange: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null; // rupees
  marketCapCr: number | null; // Rs crore
  updatedAt: string | null;
  priceStale: boolean;
};

export type ExploreFacets = {
  types: Record<AssetType, number>;
  sectors: { name: string; count: number }[];
  mcap: {
    key: string;
    label: string;
    min: number;
    max: number | null;
    count: number;
  }[];
  change: { all: number; gainers: number; losers: number; unknown: number };
  price: { min: number | null; max: number | null };
};

export type ExploreResponse = {
  items: ExploreItem[];
  total: number;
  page: number;
  page_size: number;
  facets: ExploreFacets;
  meta: {
    pricesAsOf: string | null;
    staleCount: number;
    dayChangeAvailable: boolean;
  };
};

export type ExploreParams = {
  q?: string;
  type?: AssetType;
  sectors?: string[];
  mcapMin?: number;
  mcapMax?: number;
  change?: ChangeFilter;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
};

export function buildExploreQuery(params: ExploreParams): string {
  const search = new URLSearchParams();

  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.type) search.set("type", params.type);
  if (params.sectors?.length) search.set("sector", params.sectors.join(","));
  if (params.mcapMin !== undefined) search.set("mcap_min", String(params.mcapMin));
  if (params.mcapMax !== undefined) search.set("mcap_max", String(params.mcapMax));
  if (params.change && params.change !== "all") search.set("change", params.change);
  if (params.minPrice !== undefined) search.set("min_price", String(params.minPrice));
  if (params.maxPrice !== undefined) search.set("max_price", String(params.maxPrice));
  if (params.sort) search.set("sort", params.sort);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));

  return search.toString();
}

export async function getExplore(
  params: ExploreParams,
  signal?: AbortSignal,
): Promise<ExploreResponse> {
  const query = buildExploreQuery(params);
  const response = await fetch(
    `${BASE_URL}/market/explore${query ? `?${query}` : ""}`,
    { signal },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      typeof errorData.detail === "string"
        ? errorData.detail
        : "Failed to load stocks",
    );
  }

  return response.json() as Promise<ExploreResponse>;
}