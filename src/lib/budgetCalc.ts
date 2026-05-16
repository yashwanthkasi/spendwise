import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Budget, BudgetPeriod, Category, Group } from '@/lib/db-types';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export function periodRangeAt(
  period: BudgetPeriod,
  offset: number,
  now: Date = new Date(),
): PeriodRange {
  if (period === 'weekly') {
    const ref = addWeeks(now, offset);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    return { start, end, label: `Week of ${format(start, 'd MMM')}` };
  }
  const ref = addMonths(now, offset);
  return {
    start: startOfMonth(ref),
    end: endOfMonth(ref),
    label: format(ref, 'MMM yyyy'),
  };
}

export function filterForScope(
  budget: Budget,
  transactions: TransactionWithRelations[],
  range: PeriodRange,
): TransactionWithRelations[] {
  const inRange = transactions.filter(
    (t) =>
      new Date(t.occurred_at) >= range.start &&
      new Date(t.occurred_at) <= range.end,
  );
  switch (budget.scope) {
    case 'overall':
      return inRange.filter((t) => t.type === 'expense');
    case 'type':
      return inRange.filter((t) => t.type === budget.scope_id);
    case 'category':
      return inRange.filter((t) => t.category_id === budget.scope_id);
    case 'group':
      return inRange.filter(
        (t) => t.group_id === budget.scope_id && t.type === 'expense',
      );
  }
}

export interface BudgetProgress {
  budget: Budget;
  label: string;
  spent: number;
  remaining: number;
  pct: number;
  over: boolean;
  range: PeriodRange;
  periodLabel: string;
  daysElapsed: number;
  daysLeft: number;
  totalDays: number;
  dailyAllowance: number | null; // null on the last day of a period
  forecast: number; // projected end-of-period spend at current pace
  paceStatus: 'on-track' | 'warning' | 'over';
}

export function describeBudgetLabel(
  budget: Budget,
  categories: Category[],
  groups: Group[],
): string {
  switch (budget.scope) {
    case 'overall':
      return 'All expenses';
    case 'type':
      return `${budget.scope_id ?? ''} (type)`;
    case 'category': {
      const c = categories.find((x) => x.id === budget.scope_id);
      return c ? `${c.emoji ?? '🏷️'} ${c.name}` : 'Category';
    }
    case 'group': {
      const g = groups.find((x) => x.id === budget.scope_id);
      return g ? `${g.emoji ?? '📁'} ${g.name}` : 'Group';
    }
  }
}

export function computeBudgetProgress(
  budget: Budget,
  transactions: TransactionWithRelations[],
  categories: Category[],
  groups: Group[],
  now: Date = new Date(),
): BudgetProgress {
  const range = periodRangeAt(budget.period, 0, now);
  const relevant = filterForScope(budget, transactions, range);
  const spent = relevant.reduce((acc, t) => acc + Number(t.amount), 0);
  const limit = Number(budget.amount);
  const remaining = Math.max(0, limit - spent);
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const over = spent > limit;

  const totalDays = Math.max(
    1,
    differenceInCalendarDays(range.end, range.start) + 1,
  );
  const daysElapsedRaw = differenceInCalendarDays(now, range.start) + 1;
  const daysElapsed = Math.max(1, Math.min(daysElapsedRaw, totalDays));
  const daysLeft = Math.max(0, totalDays - daysElapsed);
  const dailyAllowance =
    daysLeft > 0 ? Math.max(0, (limit - spent) / daysLeft) : null;

  // Forecast: extrapolate at current daily pace through end of period.
  const forecast = daysElapsed > 0 ? (spent / daysElapsed) * totalDays : spent;

  let paceStatus: BudgetProgress['paceStatus'] = 'on-track';
  if (over) paceStatus = 'over';
  else if (forecast > limit) paceStatus = 'warning';

  return {
    budget,
    label: describeBudgetLabel(budget, categories, groups),
    spent,
    remaining,
    pct,
    over,
    range,
    periodLabel: budget.period === 'weekly' ? 'This week' : 'This month',
    daysElapsed,
    daysLeft,
    totalDays,
    dailyAllowance,
    forecast,
    paceStatus,
  };
}

export interface BudgetHistoryRow {
  offset: number;
  range: PeriodRange;
  spent: number;
  over: boolean;
  pct: number;
}

export function computeBudgetHistory(
  budget: Budget,
  transactions: TransactionWithRelations[],
  count = 6,
  now: Date = new Date(),
): BudgetHistoryRow[] {
  const limit = Number(budget.amount);
  const rows: BudgetHistoryRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const offset = -i;
    const range = periodRangeAt(budget.period, offset, now);
    const spent = filterForScope(budget, transactions, range).reduce(
      (acc, t) => acc + Number(t.amount),
      0,
    );
    rows.push({
      offset,
      range,
      spent,
      over: spent > limit,
      pct: limit > 0 ? Math.min(100, (spent / limit) * 100) : 0,
    });
  }
  return rows;
}
