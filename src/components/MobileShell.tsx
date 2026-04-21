import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Zap,
  ListOrdered,
  PieChart,
  Repeat,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { runDueRecurring } from '@/services/recurring';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Zap;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Zap, end: true },
  { to: '/activity', label: 'Activity', icon: ListOrdered },
  { to: '/insights', label: 'Insights', icon: PieChart },
  { to: '/automate', label: 'Automate', icon: Repeat },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function MobileShell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    runDueRecurring().then((n) => {
      if (n > 0) {
        toast.info(`Recurring: ${n} transaction${n === 1 ? '' : 's'} auto-added`);
        qc.invalidateQueries({ queryKey: ['transactions'] });
        qc.invalidateQueries({ queryKey: ['recurring_rules'] });
      }
    });
  }, [user, qc]);

  return (
    // Block layout (no flex wrapper around the whole viewport).
    // Document scroll handles all long pages; bottom nav and desktop rail
    // are both `fixed` relative to the viewport regardless of inner transforms.
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30">
      {/* ── desktop left rail (md+) ──────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/70 backdrop-blur md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            💸
          </span>
          <span className="text-lg font-semibold tracking-tight">SpendWise</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-muted-foreground">
          <div className="truncate">{user?.email}</div>
        </div>
      </aside>

      {/* ── main content ──────────────────────────────────────────────────── */}
      <main
        className="md:pl-60"
        style={{
          // Make sure the bottom nav never overlaps content on mobile,
          // including the iOS safe-area inset.
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="md:pb-0" style={{ paddingBottom: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8 md:py-7"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── mobile bottom nav — fixed to viewport, visible on every page ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
