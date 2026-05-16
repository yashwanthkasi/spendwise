import type {
  BudgetPeriod,
  BudgetScope,
  TransactionType,
} from '@/lib/db-types';
import { periodRangeAt } from '@/lib/budgetCalc';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

export interface Suggestion {
  suggested: number;
  basis: string;
  periodsAnalyzed: number;
  average: number;
  max: number;
}

/**
 * Suggest a budget amount based on the last `lookback` past periods of spend
 * matching this scope. Deterministic — no AI call — so it works offline and
 * gives reproducible results.
 *
 * Returns `null` when there's no historic data to learn from.
 */
export function suggestBudgetAmount({
  scope,
  scopeId,
  period,
  transactions,
  lookback = 3,
  now = new Date(),
}: {
  scope: BudgetScope;
  scopeId: string | null;
  period: BudgetPeriod;
  transactions: TransactionWithRelations[];
  lookback?: number;
  now?: Date;
}): Suggestion | null {
  if (scope !== 'overall' && !scopeId) return null;

  const periodSpends: number[] = [];
  for (let i = 1; i <= lookback; i++) {
    const range = periodRangeAt(period, -i, now);
    const inRange = transactions.filter(
      (t) =>
        new Date(t.occurred_at) >= range.start &&
        new Date(t.occurred_at) <= range.end,
    );
    let scoped: TransactionWithRelations[] = [];
    switch (scope) {
      case 'overall':
        scoped = inRange.filter((t) => t.type === 'expense');
        break;
      case 'type':
        scoped = inRange.filter(
          (t) => t.type === (scopeId as TransactionType),
        );
        break;
      case 'category':
        scoped = inRange.filter((t) => t.category_id === scopeId);
        break;
      case 'group':
        scoped = inRange.filter(
          (t) => t.group_id === scopeId && t.type === 'expense',
        );
        break;
    }
    const total = scoped.reduce((a, t) => a + Number(t.amount), 0);
    if (total > 0) periodSpends.push(total);
  }

  if (periodSpends.length === 0) return null;

  const sum = periodSpends.reduce((a, n) => a + n, 0);
  const average = sum / periodSpends.length;
  const max = Math.max(...periodSpends);
  // Bias slightly toward max so a stretch goal isn't impossible; round to ₹100.
  const blended = (average + max) / 2;
  const suggested = Math.max(100, Math.ceil((blended * 1.05) / 100) * 100);

  const unit = period === 'weekly' ? 'week' : 'month';
  return {
    suggested,
    average,
    max,
    periodsAnalyzed: periodSpends.length,
    basis: `Avg ₹${Math.round(average).toLocaleString('en-IN')} / ${unit} over the last ${periodSpends.length} ${unit}${periodSpends.length === 1 ? '' : 's'} (max ₹${Math.round(max).toLocaleString('en-IN')})`,
  };
}
