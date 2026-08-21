import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  FiMenu,
  FiX,
  FiSettings,
  FiLogOut,
  FiUser,
} from "react-icons/fi";
import { supabase } from "../../lib/supabase";

// Dummy data — replace with real portfolio history from your DB later
const performanceData = [
  { day: "Day 1", ai: 100, me: 100 },
  { day: "Day 3", ai: 102, me: 101 },
  { day: "Day 5", ai: 101, me: 101.5 },
  { day: "Day 7", ai: 106, me: 102 },
  { day: "Day 9", ai: 105, me: 101.8 },
  { day: "Day 11", ai: 110, me: 103.5 },
  { day: "Day 13", ai: 108.5, me: 103 },
  { day: "Day 15", ai: 112, me: 105 },
  { day: "Day 17", ai: 114.5, me: 106.2 },
  { day: "Day 19", ai: 113.5, me: 106 },
];

// Profile shape (JSX file — kept as comment instead of TypeScript interface)
// { full_name: string | null }

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [range, setRange] = useState("1M");
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileRef = useRef(null);

useEffect(() => {
  const loadProfile = async () => {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    console.log("AUTH USER:", userData?.user);
    console.log("AUTH ERROR:", userError);

    if (!userData?.user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userData.user.id)
      .single();

    console.log("PROFILE DATA:", data);
    console.log("PROFILE ERROR:", error);

    setProfile({
      full_name: data?.full_name,
      email: userData.user.email,
    });
    useEffect(() => {
      const handleClickOutside = (event) => {
    if (
      profileRef.current && !profileRef.current.contains(event.target)) {
      setProfileOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {document.removeEventListener("mousedown", handleClickOutside);};
}, []);
  };

  loadProfile();
}, []);


const fullName = profile?.full_name?.trim() || "";
const nameParts = fullName.split(/\s+/);

const firstName = nameParts[0] || "there";

const initials =
  nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : nameParts[0]?.slice(0, 2);
  const handleLogout = async () => {
  await supabase.auth.signOut();
  navigate("/login");
};

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const navItems = [
    "Dashboard",
    "AI Picks",
    "Portfolio",
    "Watchlist",
    "Learn",
    "Settings",
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans">
      {/* --- SIDEBAR --- */}
      {/* --- SIDEBAR --- */}
<>
  {/* Overlay */}
  {sidebarOpen && (
    <div
      className="fixed inset-0 bg-black/30 z-40"
      onClick={() => setSidebarOpen(false)}
    />
  )}

  <aside
    className={`fixed top-0 left-0 h-full w-64 bg-[#0B1B2E] flex flex-col z-50
    transform transition-transform duration-300 ease-in-out
    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
  >
    {/* Logo + Close */}
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
        onClick={() => setSidebarOpen(false)}
        className="text-slate-400 hover:text-white text-xl"
      >
        ✕
      </button>
    </div>

    <nav className="flex-1 px-3 space-y-1">
      {navItems.map((item) => {
        const active = item === "Dashboard";

        return (
          <button
            key={item}
            onClick={() => {
              if (item === "Dashboard") {
                setSidebarOpen(false);
                return;
              }

              // navigate(`/${item.toLowerCase().replace(" ", "-")}`);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              active
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                active ? "bg-white" : "bg-slate-500"
              }`}
            />

            {item}
          </button>
        );
      })}
    </nav>

    <div className="px-6 py-6 border-t border-white/10">
      <p className="text-[11px] text-slate-500">
        Paper trading · virtual funds only
      </p>
    </div>
  </aside>
</>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-10 py-5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
    {/* Hamburger Menu */}
    <button
      onClick={() => setSidebarOpen(true)}
      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-xl text-slate-700"
      aria-label="Open menu"
    >
      ☰
    </button>

    <input
      type="text"
      placeholder="Search stocks..."
      className="w-80 px-4 py-2 rounded-lg border border-slate-200 bg-[#FAFBFD] text-sm focus:outline-none"
    />
  </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
                WALLET
              </p>
              <p className="text-sm font-bold text-slate-800">₹9,45,230</p>
            </div>
            <button className="w-9 h-9 rounded-full bg-[#FFF8E8] flex items-center justify-center text-lg">
              🔔
            </button>
            <div ref={profileRef} className="relative">
  <button
    onClick={() => setProfileOpen(!profileOpen)}
    className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-[#0F4C3A] hover:ring-2 hover:ring-emerald-200 transition"
  >
    {initials ? initials.toUpperCase() : "U"}
  </button>

  {profileOpen && (
    <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
      
      {/* User info */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
            {initials ? initials.toUpperCase() : "U"}
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {firstName === "there" ? "User" : firstName}
            </p>

            <p className="text-xs text-slate-400 truncate">
              {profile?.email || ""}
            </p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <button
        onClick={() => navigate("/settings")}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition"
      >
        <FiSettings size={17} />
        Settings
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
      >
        <FiLogOut size={17} />
        Logout
      </button>
    </div>
  )}
</div>
          </div>
        </header>

        <main className="flex-1 px-10 py-8 space-y-6">
          <div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              {today}
            </p>
            <h1 className="text-3xl font-serif font-semibold text-slate-900 mt-1">
              Hello, {firstName} 👋
            </h1>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Total Portfolio Value
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                ₹10,52,300
              </p>
              <p className="text-xs font-semibold text-emerald-600 mt-1">
                ▲ +6.5% overall
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Today's P&L
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">+₹2,140</p>
              <p className="text-xs font-semibold text-emerald-600 mt-1">
                ▲ +0.4% today
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                AI vs You
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                AI +5.2%{" "}
                <span className="text-slate-400 font-medium text-base">
                  · You +3.1%
                </span>
              </p>
              <p className="text-xs font-semibold text-blue-600 mt-1">
                AI leading by 2.1pp
              </p>
            </div>
          </div>

          {/* Performance chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-serif font-semibold text-slate-900">
                  Portfolio performance
                </h2>
                <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-[#0F4C3A] inline-block rounded" />
                    AI Portfolio
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-[#1E3A8A] inline-block rounded" />
                    My Portfolio
                  </span>
                </div>
              </div>
              <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                {["1D", "1W", "1M", "3M", "1Y"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                      range === r
                        ? "bg-white shadow-sm text-slate-800"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <XAxis dataKey="day" hide />
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ai"
                    stroke="#0F4C3A"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="me"
                    stroke="#1E3A8A"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-5">
            {/* Top AI recommendation */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase mb-4">
                Top AI Recommendation
              </p>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    TCS
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Tata Consultancy
                    </p>
                    <p className="text-sm text-slate-500">
                      ₹3,842.50{" "}
                      <span className="text-emerald-600 font-medium">
                        ▲1.2%
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                  Confidence 82%
                </span>
              </div>
              <p className="text-sm italic text-slate-500 mt-4 pl-3 border-l-2 border-slate-200">
                Strong RSI recovery and low overlap with your current Tech
                holdings.
              </p>
              <button
                onClick={() => navigate("/ai-picks")}
                className="mt-4 text-sm font-semibold text-slate-800 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition"
              >
                View all picks →
              </button>
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase mb-4">
                Recent Activity
              </p>
              <ul className="space-y-3">
                {[
                  { text: "Bought RELIANCE ×5", time: "10:32 AM" },
                  { text: "AI flagged TCS", time: "9:15 AM" },
                  { text: "Sold INFY ×3", time: "Yesterday" },
                  { text: 'Completed "Reading RSI"', time: "Yesterday" },
                ].map((activity) => (
                  <li
                    key={activity.text}
                    className="flex items-center justify-between text-sm border-b border-slate-100 last:border-0 pb-3 last:pb-0"
                  >
                    <span className="text-slate-700">{activity.text}</span>
                    <span className="text-xs text-slate-400">
                      {activity.time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
