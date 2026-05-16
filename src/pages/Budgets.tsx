import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/PageHeader';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetSheet } from '@/components/budgets/BudgetSheet';
import { BudgetHistorySheet } from '@/components/budgets/BudgetHistorySheet';
import {
  useBudgets,
  useDeleteBudget,
  useUpdateBudget,
} from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { useTransactions } from '@/hooks/useTransactions';
import {
  computeBudgetHistory,
  computeBudgetProgress,
  describeBudgetLabel,
  periodRangeAt,
  filterForScope,
} from '@/lib/budgetCalc';
import { formatINR, cn } from '@/lib/utils';
import type { Budget } from '@/lib/db-types';

export default function Budgets() {
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: txns = [] } = useTransactions({ limit: 5000 });
  const { data: cats = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const update = useUpdateBudget();
  const del = useDeleteBudget();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [historyOf, setHistoryOf] = useState<Budget | null>(null);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(b: Budget) {
    setHistoryOf(null);
    setEditing(b);
    setSheetOpen(true);
  }

  async function removeBudget(b: Budget) {
    if (!confirm(`Delete the "${describeBudgetLabel(b, cats, groups)}" budget?`)) return;
    try {
      await del.mutateAsync(b.id);
      setHistoryOf(null);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleActive(b: Budget) {
    try {
      await update.mutateAsync({ id: b.id, patch: { active: !b.active } });
      toast.success(b.active ? 'Paused' : 'Resumed');
      setHistoryOf(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  // ── derived ────────────────────────────────────────────────────────
  const active = useMemo(() => budgets.filter((b) => b.active), [budgets]);
  const inactive = useMemo(() => budgets.filter((b) => !b.active), [budgets]);

  const activeProgress = useMemo(
    () =>
      active.map((b) => ({
        budget: b,
        progress: computeBudgetProgress(b, txns, cats, groups),
        history: computeBudgetHistory(b, txns, 6),
      })),
    [active, txns, cats, groups],
  );

  // Completed = last period's progress for every active budget
  const completed = useMemo(
    () =>
      active.map((b) => {
        const last = periodRangeAt(b.period, -1);
        const spent = filterForScope(b, txns, last).reduce(
          (acc, t) => acc + Number(t.amount),
          0,
        );
        const limit = Number(b.amount);
        return {
          budget: b,
          label: describeBudgetLabel(b, cats, groups),
          rangeLabel: last.label,
          spent,
          limit,
          over: spent > limit,
        };
      }),
    [active, txns, cats, groups],
  );

  const monthlyAggregate = useMemo(() => {
    const monthlyActive = activeProgress.filter(
      (p) => p.budget.period === 'monthly',
    );
    const spent = monthlyActive.reduce((acc, p) => acc + p.progress.spent, 0);
    const limit = monthlyActive.reduce(
      (acc, p) => acc + Number(p.budget.amount),
      0,
    );
    return { spent, limit, over: spent > limit && limit > 0 };
  }, [activeProgress]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Budgets" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budgets"
        action={
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
        }
      />

      {/* Roll-up tile */}
      {activeProgress.length > 0 && monthlyAggregate.limit > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                This month so far
              </span>
              <span className="text-xl font-bold tabular-nums">
                {formatINR(monthlyAggregate.spent)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {formatINR(monthlyAggregate.limit)}
                </span>
              </span>
            </div>
            <Progress
              value={monthlyAggregate.spent}
              max={monthlyAggregate.limit}
              barClassName={
                monthlyAggregate.over ? 'bg-destructive' : 'bg-emerald-500'
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Active */}
      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active
        </div>
        {activeProgress.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <div className="text-sm font-medium">No budgets yet</div>
              <p className="text-xs text-muted-foreground">
                Set caps per category, group, or overall. Suggested limits use your
                past spend.
              </p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create your first budget
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {activeProgress.map((p) => (
              <BudgetCard
                key={p.budget.id}
                progress={p.progress}
                history={p.history}
                onOpen={() => setHistoryOf(p.budget)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed (last period for each active budget) */}
      {completed.some((c) => c.spent > 0) && (
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Last period
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {completed
              .filter((c) => c.spent > 0)
              .map((c) => (
                <Card key={c.budget.id}>
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {c.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.rangeLabel}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          c.over
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        )}
                      >
                        {c.over
                          ? `Over by ${formatINR(c.spent - c.limit)}`
                          : `Under by ${formatINR(c.limit - c.spent)}`}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="tabular-nums">
                        {formatINR(c.spent)} / {formatINR(c.limit)}
                      </span>
                    </div>
                    <Progress
                      value={c.spent}
                      max={c.limit}
                      barClassName={c.over ? 'bg-destructive' : 'bg-emerald-500'}
                    />
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paused
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {inactive.map((b) => (
              <Card key={b.id} className="opacity-70">
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {describeBudgetLabel(b, cats, groups)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {b.period} · {formatINR(Number(b.amount))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(b)}
                    >
                      Resume
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <BudgetSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
      />
      <BudgetHistorySheet
        budget={historyOf}
        onClose={() => setHistoryOf(null)}
        onEdit={openEdit}
        onDelete={removeBudget}
        onToggleActive={toggleActive}
      />
    </div>
  );
}
