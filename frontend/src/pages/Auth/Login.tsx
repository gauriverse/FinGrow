// src/pages/Auth/Login.tsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type AuthMode = "login" | "signup";

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();

  const mode: AuthMode = location.pathname === "/signup" ? "signup" : "login";

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    setError(error.message);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: `${firstName} ${lastName}`,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        navigate("/"); // or wherever you want after signup
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        navigate("/");
      }
    }

    setLoading(false);
  };

  return (
    <div className="h-screen bg-white flex flex-col font-sans selection:bg-brand-lightGreen overflow-hidden">
      {/* --- HEADER --- */}
      <header className="w-full bg-white border-b border-slate-100 px-6 md:px-12 py-5 flex items-center justify-between z-20">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 group text-left focus:outline-none"
        >
          <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
            F
          </div>
          <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
            FinGrow
          </span>
        </button>
        <span className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-[#0F4C3A] transition">
          Need help?
        </span>
      </header>

      {/* --- MAIN SPLIT-SCREEN CONTAINER --- */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative">
        {/* --- LEFT SIDE: ANIMATED GREEN BRANDING PANEL --- */}
        <div className="hidden lg:flex lg:col-span-6 bg-[#0B3528] relative overflow-hidden flex-col justify-between p-16 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_70%)] pointer-events-none" />

          {/* Wrapper to handle text swap transition cleanly */}
          <div className="relative flex-1 flex flex-col justify-center">
            {/* Login Left-Panel Content */}
            <div
              className={`absolute inset-x-0 transition-all duration-500 ease-in-out transform ${
                mode === "login"
                  ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
                  : "opacity-0 -translate-x-8 scale-95 pointer-events-none"
              }`}
            >
              <div className="space-y-6 max-w-md">
                <span className="text-[10px] tracking-[0.2em] text-[#A3E635] font-bold uppercase">
                  Welcome back
                </span>
                <h1 className="text-4xl md:text-5xl font-serif font-semibold leading-[1.15] tracking-tight text-[#FAF9F5]">
                  Pick up right where your portfolio left off.
                </h1>
                <p className="text-sm text-emerald-100/70 leading-relaxed font-light">
                  Your virtual capital, watchlist and AI picks are exactly as
                  you left them — safe to explore, nothing real at stake.
                </p>

                {/* Left side Live Sparkline Card */}
                <div className="w-full max-w-sm bg-white/5 backdrop-blur-[2px] rounded-xl p-5 border border-white/10 mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] tracking-wider text-emerald-200/60 font-semibold uppercase">
                      AI Portfolio
                    </span>
                    <span className="text-[10px] font-semibold text-[#A3E635]">
                      +5.2%
                    </span>
                  </div>
                  <div className="w-full h-16">
                    <svg
                      className="w-full h-full overflow-visible"
                      viewBox="0 0 300 60"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 0,45 Q 40,42 80,30 T 160,35 T 240,15 T 300,10"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Signup Left-Panel Content */}
            <div
              className={`absolute inset-x-0 transition-all duration-500 ease-in-out transform ${
                mode === "signup"
                  ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
                  : "opacity-0 translate-x-8 scale-95 pointer-events-none"
              }`}
            >
              <div className="space-y-6 max-w-md">
                <span className="text-[10px] tracking-[0.2em] text-[#A3E635] font-bold uppercase">
                  Get Started Free
                </span>
                <h1 className="text-4xl md:text-5xl font-serif font-semibold leading-[1.15] tracking-tight text-[#FAF9F5]">
                  ₹10,00,000 in virtual capital. Zero real risk.
                </h1>
                <p className="text-sm text-emerald-100/70 leading-relaxed font-light">
                  Set up your profile in under two minutes and get your first
                  AI-explained recommendation right away.
                </p>

                {/* Features Checklists */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-[#A3E635] font-bold">
                      ✓
                    </div>
                    <span className="text-xs text-emerald-100">
                      No card required, ever
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-[#A3E635] font-bold">
                      ✓
                    </div>
                    <span className="text-xs text-emerald-100">
                      Every AI pick comes with a plain-English reason
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-[#A3E635] font-bold">
                      ✓
                    </div>
                    <span className="text-xs text-emerald-100">
                      Reset your portfolio anytime and start fresh
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT SIDE: FORM PANEL WITH TRANSITION SLIDE --- */}
        <div className="col-span-1 lg:col-span-6 flex items-center justify-center p-6 sm:p-12 md:p-16 bg-white z-10">
          <div className="w-full max-w-md space-y-6">
            {/* Sliding Toggle Control */}
            <div className="relative grid grid-cols-2 bg-[#F8FAFC] p-1 rounded-xl border border-slate-200/60 overflow-hidden">
              {/* Sliding Indicator Background */}
              <div
                className={`absolute top-1 bottom-1 w-[49%] bg-white shadow-sm border border-slate-200/30 rounded-lg transition-transform duration-300 ease-out ${
                  mode === "signup" ? "translate-x-[102%]" : "translate-x-0"
                }`}
              />
              <button
                type="button"
                onClick={() => navigate("/login")}
                className={`relative z-10 py-2.5 text-xs font-semibold rounded-lg transition-colors duration-200 ${
                  mode === "login"
                    ? "text-slate-800"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className={`relative z-10 py-2.5 text-xs font-semibold rounded-lg transition-colors duration-200 ${
                  mode === "signup"
                    ? "text-slate-800"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Animated Form Container */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Dynamic Sign-Up Name Fields with height expand animation */}
              <div
                className={`grid grid-cols-2 gap-3 transition-all duration-300 ease-in-out ${
                  mode === "signup"
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 -translate-y-3 scale-95 absolute pointer-events-none"
                }`}
              >
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#FAFBFD] border border-slate-200 text-sm focus:outline-none"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#FAFBFD] border border-slate-200 text-sm focus:outline-none"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Shared Email Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#FAFBFD] border border-slate-200 text-sm focus:outline-none"
                  placeholder="johndoe@example.com"
                  required
                />
              </div>

              {/* Shared Password Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#FAFBFD] border border-slate-200 text-sm focus:outline-none"
                  placeholder={
                    mode === "signup"
                      ? "Create a password"
                      : "Enter your password"
                  }
                  required
                />
              </div>

              {/* Terms and Conditions (Only shows up for signup) */}
              {mode === "signup" && (
                <p className="text-[11px] text-slate-400 leading-normal">
                  By signing up, you agree to FinGrow's{" "}
                  <span className="text-[#0F4C3A] font-medium cursor-pointer hover:underline">
                    Terms
                  </span>{" "}
                  and confirm you understand this is a paper-trading learning
                  platform, not a real brokerage.
                </p>
              )}

              {/* Forgot password link (Only shows up for login) */}
              {mode === "login" && (
                <div className="flex justify-end">
                  <span className="text-xs font-semibold text-[#0F4C3A] cursor-pointer hover:underline">
                    Forgot password?
                  </span>
                </div>
              )}

              {error && (
                <p className="text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-[#0F4C3A] hover:bg-[#0b382a] text-white text-xs font-bold tracking-wide rounded-lg transition duration-200 shadow-sm disabled:opacity-60"
              >
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Log In"
                    : "Create free account"}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/60"></div>
              </div>
              <span className="relative px-3 bg-white text-[10px] font-bold uppercase tracking-widest text-slate-400">
                OR
              </span>
            </div>

            {/* Google Authentication */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 px-4 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2.5 transition text-xs font-bold text-slate-600"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            {/* Inline Toggle Footer Link */}
            <p className="text-center text-xs text-slate-500 font-medium pt-2">
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button
                    onClick={() => navigate("/signup")}
                    className="text-[#0F4C3A] font-bold hover:underline ml-0.5 focus:outline-none"
                  >
                    Create a free account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => navigate("/login")}
                    className="text-[#0F4C3A] font-bold hover:underline ml-0.5 focus:outline-none"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
