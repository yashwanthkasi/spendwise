import { FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { Plus, Target, Trash2, AlertTriangle } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SheetBody } from '@/components/ui/sheet';
import { PageHeader } from '@/components/PageHeader';
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  type BudgetInput,
} from '@/hooks/useBudgets';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { computeBudgetProgress } from '@/lib/budgetCalc';
import { formatINR } from '@/lib/utils';
import { TYPE_META, TYPE_ORDER } from '@/lib/constants';
import type { BudgetPeriod, BudgetScope, TransactionType } from '@/lib/db-types';

const DEFAULT_FORM: BudgetInput = {
  scope: 'category',
  scope_id: null,
  amount: 10000,
  period: 'monthly',
  active: true,
};

export default function Insights() {
  const { data: txns = [] } = useTransactions({ limit: 2000 });
  const { data: budgets = [] } = useBudgets();
  const { data: cats = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const createBudget = useCreateBudget();
  const delBudget = useDeleteBudget();

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [form, setForm] = useState<BudgetInput>(DEFAULT_FORM);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonth = useMemo(
    () =>
      txns.filter(
        (t) =>
          new Date(t.occurred_at) >= monthStart &&
          new Date(t.occurred_at) <= monthEnd,
      ),
    [txns, monthStart, monthEnd],
  );

  const totalsThisMonth = useMemo(() => {
    const agg: Record<TransactionType, number> = {
      expense: 0,
      income: 0,
      investment: 0,
      lending: 0,
      transfer: 0,
    };
    for (const t of thisMonth) agg[t.type] += Number(t.amount);
    return agg;
  }, [thisMonth]);

  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const month = subMonths(now, 5 - i);
      const s = startOfMonth(month);
      const e = endOfMonth(month);
      const rows = txns.filter(
        (t) => new Date(t.occurred_at) >= s && new Date(t.occurred_at) <= e,
      );
      const agg: Record<TransactionType, number> = {
        expense: 0,
        income: 0,
        investment: 0,
        lending: 0,
        transfer: 0,
      };
      for (const t of rows) agg[t.type] += Number(t.amount);
      return { month: format(month, 'MMM'), ...agg };
    });
  }, [txns, now]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number }>();
    for (const t of thisMonth) {
      if (t.type !== 'expense') continue;
      const key = t.category_id ?? 'uncategorized';
      const existing = map.get(key);
      const name = t.category?.name ?? 'Uncategorized';
      const color = t.category?.color ?? '#94a3b8';
      if (existing) existing.value += Number(t.amount);
      else map.set(key, { name, color, value: Number(t.amount) });
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [thisMonth]);

  const byGroup = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number }>();
    for (const t of thisMonth) {
      if (t.type !== 'expense') continue;
      const key = t.group_id ?? 'unassigned';
      const existing = map.get(key);
      const name = t.group?.name ?? 'Unassigned';
      const color = t.group?.color ?? '#94a3b8';
      if (existing) existing.value += Number(t.amount);
      else map.set(key, { name, color, value: Number(t.amount) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [thisMonth]);

  const budgetProgress = useMemo(
    () => budgets.map((b) => computeBudgetProgress(b, txns, cats, groups)),
    [budgets, txns, cats, groups],
  );

  async function submitBudget(e: FormEvent) {
    e.preventDefault();
    if (!(form.amount > 0)) {
      toast.error('Amount must be positive');
      return;
    }
    if (form.scope !== 'overall' && !form.scope_id) {
      toast.error('Pick a target for this scope');
      return;
    }
    try {
      await createBudget.mutateAsync(form);
      toast.success('Budget added');
      setBudgetOpen(false);
      setForm(DEFAULT_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function removeBudget(id: string) {
    if (!confirm('Delete this budget?')) return;
    try {
      await delBudget.mutateAsync(id);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        subtitle={format(now, 'MMMM yyyy')}
        action={
          <Button size="sm" variant="outline" onClick={() => setBudgetOpen(true)}>
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Budget</span>
          </Button>
        }
      />

      {/* Totals tiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {TYPE_ORDER.map((t) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * TYPE_ORDER.indexOf(t) }}
          >
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {TYPE_META[t].emoji} {TYPE_META[t].label}
                </div>
                <div
                  className="mt-1 truncate text-lg font-semibold tabular-nums"
                  style={{
                    color:
                      totalsThisMonth[t] > 0
                        ? TYPE_META[t].color
                        : undefined,
                  }}
                >
                  {formatINR(totalsThisMonth[t])}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Budgets */}
      {budgetProgress.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Budgets
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {budgetProgress.map((p) => (
              <Card key={p.budget.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.periodLabel} · {p.budget.period}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeBudget(p.budget.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="tabular-nums">
                      {formatINR(p.spent)} / {formatINR(Number(p.budget.amount))}
                    </span>
                    {p.over ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Over
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatINR(p.remaining)} left
                      </span>
                    )}
                  </div>
                  <Progress
                    value={p.spent}
                    max={Number(p.budget.amount)}
                    barClassName={p.over ? 'bg-destructive' : undefined}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Monthly trend */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Last 6 months</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <XAxis dataKey="month" fontSize={11} />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <RTooltip formatter={(v: number) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="expense" stackId="a" fill={TYPE_META.expense.color} radius={[2, 2, 0, 0]} />
                <Bar dataKey="investment" stackId="a" fill={TYPE_META.investment.color} />
                <Bar dataKey="income" fill={TYPE_META.income.color} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses this month.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={44}
                      outerRadius={80}
                    >
                      {byCategory.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number) => formatINR(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Expenses by group</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {byGroup.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses this month.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byGroup} layout="vertical" margin={{ left: 8 }}>
                    <XAxis
                      type="number"
                      fontSize={11}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${v / 1000}k` : String(v)
                      }
                    />
                    <YAxis type="category" dataKey="name" fontSize={11} width={72} />
                    <RTooltip formatter={(v: number) => formatINR(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {byGroup.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New budget sheet */}
      <SheetBody
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        title="New budget"
        description="Cap spend for a category, group, type, or overall."
      >
        <form onSubmit={submitBudget} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    scope: v as BudgetScope,
                    scope_id: null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall expenses</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={form.period}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, period: v as BudgetPeriod }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.scope === 'type' && (
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.scope_id ?? ''}
                onValueChange={(v) => setForm((f) => ({ ...f, scope_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.scope === 'category' && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.scope_id ?? ''}
                onValueChange={(v) => setForm((f) => ({ ...f, scope_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji ?? '🏷️'} {c.name} · {c.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.scope === 'group' && (
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={form.scope_id ?? ''}
                onValueChange={(v) => setForm((f) => ({ ...f, scope_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.emoji ?? '📁'} {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: Number(e.target.value) }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setBudgetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBudget.isPending}>
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
        </form>
      </SheetBody>
    </div>
  );
}
