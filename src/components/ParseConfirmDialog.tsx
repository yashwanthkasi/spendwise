import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionForm } from '@/components/TransactionForm';
import type { ParsedTransaction } from '@/services/parser';
import type { TransactionInput } from '@/hooks/useTransactions';

export function ParseConfirmDialog({
  parsed,
  open,
  onOpenChange,
  onConfirm,
}: {
  parsed: ParsedTransaction | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (input: TransactionInput) => Promise<void>;
}) {
  const initialDraft: Partial<TransactionInput> | undefined = parsed
    ? {
        type: parsed.type,
        amount: parsed.amount,
        category_id: parsed.categoryId,
        group_id: parsed.groupId,
        occurred_at: parsed.occurredAt,
        note: parsed.note,
        source: parsed.engine === 'ai' ? 'text_nl' : 'text_nl',
        raw_input: parsed.rawInput,
        lending: parsed.lending
          ? { counterparty: parsed.lending.counterparty, direction: parsed.lending.direction }
          : null,
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm transaction</DialogTitle>
          <DialogDescription>
            {parsed ? (
              <>
                Parsed by <b>{parsed.engine}</b> · confidence{' '}
                {(parsed.confidence * 100).toFixed(0)}%
                {parsed.reasoning ? ` · ${parsed.reasoning}` : ''}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {parsed && (
          <TransactionForm
            key={parsed.rawInput}
            initialDraft={initialDraft}
            submitLabel="Add"
            onCancel={() => onOpenChange(false)}
            onSubmit={async (input) => {
              await onConfirm({ ...input, raw_input: parsed.rawInput, source: 'text_nl' });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
