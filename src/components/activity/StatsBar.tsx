import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { TYPE_META, TYPE_ORDER } from '@/lib/constants';
import type { TransactionType } from '@/lib/db-types';
import type { TransactionWithRelations } from '@/hooks/useTransactions';
import { formatINR } from '@/lib/utils';
import type { TypeFilter } from '@/components/activity/FiltersSheet';

export function StatsBar({
  txns,
  filter,
}: {
  txns: TransactionWithRelations[];
  filter: TypeFilter;
}) {
  const stats = useMemo(() => {
    const byType: Record<TransactionType, { count: number; amount: number }> = {
      expense: { count: 0, amount: 0 },
      income: { count: 0, amount: 0 },
      investment: { count: 0, amount: 0 },
      lending: { count: 0, amount: 0 },
      transfer: { count: 0, amount: 0 },
    };
    let total = 0;
    for (const t of txns) {
      const v = Number(t.amount);
      total += v;
      byType[t.type].amount += v;
      byType[t.type].count += 1;
    }
    return { byType, total };
  }, [txns]);

  // When narrowed to one type, show that type's color and a clean single tile.
  const single =
    filter !== 'all'
      ? {
          type: filter as TransactionType,
          amount: stats.byType[filter as TransactionType].amount,
          count: stats.byType[filter as TransactionType].count,
        }
      : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {txns.length} transaction{txns.length === 1 ? '' : 's'}
            </span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: single ? TYPE_META[single.type].color : undefined }}
            >
              {formatINR(single ? single.amount : stats.total)}
            </span>
          </div>

          {single ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {TYPE_META[single.type].emoji} {TYPE_META[single.type].label} total
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
              {TYPE_ORDER.map((t) => {
                const v = stats.byType[t];
                if (v.amount === 0) return null;
                return (
                  <div
                    key={t}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate text-muted-foreground">
                      {TYPE_META[t].emoji} {TYPE_META[t].label}
                    </span>
                    <span
                      className="shrink-0 font-semibold tabular-nums"
                      style={{ color: TYPE_META[t].color }}
                    >
                      {formatINR(v.amount)}
                    </span>
                  </div>
                );
              })}
              {stats.total === 0 && (
                <div className="col-span-full text-center text-muted-foreground">
                  No transactions in this view.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
