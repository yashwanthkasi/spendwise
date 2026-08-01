import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SheetBody } from '@/components/ui/sheet';
import { TypePill } from '@/components/TypePill';
import { TransactionForm } from '@/components/TransactionForm';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import type { ParsedTransaction } from '@/services/parser';
import { PARSE_CONFIDENCE_THRESHOLD } from '@/lib/constants';
import type { TransactionInput } from '@/hooks/useTransactions';
import { cn, formatINR } from '@/lib/utils';

export function BulkConfirmSheet({
  parsed,
  rawInput,
  open,
  onOpenChange,
  onConfirm,
}: {
  parsed: ParsedTransaction[];
  rawInput: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (inputs: TransactionInput[]) => Promise<void>;
}) {
  const [items, setItems] = useState<ParsedTransaction[]>(parsed);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useGroups();

  // Reset state when reopened with a new parse.
  useEffect(() => {
    if (open) {
      setItems(parsed);
      setEditingIndex(null);
    }
  }, [open, parsed]);

  const total = useMemo(
    () => items.reduce((acc, i) => acc + Number(i.amount), 0),
    [items],
  );
  const lowConfidenceCount = items.filter(
    (i) => i.confidence < PARSE_CONFIDENCE_THRESHOLD,
  ).length;

  function skipAt(i: number) {
    setItems((s) => s.filter((_, idx) => idx !== i));
  }

  function applyEdit(i: number, input: TransactionInput) {
    const cat = input.category_id
      ? categories.find((c) => c.id === input.category_id)
      : null;
    const grp = input.group_id
      ? groups.find((g) => g.id === input.group_id)
      : null;
    setItems((s) =>
      s.map((item, idx) =>
        idx === i
          ? {
              ...item,
              type: input.type,
              amount: input.amount,
              categoryId: input.category_id,
              categoryName: cat?.name ?? null,
              groupId: input.group_id,
              groupName: grp?.name ?? null,
              occurredAt: input.occurred_at,
              note: input.note,
              lending: input.lending
                ? {
                    counterparty: input.lending.counterparty,
                    direction: input.lending.direction,
                  }
                : null,
              confidence: 1,
            }
          : item,
      ),
    );
    setEditingIndex(null);
  }

  async function commit() {
    if (items.length === 0) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    try {
      const inputs: TransactionInput[] = items.map((it) => ({
        amount: it.amount,
        type: it.type,
        category_id: it.categoryId,
        group_id: it.groupId,
        occurred_at: it.occurredAt,
        note: it.note,
        raw_input: it.rawInput,
        source: 'text_nl',
        lending: it.lending
          ? {
              counterparty: it.lending.counterparty,
              direction: it.lending.direction,
            }
          : null,
      }));
      await onConfirm(inputs);
    } finally {
      setSubmitting(false);
    }
  }

  const editing = editingIndex !== null ? items[editingIndex] : null;

  return (
    <SheetBody
      open={open}
      onOpenChange={onOpenChange}
      title={
        editing
          ? 'Edit item'
          : `Add ${items.length} transaction${items.length === 1 ? '' : 's'}?`
      }
      description={editing ? undefined : `You said: “${rawInput}”`}
    >
      {editing ? (
        <div className="space-y-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={() => setEditingIndex(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to list
          </Button>
          <TransactionForm
            initial={null}
            initialDraft={{
              amount: editing.amount,
              type: editing.type,
              category_id: editing.categoryId,
              group_id: editing.groupId,
              occurred_at: editing.occurredAt,
              note: editing.note,
              lending: editing.lending,
            }}
            submitLabel="Save"
            onCancel={() => setEditingIndex(null)}
            onSubmit={async (input) => {
              applyEdit(editingIndex!, input);
            }}
          />
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {lowConfidenceCount > 0 && (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {lowConfidenceCount} item{lowConfidenceCount === 1 ? '' : 's'} flagged
              low-confidence — review before adding.
            </div>
          )}

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing to add — all items were skipped.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => {
                const low = it.confidence < PARSE_CONFIDENCE_THRESHOLD;
                return (
                  <motion.div
                    key={`${it.rawInput}-${i}`}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card
                      className={cn(
                        low && 'border-amber-500/50 bg-amber-500/[0.03]',
                      )}
                    >
                      <CardContent className="flex items-center gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <TypePill type={it.type} />
                            <span className="truncate text-sm font-medium first-letter:uppercase">
                              {it.note?.trim() || it.categoryName || 'Uncategorized'}
                            </span>
                            <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
                              {formatINR(Number(it.amount))}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {it.categoryName && (
                              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
                                {it.categoryName}
                              </span>
                            )}
                            {it.groupName && <span> · {it.groupName}</span>}
                            {low && (
                              <span className="ml-1 text-amber-600">
                                · low confidence
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingIndex(i)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => skipAt(i)}
                          aria-label="Skip"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Total</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatINR(total)}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={commit}
              disabled={submitting || items.length === 0}
            >
              {submitting
                ? 'Adding…'
                : items.length === 0
                  ? 'Nothing to add'
                  : `Add ${items.length}`}
            </Button>
          </div>
        </div>
      )}
    </SheetBody>
  );
}
