import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { BudgetHistoryRow, BudgetProgress } from '@/lib/budgetCalc';
import { formatINR, cn } from '@/lib/utils';

export function BudgetCard({
  progress,
  history,
  onOpen,
}: {
  progress: BudgetProgress;
  history?: BudgetHistoryRow[];
  onOpen?: () => void;
}) {
  const status = progress.paceStatus;
  const statusMeta = {
    'on-track': {
      bg: 'bg-emerald-500/10',
      fg: 'text-emerald-700 dark:text-emerald-300',
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'On track',
    },
    warning: {
      bg: 'bg-amber-500/10',
      fg: 'text-amber-700 dark:text-amber-300',
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'At risk',
    },
    over: {
      bg: 'bg-destructive/10',
      fg: 'text-destructive',
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Over',
    },
  }[status];

  return (
    <motion.div layout whileTap={onOpen ? { scale: 0.99 } : undefined}>
      <Card
        className={cn(
          onOpen && 'cursor-pointer transition-colors hover:bg-accent/30',
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left disabled:cursor-default"
          disabled={!onOpen}
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {progress.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {progress.periodLabel} · {progress.budget.period}
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  statusMeta.bg,
                  statusMeta.fg,
                )}
              >
                {statusMeta.icon}
                {statusMeta.label}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold tabular-nums">
                  {formatINR(progress.spent)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  of {formatINR(Number(progress.budget.amount))}
                </span>
              </div>
              <Progress
                value={progress.spent}
                max={Number(progress.budget.amount)}
                barClassName={
                  status === 'over'
                    ? 'bg-destructive'
                    : status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <Stat
                label="Days left"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {progress.daysLeft}
                  </span>
                }
              />
              <Stat
                label="Daily room"
                value={
                  progress.dailyAllowance === null
                    ? '—'
                    : progress.over
                      ? <span className="text-destructive">₹0</span>
                      : formatINR(Math.round(progress.dailyAllowance))
                }
              />
              <Stat
                label="Forecast"
                value={
                  <span
                    className={cn(
                      progress.forecast > Number(progress.budget.amount) &&
                        'text-destructive',
                    )}
                  >
                    {formatINR(Math.round(progress.forecast))}
                  </span>
                }
              />
            </div>

            {history && history.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Last {history.length} periods
                </div>
                <Sparkline history={history} />
              </div>
            )}

            {onOpen && (
              <div className="flex items-center justify-end text-[11px] text-muted-foreground">
                Tap for history <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </CardContent>
        </button>
      </Card>
    </motion.div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Sparkline({ history }: { history: BudgetHistoryRow[] }) {
  const max = Math.max(...history.map((r) => r.spent), 1);
  return (
    <div className="flex h-7 items-end gap-1">
      {history.map((r, i) => {
        const h = Math.max(8, (r.spent / max) * 100);
        return (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-sm',
              r.over ? 'bg-destructive/70' : 'bg-primary/40',
            )}
            style={{ height: `${h}%` }}
            title={`${r.range.label}: ${formatINR(r.spent)}`}
          />
        );
      })}
    </div>
  );
}
