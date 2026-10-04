import React, {
  useEffect,
  useState,
  useRef,
} from "react";

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
} from "react-icons/fi";

import { supabase } from "../../lib/supabase";

import {
  getPortfolioSummary,
  buyStock,
} from "../../services/portfolioService";

import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
} from "../../services/watchlist";

export default function Dashboard() {
  const navigate = useNavigate();

  // =====================================================
  // USER / UI STATE
  // =====================================================

  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const profileRef = useRef(null);
  const skipNextSearch = useRef(false);

  // =====================================================
  // MARKET / PORTFOLIO STATE
  // =====================================================

  const [nifty, setNifty] = useState(null);
  const [sensex, setSensex] =
    useState(null);

  const [marketMovers, setMarketMovers] =
    useState(null);

  const [portfolio, setPortfolio] =
    useState(null);

  // =====================================================
  // STOCK SEARCH STATE
  // =====================================================

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [selectedStock, setSelectedStock] =
    useState(null);

  // =====================================================
  // WATCHLIST STATE
  // =====================================================

  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState("");

  // =====================================================
  // PAPER TRADE STATE
  // =====================================================

  const [tradeStock, setTradeStock] =
    useState(null);

  const [tradeMode, setTradeMode] =
    useState("quantity");

  const [tradeAmount, setTradeAmount] =
    useState("");

  const [tradeQuantity, setTradeQuantity] =
    useState(1);

  const [tradeLoading, setTradeLoading] =
    useState(false);

  const [tradeError, setTradeError] =
    useState("");

  // =====================================================
  // STOCK FORMATTING HELPERS
  // =====================================================

  const formatINR = (value) => {
    if (
      value == null ||
      Number.isNaN(Number(value))
    ) {
      return "N/A";
    }

    return `₹${Number(value).toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`;
  };

  const formatVolume = (value) => {
    if (
      value == null ||
      Number.isNaN(Number(value))
    ) {
      return "N/A";
    }

    const volume = Number(value);

    if (volume >= 1e7) {
      return `${(
        volume / 1e7
      ).toFixed(2)} Cr`;
    }

    if (volume >= 1e5) {
      return `${(
        volume / 1e5
      ).toFixed(2)} L`;
    }

    if (volume >= 1e3) {
      return `${(
        volume / 1e3
      ).toFixed(2)} K`;
    }

    return volume.toLocaleString(
      "en-IN",
    );
  };

  const formatMarketCap = (value) => {
    if (
      value == null ||
      Number.isNaN(Number(value))
    ) {
      return "N/A";
    }

    const cap = Number(value);

    if (cap >= 1e12) {
      return `₹${(
        cap / 1e12
      ).toFixed(2)} L Cr`;
    }

    if (cap >= 1e7) {
      return `₹${(
        cap / 1e7
      ).toFixed(2)} Cr`;
    }

    if (cap >= 1e5) {
      return `₹${(
        cap / 1e5
      ).toFixed(2)} L`;
    }

    return `₹${cap.toLocaleString(
      "en-IN",
    )}`;
  };

  const displayExchange = (
    exchange,
    symbol,
  ) => {
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
    const searchStocksWithDelay =
      async () => {
        const query =
          searchQuery.trim();

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

          const results =
            await searchStocks(query);

          setSearchResults(
            results,
          );
        } catch (error) {
          console.error(
            "Stock search failed:",
            error,
          );

          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      };

    const timer = setTimeout(
      searchStocksWithDelay,
      300,
    );

    return () =>
      clearTimeout(timer);
  }, [searchQuery]);

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  useEffect(() => {
    const loadDashboard =
      async () => {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          navigate("/login");
          return;
        }

        // =================================================
        // PROFILE
        // =================================================

        const {
          data: profileData,
        } = await supabase
          .from("profiles")
          .select("full_name")
          .eq(
            "user_id",
            user.id,
          )
          .maybeSingle();

        const googleName =
          user.user_metadata
            ?.full_name ||
          user.user_metadata
            ?.name ||
          "";

        const fullName =
          profileData?.full_name?.trim() ||
          googleName.trim() ||
          "";

        setProfile({
          full_name:
            fullName,
          email:
            user.email,
        });

        // =================================================
        // MARKET + PORTFOLIO
        // =================================================

        const [
          niftyResult,
          sensexResult,
          moversResult,
          portfolioResult,
        ] =
          await Promise.allSettled([
            getNifty(),
            getSensex(),
            getMarketMovers(),
            getPortfolioSummary(),
          ]);

        // NIFTY

        if (
          niftyResult.status ===
          "fulfilled"
        ) {
          setNifty(
            niftyResult.value,
          );
        } else {
          console.error(
            "Nifty failed:",
            niftyResult.reason,
          );
        }

        // SENSEX

        if (
          sensexResult.status ===
          "fulfilled"
        ) {
          setSensex(
            sensexResult.value,
          );
        } else {
          console.error(
            "Sensex failed:",
            sensexResult.reason,
          );
        }

        // MARKET MOVERS

        if (
          moversResult.status ===
          "fulfilled"
        ) {
          setMarketMovers(
            moversResult.value,
          );
        } else {
          console.error(
            "Market movers failed:",
            moversResult.reason,
          );
        }

        // PORTFOLIO

        if (
          portfolioResult.status ===
          "fulfilled"
        ) {
          setPortfolio(
            portfolioResult.value,
          );
        } else {
          console.error(
            "Portfolio failed:",
            portfolioResult.reason,
          );
        }
      };

    loadDashboard();
  }, [navigate]);

  // =====================================================
  // CLOSE PROFILE DROPDOWN
  // =====================================================

  useEffect(() => {
    const handleClickOutside =
      (event) => {
        if (
          profileRef.current &&
          !profileRef.current.contains(
            event.target,
          )
        ) {
          setProfileOpen(false);
        }
      };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

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

  const handleStockSelect =
    async (stock) => {
      try {
        const data =
          await getStock(
            stock.symbol,
          );

        // =================================================
        // GET REAL SUPABASE STOCK ID
        // =================================================

        const {
          data: stockRow,
          error: stockError,
        } = await supabase
          .from("stocks")
          .select("id")
          .eq(
            "symbol",
            stock.symbol,
          )
          .maybeSingle();

        if (
          stockError ||
          !stockRow
        ) {
          throw new Error(
            "Could not find this stock in FinGrow.",
          );
        }

        // Add stock_id to the
        // live market response.
        const stockWithId = {
          ...data,
          stock_id:
            stockRow.id,
        };

        setSelectedStock(
          stockWithId,
        );

        // Prevent the selected stock
        // symbol from triggering a new search.
        skipNextSearch.current =
          true;

        setSearchQuery(
          stock.symbol.replace(
            ".NS",
            "",
          ),
        );

        setSearchResults([]);

        setSearchLoading(
          false,
        );
      } catch (error) {
        console.error(
          "Failed to load stock:",
          error,
        );
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

  const handleOpenTrade = (
    stock,
  ) => {
    setTradeStock(stock);

    // Start with quantity mode
    // for a stock searched directly.
    setTradeMode(
      "quantity",
    );

    setTradeQuantity(1);
    setTradeAmount("");
    setTradeError("");
  };

  // =====================================================
  // CLOSE PAPER TRADE
  // =====================================================

  const handleCloseTrade =
    () => {
      if (tradeLoading) {
        return;
      }

      setTradeStock(null);
      setTradeMode(
        "quantity",
      );
      setTradeQuantity(1);
      setTradeAmount("");
      setTradeError("");
    };

  // =====================================================
  // PAPER TRADE CALCULATIONS
  // =====================================================

  const tradePrice =
    tradeStock
      ? Number(
        tradeStock.price,
      )
      : 0;

  const enteredAmount =
    Number(tradeAmount);

  const calculatedQuantity =
    tradeMode === "amount"
      ? tradePrice > 0 &&
        Number.isFinite(
          enteredAmount,
        ) &&
        enteredAmount > 0
        ? Math.floor(
          enteredAmount /
          tradePrice,
        )
        : 0
      : tradeQuantity;

  const estimatedTradeValue =
    tradePrice *
    calculatedQuantity;

  const remainingAmount =
    tradeMode ===
      "amount" &&
      enteredAmount > 0 &&
      calculatedQuantity > 0
      ? Math.max(
        0,
        enteredAmount -
        estimatedTradeValue,
      )
      : 0;

  // =====================================================
  // CONFIRM BUY
  // =====================================================

  const handleConfirmBuy =
    async () => {
      if (!tradeStock) {
        return;
      }

      let quantity;

      // =================================================
      // INVEST BY AMOUNT
      // =================================================

      if (
        tradeMode ===
        "amount"
      ) {
        const amount =
          Number(
            tradeAmount,
          );

        if (
          !Number.isFinite(
            amount,
          ) ||
          amount <= 0
        ) {
          setTradeError(
            "Please enter a valid investment amount.",
          );
          return;
        }

        if (
          !Number.isFinite(
            tradePrice,
          ) ||
          tradePrice <= 0
        ) {
          setTradeError(
            "Stock price is not available.",
          );
          return;
        }

        // Whole-share execution.
        quantity =
          Math.floor(
            amount /
            tradePrice,
          );

        if (
          quantity < 1
        ) {
          setTradeError(
            `Minimum amount required for 1 share is ${formatINR(
              tradePrice,
            )}.`,
          );
          return;
        }
      } else {
        // =================================================
        // BUY BY SHARES
        // =================================================

        quantity =
          Math.floor(
            Number(
              tradeQuantity,
            ),
          );

        if (
          !Number.isInteger(
            quantity,
          ) ||
          quantity <= 0
        ) {
          setTradeError(
            "Number of shares must be greater than 0.",
          );
          return;
        }
      }

      try {
        setTradeLoading(
          true,
        );
        setTradeError("");

        // =================================================
        // EXECUTE EXISTING PAPER TRADE
        // =================================================

        await buyStock(
          tradeStock.stock_id,
          quantity,
        );

        // =================================================
        // REFRESH WALLET
        // =================================================

        const updatedPortfolio =
          await getPortfolioSummary();

        setPortfolio(
          updatedPortfolio,
        );

        // =================================================
        // CLOSE MODAL
        // =================================================

        setTradeStock(null);
        setTradeMode(
          "quantity",
        );
        setTradeQuantity(1);
        setTradeAmount("");
        setTradeError("");
      } catch (error) {
        console.error(
          "Paper BUY failed:",
          error,
        );

        setTradeError(
          error instanceof Error
            ? error.message
            : "Could not complete paper trade.",
        );
      } finally {
        setTradeLoading(
          false,
        );
      }
    };

  // =====================================================
  // USER INFO
  // =====================================================

  const fullName =
    profile?.full_name?.trim() ||
    "";

  const nameParts =
    fullName.split(
      /\s+/,
    );

  const firstName =
    nameParts[0] ||
    "there";

  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[
      nameParts.length -
      1
      ][0]
      }`
      : nameParts[0]?.slice(
        0,
        2,
      );

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout =
    async () => {
      await supabase.auth.signOut();
      navigate("/login");
    };

  // =====================================================
  // DATE
  // =====================================================

  const today =
    new Date().toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
      },
    );

  // =====================================================
  // NAV ITEMS
  // =====================================================

  const navItems = [
    "Dashboard",
    "AI Picks",
    "Portfolio",
    "Watchlist",
    "Learn",
    "Settings",
  ];

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-[#0B1B2E] flex flex-col z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
          }`}
      >
        {/* Logo */}

        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
              F
            </div>

            <span className="font-bold text-lg text-white font-serif tracking-tight">
              FinGrow
            </span>
          </div>

          <button
            onClick={() =>
              setSidebarOpen(false)
            }
            className="text-slate-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(
            (item) => {
              const active =
                item ===
                "Dashboard";

              return (
                <button
                  key={item}
                  onClick={() => {
                    if (
                      item ===
                      "Dashboard"
                    ) {
                      setSidebarOpen(
                        false,
                      );
                      setSelectedStock(
                        null,
                      );
                      setSearchQuery(
                        "",
                      );
                      setSearchResults(
                        [],
                      );
                      return;
                    }

                    if (
                      item ===
                      "AI Picks"
                    ) {
                      setSidebarOpen(
                        false,
                      );
                      navigate(
                        "/ai-picks",
                      );
                      return;
                    }

                    if (
                      item ===
                      "Settings"
                    ) {
                      setSidebarOpen(
                        false,
                      );
                      navigate(
                        "/settings",
                      );
                      return;
                    }

                    if (item === "Watchlist") {
                      setSidebarOpen(false);
                      navigate("/watchlist");
                      return;
                    }
                    if (item === "Learn") {
                      setSidebarOpen(false);
                      navigate("/learn");

                      return;
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : "bg-slate-500"
                      }`}


                  />

                  {item}
                </button>
              );
            },
          )}
        </nav>

        <div className="px-6 py-6 border-t border-white/10">
          <p className="text-[11px] text-slate-500">
            Paper trading · virtual funds only
          </p>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="flex-1 flex flex-col">
        {/* =====================================================
            TOP BAR
        ===================================================== */}

        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10">
          {/* Left */}

          <div className="flex items-center gap-4">
            {/* Hamburger */}

            <button
              onClick={() =>
                setSidebarOpen(true)
              }
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
              aria-label="Open menu"
            >
              ☰
            </button>

            {/* Search */}

            <div className="relative">
              <input
                type="text"
                placeholder="Search stocks..."
                value={
                  searchQuery
                }
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value,
                  )
                }
                className="w-80 px-4 py-2 rounded-lg border border-slate-200 bg-[#FAFBFD] text-sm focus:outline-none focus:border-[#0F4C3A]"
              />

              {searchQuery &&
                (searchResults.length >
                  0 ||
                  searchLoading) && (
                  <div className="absolute top-11 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {searchLoading && (
                      <p className="px-4 py-3 text-sm text-slate-400">
                        Searching...
                      </p>
                    )}

                    {!searchLoading &&
                      searchResults.length ===
                      0 && (
                        <p className="px-4 py-3 text-sm text-slate-400">
                          No stocks found
                        </p>
                      )}

                    {!searchLoading &&
                      searchResults.map(
                        (stock) => (
                          <button
                            key={
                              stock.symbol
                            }
                            onClick={() =>
                              handleStockSelect(
                                stock,
                              )
                            }
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition"
                          >
                            <p className="font-semibold text-sm text-slate-900">
                              {stock.symbol.replace(
                                ".NS",
                                "",
                              )}
                            </p>

                            <p className="text-xs text-slate-400">
                              {
                                stock.name
                              }
                            </p>
                          </button>
                        ),
                      )}
                  </div>
                )}
            </div>
          </div>

          {/* Right */}

          <div className="flex items-center gap-6">
            {/* Wallet */}

            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
                WALLET
              </p>

              <p className="text-sm font-bold text-slate-800">
                {portfolio

                  ? `₹${Number(portfolio.available_balance).toLocaleString(
                    "en-IN",
                    {
                      minimumFractionDigits: 2,
                    },
                  )}`

                  : "Loading..."}
              </p>
            </div>

            {/* Notification */}

            <button
              type="button"
              className="w-9 h-9 rounded-full bg-[#FFF8E8] flex items-center justify-center text-lg"
              aria-label="Notifications"
            >
              🔔
            </button>

            {/* Profile */}

            <div
              ref={
                profileRef
              }
              className="relative"
            >
              <button
                onClick={() =>
                  setProfileOpen(
                    !profileOpen,
                  )
                }
                className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A] hover:ring-2 hover:ring-emerald-200 transition"
                aria-label="Open profile menu"
              >
                {initials
                  ? initials.toUpperCase()
                  : "U"}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {/* User Info */}

                  <div className="px-4 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
                        {initials
                          ? initials.toUpperCase()
                          : "U"}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {firstName ===
                            "there"
                            ? "User"
                            : firstName}
                        </p>

                        <p className="text-xs text-slate-400 truncate">
                          {
                            profile?.email
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Settings */}

                  <button
                    onClick={() => {
                      setProfileOpen(
                        false,
                      );
                      navigate(
                        "/settings",
                      );
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FiSettings
                      size={17}
                    />

                    Settings
                  </button>

                  {/* Logout */}

                  <button
                    onClick={
                      handleLogout
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <FiLogOut
                      size={17}
                    />

                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* =====================================================
            DASHBOARD
        ===================================================== */}

        <main className="flex-1 px-10 py-7 space-y-5">
          {/* Greeting */}

          <div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              {today}
            </p>

            <h1 className="text-3xl font-serif font-semibold text-slate-900 mt-1">
              Hello,{" "}
              {firstName} 👋
            </h1>
          </div>

          {/* =================================================
              SELECTED STOCK
          ================================================= */}

          {selectedStock && (
            <div
              onClick={() =>
                navigate(
                  `/stock/${selectedStock.symbol}`,
                )
              }
              className="bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:border-slate-300 transition"
            >
              {/* Header */}

              <div className="flex items-start justify-between gap-6">
                {/* Stock Information */}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900">
                      {selectedStock.symbol.replace(
                        ".NS",
                        "",
                      )}
                    </h2>

                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      {displayExchange(
                        selectedStock.exchange,
                        selectedStock.symbol,
                      )}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 mt-1">
                    {selectedStock.company ||
                      "Company name unavailable"}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    {selectedStock.symbol}
                  </p>
                </div>
                {/* Watchlist Button (middle) */}

                <div className="flex flex-col items-center self-center">
                  <button
                    type="button"
                    onClick={handleWatchlistToggle}
                    disabled={watchlistLoading || !selectedStock.stock_id}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="text-base">
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

                  {watchlistError && (
                    <p className="text-xs text-red-600 mt-2 text-center">
                      {watchlistError}
                    </p>
                  )}
                </div>

                {/* Current Price */}
                {/* Current Price */}

                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatINR(
                      selectedStock.price,
                    )}
                  </p>

                  {selectedStock.change !=
                    null &&
                    selectedStock.changePercent !=
                    null && (
                      <p

                        className={`text-sm font-semibold mt-1 ${Number(selectedStock.change) >= 0

                          ? "text-emerald-600"
                          : "text-red-600"
                          }`}
                      >
                        {Number(
                          selectedStock.change,
                        ) >=
                          0
                          ? "▲"
                          : "▼"}{" "}
                        {Number(
                          selectedStock.change,
                        ) >=
                          0
                          ? "+"
                          : "-"}
                        ₹
                        {Math.abs(
                          Number(
                            selectedStock.change,
                          ),
                        ).toFixed(
                          2,
                        )}{" "}
                        (
                        {Math.abs(
                          Number(
                            selectedStock.changePercent,
                          ),
                        ).toFixed(
                          2,
                        )}
                        %)
                        {" today"}
                      </p>
                    )}
                </div>
              </div>

              {/* Market Statistics */}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 mt-5 pt-5 border-t border-slate-100">
                {/* Previous Close */}

                <div>
                  <p className="text-xs text-slate-400">
                    Previous Close
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(
                      selectedStock.previousClose,
                    )}
                  </p>
                </div>

                {/* Open */}

                <div>
                  <p className="text-xs text-slate-400">
                    Open
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(
                      selectedStock.open,
                    )}
                  </p>
                </div>

                {/* Day High */}

                <div>
                  <p className="text-xs text-slate-400">
                    Day High
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(
                      selectedStock.dayHigh,
                    )}
                  </p>
                </div>

                {/* Day Low */}

                <div>
                  <p className="text-xs text-slate-400">
                    Day Low
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatINR(
                      selectedStock.dayLow,
                    )}
                  </p>
                </div>

                {/* Volume */}

                <div>
                  <p className="text-xs text-slate-400">
                    Volume
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatVolume(
                      selectedStock.volume,
                    )}
                  </p>
                </div>

                {/* Market Cap */}

                <div>
                  <p className="text-xs text-slate-400">
                    Market Cap
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatMarketCap(
                      selectedStock.marketCap,
                    )}
                  </p>
                </div>

                {/* Exchange */}

                <div>
                  <p className="text-xs text-slate-400">
                    Exchange
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {displayExchange(
                      selectedStock.exchange,
                      selectedStock.symbol,
                    )}
                  </p>
                </div>
              </div>

              {/* Paper Trade */}

              <div className="mt-5 pt-5 border-t border-slate-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();

                    handleOpenTrade(
                      selectedStock,
                    );
                  }}
                  className="w-full rounded-xl bg-[#0F4C3A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B3528]"
                >
                  Paper Trade
                </button>
              </div>
            </div>
          )}

          {/* =================================================
              STAT CARDS
          ================================================= */}

          <div className="grid grid-cols-3 gap-5">
            {/* Portfolio */}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Total Portfolio Value
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {portfolio

                  ? `₹${Number(portfolio.total_value).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  },
                  )}`



                  : "Loading..."}
              </p>

              <p

                className={`text-xs font-semibold mt-1 ${portfolio && portfolio.overall_pnl >= 0

                  ? "text-emerald-600"
                  : "text-red-600"
                  }`}
              >
                {portfolio

                  ? `${portfolio.overall_pnl >= 0 ? "▲ +" : "▼ -"}₹${Math.abs(
                    Number(portfolio.overall_pnl),
                  ).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })} overall`

                  : "Loading..."}
              </p>
            </div>

            {/* Today's P&L */}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Today's P&L
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {portfolio

                  ? `${portfolio.today_pnl >= 0 ? "+" : "-"}₹${Math.abs(
                    Number(portfolio.today_pnl),
                  ).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}`

                  : "Loading..."}
              </p>

              <p

                className={`text-xs font-semibold mt-1 ${portfolio && portfolio.today_pnl >= 0

                  ? "text-emerald-600"
                  : "text-red-600"
                  }`}
              >
                {portfolio

                  ? `${portfolio.today_pnl >= 0 ? "▲ +" : "▼ "}${Math.abs(
                    Number(portfolio.today_pnl_percent),
                  ).toFixed(2)}% today`

                  : "Loading..."}
              </p>
            </div>

            {/* Market */}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Market Today
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {nifty?.price

                  ? `₹${Number(nifty.price).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  },)}`

                  : "Loading..."}
              </p>

              <p

                className={`text-xs font-semibold mt-1 ${nifty && nifty.changePercent >= 0

                  ? "text-emerald-600"
                  : "text-red-600"
                  }`}
              >
                {nifty

                  ? `${nifty.changePercent >= 0 ? "▲ +" : "▼ -"}${Math.abs(
                    nifty.changePercent,
                  ).toFixed(2)}% today`

                  : "Loading..."}
              </p>

              <p className="text-[11px] text-slate-400 mt-1">
                NIFTY 50
              </p>
            </div>
          </div>

          {/* =================================================
              MARKET STOCKS
          ================================================= */}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-serif font-semibold text-slate-900">
                  Market Stocks
                </h2>

                <p className="text-xs text-slate-400 mt-1">
                  Latest market prices
                </p>
              </div>
            </div>

            {!marketMovers ? (
              <p className="text-sm text-slate-400">
                Loading stocks...
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {/* =================================================
                    TOP GAINERS
                ================================================= */}

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Top Gainers
                  </h3>

                  <div className="space-y-2">
                    {marketMovers.gainers
                      ?.slice(
                        0,
                        3,
                      )
                      .map(
                        (stock) => (
                          <div
                            key={
                              stock.symbol
                            }
                            className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-semibold text-sm text-slate-900">
                                  {stock.symbol.replace(
                                    ".NS",
                                    "",
                                  )}
                                </p>

                                <p className="text-[11px] text-slate-400">
                                  NSE
                                </p>
                              </div>

                              <p className="text-base font-bold text-slate-900">
                                ₹
                                {Number(
                                  stock.price,
                                ).toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 2,
                                  },
                                )}
                              </p>
                            </div>

                            <span className="text-xs font-semibold text-emerald-600">
                              ▲{" "}
                              {
                                stock.change_percent
                              }
                              %
                            </span>
                          </div>
                        ),
                      )}
                  </div>
                </div>

                {/* =================================================
                    TOP LOSERS
                ================================================= */}

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Top Losers
                  </h3>

                  <div className="space-y-2">
                    {marketMovers.losers
                      ?.slice(
                        0,
                        3,
                      )
                      .map(
                        (stock) => (
                          <div
                            key={
                              stock.symbol
                            }
                            className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-semibold text-sm text-slate-900">
                                  {stock.symbol.replace(
                                    ".NS",
                                    "",
                                  )}
                                </p>

                                <p className="text-[11px] text-slate-400">
                                  NSE
                                </p>
                              </div>

                              <p className="text-base font-bold text-slate-900">
                                ₹
                                {Number(
                                  stock.price,
                                ).toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 2,
                                  },
                                )}
                              </p>
                            </div>

                            <span className="text-xs font-semibold text-red-600">
                              ▼{" "}
                              {Math.abs(
                                stock.change_percent,
                              )}
                              %
                            </span>
                          </div>
                        ),
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* =====================================================
          PAPER TRADE MODAL
      ===================================================== */}

      {tradeStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            {/* Header */}

            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Paper Trade
                </p>

                <h2 className="mt-1 text-2xl font-bold text-[#0B3528]">
                  {tradeStock.symbol.replace(
                    ".NS",
                    "",
                  )}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {tradeStock.company ||
                    tradeStock.name ||
                    "Stock"}
                </p>
              </div>

              <button
                onClick={
                  handleCloseTrade
                }
                disabled={
                  tradeLoading
                }
                className="text-xl text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Current Price */}

            <div className="mt-6 rounded-2xl bg-[#F1F8F4] p-5">
              <p className="text-xs text-gray-500">
                Current price
              </p>

              <p className="mt-1 text-2xl font-bold text-[#0F4C3A]">
                {formatINR(
                  tradePrice,
                )}
              </p>
            </div>

            {/* Buy Mode */}

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0B3528]">
                Buy by
              </p>

              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                {/* Invest by ₹ */}

                <button
                  type="button"
                  onClick={() => {
                    if (
                      tradeMode ===
                      "quantity" &&
                      tradePrice >
                      0
                    ) {
                      const quantity =
                        Math.max(
                          1,
                          Math.floor(
                            Number(
                              tradeQuantity,
                            ) ||
                            1,
                          ),
                        );

                      setTradeAmount(
                        (
                          quantity *
                          tradePrice
                        ).toFixed(
                          2,
                        ),
                      );
                    }

                    setTradeMode(
                      "amount",
                    );

                    setTradeError(
                      "",
                    );
                  }}
                  disabled={
                    tradeLoading
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tradeMode ===
                    "amount"
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
                      tradeMode ===
                      "amount" &&
                      tradePrice >
                      0 &&
                      Number.isFinite(
                        enteredAmount,
                      ) &&
                      enteredAmount >
                      0
                    ) {
                      setTradeQuantity(
                        Math.max(
                          1,
                          Math.floor(
                            enteredAmount /
                            tradePrice,
                          ),
                        ),
                      );
                    }

                    setTradeMode(
                      "quantity",
                    );

                    setTradeAmount(
                      "",
                    );

                    setTradeError(
                      "",
                    );
                  }}
                  disabled={
                    tradeLoading
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tradeMode ===
                    "quantity"
                    ? "bg-white text-[#0F4C3A] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Buy by shares
                </button>
              </div>
            </div>

            {/* Input */}

            <div className="mt-5">
              <label
                htmlFor="dashboard-trade-input"
                className="text-sm font-semibold text-[#0B3528]"
              >
                {tradeMode ===
                  "amount"
                  ? "How much do you want to invest?"
                  : "How many shares do you want to buy?"}
              </label>

              {tradeMode ===
                "amount" ? (
                <div className="mt-2 flex items-center rounded-xl border border-gray-200 px-4 focus-within:border-[#0F4C3A]">
                  <span className="text-sm font-semibold text-gray-500">
                    ₹
                  </span>

                  <input
                    id="dashboard-trade-input"
                    type="number"
                    min="1"
                    step="1"
                    value={
                      tradeAmount
                    }
                    onChange={(e) => {
                      setTradeAmount(
                        e.target
                          .value,
                      );

                      setTradeError(
                        "",
                      );
                    }}
                    disabled={
                      tradeLoading
                    }
                    placeholder="Enter amount in ₹"
                    className="w-full border-0 px-2 py-3 text-sm focus:outline-none"
                  />
                </div>
              ) : (
                <input
                  id="dashboard-trade-input"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    tradeQuantity
                  }
                  onChange={(e) => {
                    const value =
                      Math.floor(
                        Number(
                          e.target
                            .value,
                        ) ||
                        1,
                      );

                    setTradeQuantity(
                      Math.max(
                        1,
                        value,
                      ),
                    );

                    setTradeError(
                      "",
                    );
                  }}
                  disabled={
                    tradeLoading
                  }
                  placeholder="Enter number of shares"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#0F4C3A] focus:outline-none disabled:bg-gray-100"
                />
              )}
            </div>

            {/* Review */}

            <div className="mt-5 rounded-2xl border border-gray-100 p-5">
              {/* Budget */}

              {tradeMode ===
                "amount" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Your budget
                    </span>

                    <span className="font-semibold text-[#0B3528]">
                      ₹
                      {Number.isFinite(
                        enteredAmount,
                      )
                        ? enteredAmount.toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )
                        : "0.00"}
                    </span>
                  </div>
                )}

              {/* Shares */}

              <div
                className={`flex justify-between text-sm ${tradeMode ===
                  "amount"
                  ? "mt-3"
                  : ""
                  }`}
              >
                <span className="text-gray-500">
                  Shares to buy
                </span>

                <span className="font-semibold text-[#0B3528]">
                  {
                    calculatedQuantity
                  }
                </span>
              </div>

              {/* Actual Investment */}

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-gray-500">
                  Amount actually invested
                </span>

                <span className="font-semibold text-[#0B3528]">
                  {formatINR(
                    estimatedTradeValue,
                  )}
                </span>
              </div>

              {/* Remaining Budget */}

              {tradeMode ===
                "amount" &&
                calculatedQuantity >
                0 && (
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-gray-500">
                      Unused amount
                    </span>

                    <span className="font-semibold text-gray-500">
                      {formatINR(
                        remainingAmount,
                      )}
                    </span>
                  </div>
                )}
            </div>

            {/* Error */}

            {tradeError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">
                  {
                    tradeError
                  }
                </p>
              </div>
            )}

            {/* Actions */}

            <div className="mt-6 flex gap-3">
              <button
                onClick={
                  handleCloseTrade
                }
                disabled={
                  tradeLoading
                }
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={
                  handleConfirmBuy
                }
                disabled={
                  tradeLoading ||
                  calculatedQuantity <
                  1
                }
                className="flex-1 rounded-xl bg-[#0F4C3A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3528] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tradeLoading
                  ? "Processing..."
                  : calculatedQuantity >=
                    1
                    ? `Confirm Buy — ${formatINR(
                      estimatedTradeValue,
                    )}`
                    : "Confirm Buy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}