import { motion } from 'framer-motion';
import { TransactionRow } from '@/components/TransactionRow';
import { groupByDay } from '@/lib/groupTransactions';
import { formatINR } from '@/lib/utils';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

/**
 * Renders transactions grouped into per-day sections (Today / Yesterday / date)
 * with a subtle spend total on each header. Each row shows its own location.
 */
export function TransactionList({
  txns,
  onOpen,
}: {
  txns: TransactionWithRelations[];
  onOpen?: (t: TransactionWithRelations) => void;
}) {
  const sections = groupByDay(txns);

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.key} className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </h3>
            {section.spent > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatINR(section.spent)} spent
              </span>
            )}
          </div>
          <motion.div layout className="space-y-2">
            {section.items.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <TransactionRow txn={t} onOpen={onOpen} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
