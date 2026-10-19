import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiLogOut, FiSettings } from "react-icons/fi";
import { supabase } from "../lib/supabase";
import { getPortfolioSummary } from "../services/portfolioService";

type HeaderActionsProps = {
  // Agar page ke paas already balance hai to yahan pass karo (null = loading).
  // Pass nahi karoge to component khud fetch karega.
  balance?: number | null;
};

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] focus-visible:ring-offset-1";

export default function HeaderActions({ balance: balanceProp }: HeaderActionsProps) {
  const navigate = useNavigate();
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [fetchedBalance, setFetchedBalance] = useState<number | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const balance = balanceProp !== undefined ? balanceProp : fetchedBalance;

  // Balance (sirf jab page ne prop nahi diya)
  useEffect(() => {
    if (balanceProp !== undefined) return;

    let cancelled = false;

    getPortfolioSummary()
      .then((v) => {
        if (!cancelled) setFetchedBalance(Number(v.available_balance || 0));
      })
      .catch((e) => console.error("Header balance failed:", e));

    return () => {
      cancelled = true;
    };
  }, [balanceProp]);

  // Profile
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const googleName =
        user.user_metadata?.full_name || user.user_metadata?.name || "";

      setProfile({
        full_name: data?.full_name?.trim() || googleName.trim() || "",
        email: user.email || "",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Bahar click karne par dropdown band
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const fullName = profile?.full_name?.trim() || "";
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : nameParts[0]?.slice(0, 2);

  return (
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

        {balance != null ? (
          `₹${Number(balance).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
          })}`
        ) : (
          <span className="h-4 w-20 animate-pulse rounded bg-emerald-100 motion-reduce:animate-none" />
        )}
      </button>

      {/* Notification */}
      <button
        type="button"
        title="Notifications"
        aria-label="Notifications"
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF8E8] text-amber-700 transition hover:bg-[#FFF1D1] active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
      >
        <FiBell size={16} />
      </button>

      {/* Profile */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => setProfileOpen((open) => !open)}
          aria-label="Open profile menu"
          aria-expanded={profileOpen}
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-[#0F4C3A] transition hover:ring-2 hover:ring-emerald-200 motion-reduce:transition-none ${focusRing}`}
        >
          {initials ? initials.toUpperCase() : "U"}
        </button>

        {profileOpen && (
          <div className="absolute top-11 right-0 z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-[#0F4C3A]">
                  {initials ? initials.toUpperCase() : "U"}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {firstName || "User"}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {profile?.email}
                  </p>
                </div>
              </div>
            </div>

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

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 motion-reduce:transition-none"
            >
              <FiLogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}