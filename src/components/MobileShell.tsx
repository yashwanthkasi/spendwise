import { createContext, useContext, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Home,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Grid2X2,
  Plus,
  Wallet,
} from "lucide-react";
import { CaptureSheet } from "./CaptureSheet";
import { cn } from "@/lib/utils";
const AddContext = createContext<() => void>(() => {});
export const useOpenCapture = () => useContext(AddContext);
const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/insights", label: "Insights", icon: ChartNoAxesCombined },
  { to: "/more", label: "More", icon: Grid2X2 },
];
export function MobileShell() {
  const [open, setOpen] = useState(false);
  return (
    <AddContext.Provider value={() => setOpen(true)}>
      <div className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r bg-card p-5 md:flex">
          <NavLink
            to="/"
            className="mb-12 flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Wallet size={24} className="text-primary" />
            spendwise<span className="text-primary">.</span>
          </NavLink>
          <nav className="space-y-2">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl p-3 text-sm",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm text-primary-foreground"
            onClick={() => setOpen(true)}
          >
            <Plus size={18} />
            Add transaction
          </button>
          <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
            A little clarity.
            <br />
            Every day.
          </p>
        </aside>
        <main id="main" className="md:ml-56">
          <div className="mx-auto max-w-4xl px-5 pb-40 pt-7 sm:px-8 md:pb-12 md:pt-12">
            <Outlet />
          </div>
        </main>
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg md:hidden"
        >
          <Plus size={20} />
          Add transaction
        </button>
        <nav
          aria-label="Main navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]",
                    isActive
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
        <CaptureSheet open={open} onOpenChange={setOpen} />
      </div>
    </AddContext.Provider>
  );
}
