import { useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { AiPulse } from '@/components/insights/AiPulse';
import { CompareCard } from '@/components/insights/CompareCard';
import { MoversCard, type Mover } from '@/components/insights/MoversCard';
import { RankedList, type RankedItem } from '@/components/insights/RankedList';
import { useTransactions } from '@/hooks/useTransactions';
import { TYPE_META } from '@/lib/constants';
import { formatINR } from '@/lib/utils';
import type { TransactionType } from '@/lib/db-types';

export default function Insights() {
  const [month, setMonth] = useState<Date>(() => new Date());
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const prevMonth = subMonths(month, 1);
  const prevStart = startOfMonth(prevMonth);
  const prevEnd = endOfMonth(prevMonth);

  // Broad pull — enough to draw the 6-month trend and the prev-month compare.
  const { data: txns = [] } = useTransactions({ limit: 5000 });

  const isCurrentMonth = isSameMonth(month, new Date());
  const canGoForward = !isSameMonth(month, new Date());

  const thisMonthTxns = useMemo(
    () =>
      txns.filter(
        (t) =>
          new Date(t.occurred_at) >= monthStart &&
          new Date(t.occurred_at) <= monthEnd,
      ),
    [txns, monthStart, monthEnd],
  );
  const prevMonthTxns = useMemo(
    () =>
      txns.filter(
        (t) =>
          new Date(t.occurred_at) >= prevStart &&
          new Date(t.occurred_at) <= prevEnd,
      ),
    [txns, prevStart, prevEnd],
  );

  const totals = useMemo(() => totalsByType(thisMonthTxns), [thisMonthTxns]);
  const prevTotals = useMemo(
    () => totalsByType(prevMonthTxns),
    [prevMonthTxns],
  );

  const movers = useMemo<Mover[]>(() => {
    const curByCat = new Map<
      string,
      { name: string; emoji: string | null; color: string | null; amount: number }
    >();
    const prevByCat = new Map<string, number>();
    for (const t of thisMonthTxns) {
      if (t.type !== 'expense' || !t.category) continue;
      const k = t.category.id;
      const x = curByCat.get(k) ?? {
        name: t.category.name,
        emoji: t.category.emoji,
        color: t.category.color,
        amount: 0,
      };
      x.amount += Number(t.amount);
      curByCat.set(k, x);
    }
    for (const t of prevMonthTxns) {
      if (t.type !== 'expense' || !t.category) continue;
      const k = t.category.id;
      prevByCat.set(k, (prevByCat.get(k) ?? 0) + Number(t.amount));
    }
    const candidates: Mover[] = [];
    const keys = new Set<string>([...curByCat.keys(), ...prevByCat.keys()]);
    keys.forEach((k) => {
      const cur = curByCat.get(k);
      const prev = prevByCat.get(k) ?? 0;
      if (!cur && prev === 0) return;
      candidates.push({
        name: cur?.name ?? 'Category',
        emoji: cur?.emoji ?? null,
        color: cur?.color ?? null,
        current: cur?.amount ?? 0,
        previous: prev,
      });
    });
    candidates.sort(
      (a, b) =>
        Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous),
    );
    return candidates.slice(0, 3);
  }, [thisMonthTxns, prevMonthTxns]);

  const sixMonthTrend = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }).map((_, i) => {
      const m = subMonths(today, 5 - i);
      const s = startOfMonth(m);
      const e = endOfMonth(m);
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
      return { month: format(m, 'MMM'), ...agg };
    });
  }, [txns]);

  const categoryItems = useMemo<RankedItem[]>(() => {
    const map = new Map<string, RankedItem>();
    for (const t of thisMonthTxns) {
      if (t.type !== 'expense') continue;
      const key = t.category?.id ?? 'uncategorized';
      const ex = map.get(key);
      if (ex) {
        ex.amount += Number(t.amount);
        ex.count += 1;
      } else {
        map.set(key, {
          id: key,
          name: t.category?.name ?? 'Uncategorized',
          emoji: t.category?.emoji ?? '🏷️',
          color: t.category?.color ?? '#94a3b8',
          amount: Number(t.amount),
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [thisMonthTxns]);

  const groupItems = useMemo<RankedItem[]>(() => {
    const map = new Map<string, RankedItem>();
    for (const t of thisMonthTxns) {
      if (t.type !== 'expense') continue;
      const key = t.group?.id ?? 'unassigned';
      const ex = map.get(key);
      if (ex) {
        ex.amount += Number(t.amount);
        ex.count += 1;
      } else {
        map.set(key, {
          id: key,
          name: t.group?.name ?? 'Unassigned',
          emoji: t.group?.emoji ?? '📁',
          color: t.group?.color ?? '#94a3b8',
          amount: Number(t.amount),
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [thisMonthTxns]);

  const monthLabel = format(month, 'MMMM yyyy');
  const prevMonthLabel = format(prevMonth, 'MMMM yyyy');
  const sig = `${format(month, 'yyyy-MM')}|${thisMonthTxns.length}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Insights" />

      {/* Month picker */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center text-sm font-semibold">
          {monthLabel}
          {isCurrentMonth && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase text-primary">
              now
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* AI pulse — habits-aware */}
      <AiPulse
        txns={thisMonthTxns}
        rangeLabel={monthLabel}
        filterDesc={`month=${monthLabel}`}
        signature={sig}
        previousTxns={prevMonthTxns}
        previousLabel={prevMonthLabel}
      />

      {/* Spent · Income · Net vs previous */}
      <CompareCard
        spent={totals.expense}
        income={totals.income}
        spentPrev={prevTotals.expense}
        incomePrev={prevTotals.income}
        prevLabel={prevMonthLabel}
      />

      {/* Top movers vs previous */}
      {movers.length > 0 && <MoversCard movers={movers} />}

      {/* Category list — sorted desc, scrollable */}
      <RankedList
        title="Expenses by category"
        items={categoryItems}
        emptyText="No expenses this month yet."
      />

      {/* Group list — sorted desc, scrollable */}
      <RankedList
        title="Expenses by group"
        items={groupItems}
        emptyText="No expenses tagged to a group this month."
      />

      {/* 6-month trend — still worth keeping as one compact chart */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Last 6 months</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthTrend}>
                <XAxis dataKey="month" fontSize={11} />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <RTooltip formatter={(v: number) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="expense"
                  stackId="a"
                  fill={TYPE_META.expense.color}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="investment"
                  stackId="a"
                  fill={TYPE_META.investment.color}
                />
                <Bar
                  dataKey="income"
                  fill={TYPE_META.income.color}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function totalsByType(rows: { type: TransactionType; amount: number }[]) {
  const agg: Record<TransactionType, number> = {
    expense: 0,
    income: 0,
    investment: 0,
    lending: 0,
    transfer: 0,
  };
  for (const r of rows) agg[r.type] += Number(r.amount);
  return agg;
}
