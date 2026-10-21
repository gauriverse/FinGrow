import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiSettings,
  FiX,
  FiGrid,
  FiZap,
  FiBriefcase,
  FiCreditCard,
  FiStar,
  FiBookOpen,
  FiCompass,
} from "react-icons/fi";

const navItems = [
  { label: "Dashboard", icon: FiGrid, path: "/dashboard" },
  { label: "Explore", icon: FiCompass, path: "/explore" },
  { label: "AI Picks", icon: FiZap, path: "/ai-picks" },
  { label: "Portfolio", icon: FiBriefcase, path: "/portfolio" },
  { label: "Wallet", icon: FiCreditCard, path: "/wallet" },
  { label: "Watchlist", icon: FiStar, path: "/watchlist" },
  { label: "Learn", icon: FiBookOpen, path: "/learn" },
  { label: "Settings", icon: FiSettings, path: "/settings" },
];

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A] focus-visible:ring-offset-1";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  // Optional: Dashboard par "Dashboard" click pe extra kaam karwana ho
  // (jaise selected stock clear karna) to ye pass karo.
  onDashboardClick?: () => void;
};

export default function Sidebar({
  open,
  onClose,
  onDashboardClick,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        inert={!open}
        className={`fixed top-0 left-0 z-50 flex h-full w-60 flex-col bg-[#0B1B2E]
        transform transition-transform duration-300 ease-in-out motion-reduce:transition-none
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0F4C3A] font-serif text-lg font-bold text-white">
              F
            </div>
            <span className="font-serif text-lg font-bold tracking-tight text-white">
              FinGrow
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white motion-reduce:transition-none ${focusRing}`}
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  onClose();

                  if (item.label === "Dashboard" && onDashboardClick) {
                    onDashboardClick();
                  }

                  if (!active || item.label !== "Dashboard") {
                    navigate(item.path);
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing} ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  size={16}
                  className={active ? "text-white" : "text-slate-500"}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[11px] text-slate-500">
            Paper trading · virtual funds only
          </p>
        </div>
      </aside>
    </>
  );
}