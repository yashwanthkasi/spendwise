import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { TypePill } from '@/components/TypePill';
import { displayPlace } from '@/services/location';
import { TYPE_META } from '@/lib/constants';
import { formatINR, cn } from '@/lib/utils';
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

  // Note is the headline. Fall back to category / raw text / type when empty.
  const title =
    txn.note?.trim() ||
    txn.category?.name ||
    txn.raw_input?.trim() ||
    TYPE_META[txn.type].label;

  const categoryLabel = txn.category?.name ?? null;
  const placeLabel = displayPlace(txn);
  // Avoid repeating the category when it's already the title (empty-note case).
  const showCategoryChip = !!categoryLabel && categoryLabel !== title;

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
        {/* Headline = note */}
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium first-letter:uppercase">
            {title}
          </span>
          <TypePill type={txn.type} className="shrink-0" />
        </div>

        {/* Meta line: category chip · time · group · lending · location */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showCategoryChip && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
              {categoryLabel}
            </span>
          )}
          <span>{format(new Date(txn.occurred_at), 'MMM d, h:mm a')}</span>
          {txn.group && (
            <span>
              · {txn.group.emoji ?? '📁'} {txn.group.name}
            </span>
          )}
          {txn.lending_details && (
            <span>
              · {txn.lending_details.direction === 'lent' ? '→' : '←'}{' '}
              {txn.lending_details.counterparty}
              {txn.lending_details.settled ? ' ✓' : ''}
            </span>
          )}
          {placeLabel && (
            <span className="inline-flex items-center gap-0.5 text-foreground/70">
              <MapPin className="h-3 w-3 shrink-0" />
              {placeLabel}
            </span>
          )}
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
