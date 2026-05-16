import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SheetBody } from '@/components/ui/sheet';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { computeBudgetHistory, describeBudgetLabel } from '@/lib/budgetCalc';
import type { Budget } from '@/lib/db-types';
import { cn, formatINR } from '@/lib/utils';

export function BudgetHistorySheet({
  budget,
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  budget: Budget | null;
  onClose: () => void;
  onEdit: (b: Budget) => void;
  onDelete: (b: Budget) => void;
  onToggleActive: (b: Budget) => void;
}) {
  const { data: txns = [] } = useTransactions({ limit: 5000 });
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useGroups();

  const history = useMemo(
    () => (budget ? computeBudgetHistory(budget, txns, 6) : []),
    [budget, txns],
  );

  const stats = useMemo(() => {
    if (!budget || history.length === 0) return null;
    // exclude current period (offset === 0) from "completed" averages
    const completed = history.filter((r) => r.offset < 0);
    if (completed.length === 0) return null;
    const avg =
      completed.reduce((a, r) => a + r.spent, 0) / completed.length;
    const overCount = completed.filter((r) => r.over).length;
    return { avg, overCount, total: completed.length };
  }, [history, budget]);

  return (
    <SheetBody
      open={!!budget}
      onOpenChange={(o) => !o && onClose()}
      title={budget ? describeBudgetLabel(budget, categories, groups) : ''}
      description={
        budget
          ? `${budget.period === 'weekly' ? 'Weekly' : 'Monthly'} limit ${formatINR(Number(budget.amount))}`
          : undefined
      }
    >
      {budget && (
        <div className="space-y-4 pt-1">
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Avg actual
                </div>
                <div className="text-base font-bold tabular-nums">
                  {formatINR(Math.round(stats.avg))}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  vs {formatINR(Number(budget.amount))} limit
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Over budget
                </div>
                <div
                  className={cn(
                    'text-base font-bold',
                    stats.overCount > 0 && 'text-destructive',
                  )}
                >
                  {stats.overCount} / {stats.total}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  periods exceeded
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              History
            </div>
            <div className="space-y-2">
              {history.map((row) => {
                const limit = Number(budget.amount);
                const isCurrent = row.offset === 0;
                return (
                  <div
                    key={row.offset}
                    className="space-y-1.5 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {row.range.label}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {row.over ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        <span
                          className={cn(
                            'text-xs font-semibold tabular-nums',
                            row.over && 'text-destructive',
                          )}
                        >
                          {formatINR(row.spent)} / {formatINR(limit)}
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={row.spent}
                      max={limit}
                      barClassName={
                        row.over ? 'bg-destructive' : 'bg-emerald-500'
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onToggleActive(budget)}
            >
              {budget.active ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Resume
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onEdit(budget)}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(budget)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}
    </SheetBody>
  );
}
