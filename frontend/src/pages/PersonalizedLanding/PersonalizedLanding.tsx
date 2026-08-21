import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getNifty, getSensex } from "../../services/marketService";

type Profile = {
  full_name: string | null;
  risk_level: string | null;
  investment_goal: string | null;
  investment_horizon: string | null;
};

type MarketData = {
  name?: string;
  price: number;
  open: number;
};

export default function PersonalizedLanding() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nifty, setNifty] = useState<MarketData | null>(null);
  const [sensex, setSensex] = useState<MarketData | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, risk_level, investment_goal, investment_horizon")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile(profileData);

      const [niftyData, sensexData] = await Promise.all([
        getNifty(),
        getSensex(),
      ]);
      setNifty(niftyData);
      setSensex(sensexData);
    };

    load();
  }, [navigate]);

  const sensexChange = sensex
    ? (((sensex.price - sensex.open) / sensex.open) * 100).toFixed(2)
    : null;
  const niftyChange = nifty
    ? (((nifty.price - nifty.open) / nifty.open) * 100).toFixed(2)
    : null;

  const displayName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-slate-800 font-sans">
      {/* --- NAVBAR --- */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
            F
          </div>
          <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
            FinGrow
          </span>
        </div>
      </nav>

      {/* --- HERO GREETING --- */}
      <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 leading-tight">
          Hi, {displayName}
          <span className="text-[#0F4C3A]">.</span>
        </h1>
        <p className="text-base text-slate-600 mt-4 max-w-lg mx-auto leading-relaxed">
          Your profile's set up and your first virtual portfolio is ready.
          Here's a quick look before you head in.
        </p>
      </section>

      {/* --- SUMMARY CARDS --- */}
      <section className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6 pb-16">
        {/* Risk Profile Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <span className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">
            Your risk profile
          </span>
          <p className="text-2xl font-serif font-bold text-[#0F4C3A] mt-2 capitalize">
            {profile?.risk_level || "Not set"}
          </p>
          <div className="mt-4 space-y-1 text-sm text-slate-500">
            <p>
              Goal:{" "}
              <span className="text-slate-700 font-medium capitalize">
                {profile?.investment_goal?.replace("-", " ") || "—"}
              </span>
            </p>
            <p>
              Horizon:{" "}
              <span className="text-slate-700 font-medium">
                {profile?.investment_horizon || "—"}
              </span>
            </p>
          </div>
        </div>

        {/* Portfolio Snapshot Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <span className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">
            Starting capital
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹10,00,000
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase">
                {sensex ? sensex.name : "Sensex"}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  sensexChange && Number(sensexChange) >= 0
                    ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                    : "text-red-700 bg-red-50 border-red-100"
                }`}
              >
                {sensex
                  ? `${Number(sensexChange) >= 0 ? "+" : ""}${sensexChange}% Today`
                  : "Loading..."}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase">
                {nifty ? nifty.name : "Nifty 50"}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  niftyChange && Number(niftyChange) >= 0
                    ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                    : "text-red-700 bg-red-50 border-red-100"
                }`}
              >
                {nifty
                  ? `${Number(niftyChange) >= 0 ? "+" : ""}${niftyChange}% Today`
                  : "Loading..."}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <button
          onClick={() => navigate("/dashboard")}
          className="px-8 py-3.5 text-sm font-semibold text-white bg-[#0F4C3A] hover:bg-[#0b382a] rounded-md transition shadow-sm"
        >
          Go to Dashboard →
        </button>
      </section>
    </div>
  );
}
