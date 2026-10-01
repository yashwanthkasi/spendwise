import { useProfile } from "@/hooks/useProfile";
import { TransactionRow } from "./TransactionRow";
import { groupByDay } from "@/lib/groupTransactions";
import type { TransactionWithRelations } from "@/hooks/useTransactions";
export function TransactionList({
  txns,
  onOpen,
}: {
  txns: TransactionWithRelations[];
  onOpen?: (t: TransactionWithRelations) => void;
}) {
  const { data: profile } = useProfile();
  return (
    <div className="space-y-6">
      {groupByDay(txns, profile?.timezone).map((s) => (
        <section key={s.key}>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">
            {s.label}
          </h3>
          <div>
            {s.items.map((t) => (
              <TransactionRow key={t.id} txn={t} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
