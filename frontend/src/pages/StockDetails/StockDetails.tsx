import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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

export default function StockDetails() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState("1Y");

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
        setError("Unable to load stock data.");
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [symbol]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-500">Loading stock data...</p>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 mb-6"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-red-600 font-medium">
            {error || "Stock data unavailable."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6">
      {/* Back */}
      <button
        onClick={() => navigate("/dashboard")}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 mb-6"
      >
        ← Back to Dashboard
      </button>

      {/* Stock Header + Market Statistics */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">
                {stock.symbol.replace(".NS", "")}
              </h1>

              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                {displayExchange(stock.exchange, stock.symbol)}
              </span>
            </div>

            <p className="text-sm text-slate-400 mt-1">
              {stock.company || "Company name unavailable"}
            </p>

            <p className="text-xs text-slate-400 mt-1">{stock.symbol}</p>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">
              {formatINR(stock.price)}
            </p>

            {stock.change != null && stock.changePercent != null && (
              <p
                className={`text-sm font-semibold mt-1 ${
                  stock.change >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {stock.change >= 0 ? "▲" : "▼"} {stock.change >= 0 ? "+" : "-"}₹
                {Math.abs(stock.change).toFixed(2)} (
                {Math.abs(stock.changePercent).toFixed(2)}%)
              </p>
            )}
          </div>
        </div>

        {/* Market Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6 mt-6 pt-6 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Previous Close</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatINR(stock.previousClose)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Open</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatINR(stock.open)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Day High</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatINR(stock.dayHigh)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Day Low</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatINR(stock.dayLow)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Volume</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatVolume(stock.volume)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Market Cap</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatMarketCap(stock.marketCap)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Exchange</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {displayExchange(stock.exchange, stock.symbol)}
            </p>
          </div>
        </div>
      </div>

      {/* Price History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        {/* Chart Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Price History
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Historical closing price
            </p>
          </div>

          {/* Range Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["1W", "1M", "6M", "1Y"].map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
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
        <div className="h-[350px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 11,
                    fill: "#94a3b8",
                  }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
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
                    fill: "#94a3b8",
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
                  labelFormatter={(label) =>
                    new Date(String(label)).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  }
                />

                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#0F4C3A"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
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
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
  <div className="mb-6">
    <h2 className="text-lg font-semibold text-slate-900">
      Fundamentals
    </h2>
    <p className="text-sm text-slate-400 mt-1">
      Key financial metrics
    </p>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
    <div>
      <p className="text-xs text-slate-400">P/E Ratio</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.peRatio != null ? stock.peRatio.toFixed(2) : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">EPS</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.eps != null ? formatINR(stock.eps) : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">Dividend Yield</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.dividendYield != null
          ? `${stock.dividendYield.toFixed(2)}%`
          : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">P/B Ratio</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.priceToBook != null
          ? stock.priceToBook.toFixed(2)
          : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">Book Value</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.bookValue != null ? formatINR(stock.bookValue) : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">52W High</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.week52High != null ? formatINR(stock.week52High) : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">52W Low</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.week52Low != null ? formatINR(stock.week52Low) : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">ROE</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.returnOnEquity != null
          ? `${(stock.returnOnEquity * 100).toFixed(2)}%`
          : "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">Sector</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.sector || "N/A"}
      </p>
    </div>

    <div>
      <p className="text-xs text-slate-400">Industry</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">
        {stock.industry || "N/A"}
      </p>
    </div>
  </div>
</div>
    </>
  );
}
