import { Link } from "react-router-dom";
export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-slate-800 font-sans selection:bg-brand-lightGreen">
      {/* --- NAVBAR --- */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Logo Badge */}
          <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
            F
          </div>
          <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
            FinGrow
          </span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-[#0F4C3A] transition">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-[#0F4C3A] transition">
            How it works
          </a>
          <a href="#learn" className="hover:text-[#0F4C3A] transition">
            Learn
          </a>
          <a href="#about" className="hover:text-[#0F4C3A] transition">
            About
          </a>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition border border-transparent"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C3A] hover:bg-[#0b382a] rounded-lg transition flex items-center gap-1"
          >
            Start free <span className="text-xs">→</span>
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Hero Left Content */}
        <div className="lg:col-span-6 space-y-6">
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-slate-900 leading-[1.1] tracking-tight">
            Learn to invest.
            <br />
            <span className="text-[#0F4C3A] italic font-normal">
              Risk nothing.
            </span>
          </h1>
          <p className="text-base text-slate-600 max-w-lg leading-relaxed">
            Al-powered paper trading that explains every recommendation in plain
            English — practice with ₹10,00,000 in virtual capital before a rupee
            of your own is on the line.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/signup"
              className="px-6 py-3.5 text-sm font-semibold text-white bg-[#0F4C3A] hover:bg-[#0b382a] rounded-md transition shadow-sm flex items-center gap-1"
            >
              Start investing — free →
            </Link>
            <button className="px-6 py-3.5 text-sm font-semibold text-slate-700 bg-transparent hover:bg-slate-100 border border-slate-200 rounded-md transition flex items-center gap-2">
              {/* Play Icon */}
              <svg
                className="w-4 h-4 text-slate-500 fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch demo
            </button>
          </div>
        </div>

        {/* Hero Right: Interactive Portfolio Mockup */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-[0_15px_30px_rgba(0,0,0,0.04)] border border-slate-100">
            {/* Portfolio Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">
                Portfolio Value
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                +5.2% this month
              </span>
            </div>

            {/* Portfolio Value */}
            <div className="text-3xl font-bold text-slate-900 mb-6 font-mono">
              ₹10,52,300
            </div>

            {/* Custom SVG Line Chart */}
            <div className="w-full h-32 relative mb-6">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 400 100"
                preserveAspectRatio="none"
              >
                {/* Gradient Fill under line */}
                <defs>
                  <linearGradient
                    id="chartGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0,80 Q 50,75 100,55 T 200,60 T 300,30 T 400,20 L 400,100 L 0,100 Z"
                  fill="url(#chartGradient)"
                />
                {/* Smooth Chart Line */}
                <path
                  d="M 0,80 Q 50,75 100,55 T 200,60 T 300,30 T 400,20"
                  fill="none"
                  stroke="#0F4C3A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* AI Insight Box */}
            <div className="flex items-start gap-2.5 pt-4 border-t border-slate-100">
              <span className="text-[#0F4C3A] text-lg font-serif">↳</span>
              <p className="text-xs text-slate-600 leading-relaxed font-serif italic">
                "Recommended TCS for its RSI recovery and your Tech sector
                preference."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- STATS SECTION (NAVY BLUE BANNER) --- */}
      <section className="bg-[#0C1C2C] text-white py-14">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
          <div className="py-4 md:py-0">
            <h3 className="text-3xl font-bold font-mono tracking-tight text-white mb-1">
              ₹10,00,000
            </h3>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              virtual capital to start
            </p>
          </div>
          <div className="py-4 md:py-0">
            <h3 className="text-3xl font-bold font-mono tracking-tight text-white mb-1">
              100%
            </h3>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              of recommendations explained
            </p>
          </div>
          <div className="py-4 md:py-0">
            <h3 className="text-3xl font-bold font-mono tracking-tight text-white mb-1">
              0
            </h3>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              real rupees at risk
            </p>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS SECTION --- */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl font-serif font-bold text-slate-900 mb-3">
            How it works
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Four steps from "I know nothing about the market" to trading with a
            real strategy behind you.
          </p>
        </div>

        {/* 4-Step Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 hover:shadow-md transition">
            <span className="text-xs font-mono text-emerald-600 block mb-3 font-semibold">
              01
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-2">
              Set your profile
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tell us your goals, risk comfort and time horizon.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 hover:shadow-md transition">
            <span className="text-xs font-mono text-emerald-600 block mb-3 font-semibold">
              02
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-2">
              Get AI picks
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Personalised recommendations with the reasoning shown.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 hover:shadow-md transition">
            <span className="text-xs font-mono text-emerald-600 block mb-3 font-semibold">
              03
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-2">
              Practice trading
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Buy and sell with virtual money, real market prices.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 hover:shadow-md transition">
            <span className="text-xs font-mono text-emerald-600 block mb-3 font-semibold">
              04
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-2">
              Learn as you go
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Short lessons tied to what you're looking at right now.
            </p>
          </div>
        </div>
      </section>

      {/* --- FEATURE HIGHLIGHTS (BUILT TO BUILD CONFIDENCE) --- */}
      <section id="features" className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-serif font-bold text-slate-900 mb-12">
          Built to build confidence
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 space-y-4 hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              {/* Search Icon */}
              <svg
                className="w-5 h-5 text-emerald-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Explainable AI
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every pick comes with the plain-English reason behind it — not
              just a buy signal.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 space-y-4 hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              {/* Scale / VS Icon */}
              <svg
                className="w-5 h-5 text-emerald-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <circle cx="6" cy="12" r="2"></circle>
                <circle cx="18" cy="12" r="2"></circle>
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">AI vs you</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Run your own picks side-by-side with the AI's and see who's
              actually right.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 space-y-4 hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              {/* Document Icon */}
              <svg
                className="w-5 h-5 text-emerald-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">Learning hub</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bite-sized lessons that appear exactly when a concept trips you
              up.
            </p>
          </div>
        </div>
      </section>

      {/* --- TRUST QUOTE BANNER --- */}
      <section className="bg-[#E9F4EE] py-12 text-center border-y border-emerald-100/50">
        <div className="max-w-4xl mx-auto px-6 space-y-2.5">
          <h2 className="text-2xl md:text-3xl font-serif italic text-slate-900 tracking-tight font-medium">
            "Not a trading platform. A learning platform."
          </h2>
          <p className="text-xs tracking-wide text-emerald-800 uppercase font-semibold">
            Every trade on FinGrow uses virtual money — always
          </p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-200/50 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-sm font-serif">
              F
            </div>
            <span className="font-bold text-base tracking-tight font-serif text-[#0F4C3A]">
              FinGrow
            </span>
          </div>

          <p className="text-[11px] text-slate-400 max-w-sm text-center sm:text-right leading-normal">
            Virtual money only. Nothing on FinGrow is financial advice — it's a
            practice ground for learning how markets work.
          </p>
        </div>
      </footer>
    </div>
  );
}
