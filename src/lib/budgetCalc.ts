import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import type { Budget, Category, Group } from '@/lib/db-types';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

export interface BudgetProgress {
  budget: Budget;
  label: string;
  spent: number;
  remaining: number;
  pct: number;
  over: boolean;
  periodLabel: string;
}

export function periodRange(period: Budget['period'], now = new Date()) {
  if (period === 'weekly') {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

export function computeBudgetProgress(
  budget: Budget,
  transactions: TransactionWithRelations[],
  categories: Category[],
  groups: Group[],
): BudgetProgress {
  const { start, end } = periodRange(budget.period);
  const inPeriod = transactions.filter(
    (t) => new Date(t.occurred_at) >= start && new Date(t.occurred_at) <= end,
  );

  let relevant: TransactionWithRelations[] = [];
  let label = 'Overall';
  switch (budget.scope) {
    case 'overall':
      relevant = inPeriod.filter((t) => t.type === 'expense');
      label = 'All expenses';
      break;
    case 'type':
      relevant = inPeriod.filter((t) => t.type === budget.scope_id);
      label = `${budget.scope_id ?? ''} (type)`;
      break;
    case 'category': {
      relevant = inPeriod.filter((t) => t.category_id === budget.scope_id);
      const c = categories.find((x) => x.id === budget.scope_id);
      label = c ? `${c.emoji ?? '🏷️'} ${c.name}` : 'Category';
      break;
    }
    case 'group': {
      relevant = inPeriod.filter(
        (t) => t.group_id === budget.scope_id && t.type === 'expense',
      );
      const g = groups.find((x) => x.id === budget.scope_id);
      label = g ? `${g.emoji ?? '📁'} ${g.name}` : 'Group';
      break;
    }
  }

  const spent = relevant.reduce((acc, t) => acc + Number(t.amount), 0);
  const remaining = Math.max(0, Number(budget.amount) - spent);
  const pct = Math.min(100, (spent / Number(budget.amount)) * 100);
  const over = spent > Number(budget.amount);
  return {
    budget,
    label,
    spent,
    remaining,
    pct,
    over,
    periodLabel: budget.period === 'weekly' ? 'This week' : 'This month',
  };
}
