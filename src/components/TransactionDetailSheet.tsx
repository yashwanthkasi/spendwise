import { format } from 'date-fns';
import { Check, Pencil, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SheetBody } from '@/components/ui/sheet';
import { TypePill } from '@/components/TypePill';
import type { TransactionWithRelations } from '@/hooks/useTransactions';
import { TYPE_META } from '@/lib/constants';
import { formatINR } from '@/lib/utils';

export function TransactionDetailSheet({
  txn,
  onClose,
  onEdit,
  onDelete,
  onToggleSettle,
}: {
  txn: TransactionWithRelations | null;
  onClose: () => void;
  onEdit: (t: TransactionWithRelations) => void;
  onDelete: (t: TransactionWithRelations) => void;
  onToggleSettle?: (t: TransactionWithRelations) => void;
}) {
  const sign = txn ? TYPE_META[txn.type].signHint : 'neutral';
  const prefix = sign === 'debit' ? '−' : sign === 'credit' ? '+' : '';

  return (
    <SheetBody
      open={!!txn}
      onOpenChange={(o) => !o && onClose()}
      title="Transaction"
    >
      {txn && (
        <div className="space-y-4 pt-1">
          {/* Hero amount */}
          <div className="flex flex-col items-center gap-2 py-4">
            <TypePill type={txn.type} />
            <div
              className="text-4xl font-bold tracking-tight tabular-nums"
              style={{ color: TYPE_META[txn.type].color }}
            >
              {prefix}
              {formatINR(Number(txn.amount))}
            </div>
          </div>

          {/* Meta rows */}
          <div className="divide-y rounded-xl border bg-card">
            <MetaRow
              label="Category"
              value={
                txn.category
                  ? `${txn.category.emoji ?? '🏷️'} ${txn.category.name}`
                  : '—'
              }
            />
            <MetaRow
              label="Group"
              value={
                txn.group ? `${txn.group.emoji ?? '📁'} ${txn.group.name}` : '—'
              }
            />
            <MetaRow
              label="When"
              value={format(new Date(txn.occurred_at), 'EEE, d MMM yyyy · h:mm a')}
            />
            {txn.note && <MetaRow label="Note" value={txn.note} />}
            {txn.raw_input && txn.raw_input !== txn.note && (
              <MetaRow
                label="You said"
                value={<span className="italic">“{txn.raw_input}”</span>}
              />
            )}
          </div>

          {/* Lending block */}
          {txn.lending_details && (
            <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lending
              </div>
              <div className="text-sm">
                {txn.lending_details.direction === 'lent'
                  ? 'You lent to '
                  : 'You borrowed from '}
                <b>{txn.lending_details.counterparty}</b>
              </div>
              {txn.lending_details.due_date && (
                <div className="text-xs text-muted-foreground">
                  Due {txn.lending_details.due_date}
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span>
                  {txn.lending_details.settled ? (
                    <span className="text-[hsl(var(--success))]">✓ Settled</span>
                  ) : (
                    <span className="text-amber-600">⏳ Outstanding</span>
                  )}
                  {txn.lending_details.settled_at &&
                    ` · ${format(new Date(txn.lending_details.settled_at), 'MMM d')}`}
                </span>
                {onToggleSettle && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onToggleSettle(txn)}
                  >
                    {txn.lending_details.settled ? (
                      <>
                        <Undo2 className="h-3.5 w-3.5" /> Reopen
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> Mark settled
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onDelete(txn)}
              className="flex-1 gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button onClick={() => onEdit(txn)} className="flex-1 gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        </div>
      )}
    </SheetBody>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right">{value}</span>
    </div>
  );
}
