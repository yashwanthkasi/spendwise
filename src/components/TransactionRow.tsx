import { format } from 'date-fns';
import { TypePill } from '@/components/TypePill';
import { formatINR, cn } from '@/lib/utils';
import { TYPE_META } from '@/lib/constants';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

export function TransactionRow({
  txn,
  onOpen,
}: {
  txn: TransactionWithRelations;
  onOpen?: (t: TransactionWithRelations) => void;
}) {
  const sign = TYPE_META[txn.type].signHint;
  const prefix = sign === 'debit' ? '−' : sign === 'credit' ? '+' : '';

  const Container: React.ElementType = onOpen ? 'button' : 'div';

  return (
    <Container
      type={onOpen ? 'button' : undefined}
      onClick={onOpen ? () => onOpen(txn) : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left',
        onOpen &&
          'cursor-pointer transition-colors hover:bg-accent/40 active:bg-accent/60',
      )}
    >
      {/* Leading icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
        style={{
          backgroundColor: `${txn.category?.color ?? TYPE_META[txn.type].color}1a`,
        }}
      >
        {txn.category?.emoji ?? TYPE_META[txn.type].emoji}
      </div>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {txn.category?.name ?? TYPE_META[txn.type].label}
          </span>
          <TypePill type={txn.type} className="shrink-0" />
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {format(new Date(txn.occurred_at), 'MMM d, h:mm a')}
          {txn.group ? ` · ${txn.group.emoji ?? '📁'} ${txn.group.name}` : ''}
          {txn.lending_details
            ? ` · ${txn.lending_details.direction === 'lent' ? '→' : '←'} ${txn.lending_details.counterparty}${txn.lending_details.settled ? ' ✓' : ''}`
            : ''}
          {txn.note ? ` · ${txn.note}` : ''}
        </div>
      </div>

      {/* Trailing amount — fixed minimum width so rows align */}
      <div
        className="shrink-0 text-right text-sm font-semibold tabular-nums"
        style={{
          color:
            sign === 'debit'
              ? 'hsl(var(--destructive))'
              : sign === 'credit'
                ? 'hsl(var(--success))'
                : undefined,
        }}
      >
        {prefix}
        {formatINR(Number(txn.amount))}
      </div>
    </Container>
  );
}
