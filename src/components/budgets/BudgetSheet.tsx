import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetBody } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { useTransactions } from '@/hooks/useTransactions';
import {
  useCreateBudget,
  useUpdateBudget,
  type BudgetInput,
} from '@/hooks/useBudgets';
import { TYPE_ORDER } from '@/lib/constants';
import type {
  Budget,
  BudgetPeriod,
  BudgetScope,
  TransactionType,
} from '@/lib/db-types';
import { suggestBudgetAmount } from '@/services/budgetSuggest';
import { formatINR } from '@/lib/utils';

const DEFAULT_FORM: BudgetInput = {
  scope: 'category',
  scope_id: null,
  amount: 0,
  period: 'monthly',
  active: true,
};

export function BudgetSheet({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Budget | null;
}) {
  const { data: cats = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const { data: txns = [] } = useTransactions({ limit: 2000 });
  const create = useCreateBudget();
  const update = useUpdateBudget();

  const [form, setForm] = useState<BudgetInput>(DEFAULT_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            scope: editing.scope,
            scope_id: editing.scope_id,
            amount: Number(editing.amount),
            period: editing.period,
            active: editing.active,
          }
        : DEFAULT_FORM,
    );
  }, [open, editing]);

  const suggestion = useMemo(
    () =>
      suggestBudgetAmount({
        scope: form.scope,
        scopeId: form.scope_id,
        period: form.period,
        transactions: txns,
      }),
    [form.scope, form.scope_id, form.period, txns],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!(form.amount > 0)) {
      toast.error('Amount must be positive');
      return;
    }
    if (form.scope !== 'overall' && !form.scope_id) {
      toast.error('Pick a target for this scope');
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: form });
        toast.success('Budget updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Budget created');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <SheetBody
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit budget' : 'New budget'}
      description="Cap spending against a category, group, type or overall."
    >
      <form onSubmit={onSubmit} className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select
              value={form.scope}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  scope: v as BudgetScope,
                  scope_id: null,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall expenses</SelectItem>
                <SelectItem value="type">Transaction type</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <Select
              value={form.period}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, period: v as BudgetPeriod }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.scope === 'type' && (
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.scope_id ?? ''}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, scope_id: v as TransactionType }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {form.scope === 'category' && (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.scope_id ?? ''}
              onValueChange={(v) => setForm((f) => ({ ...f, scope_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji ?? '🏷️'} {c.name} · {c.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {form.scope === 'group' && (
          <div className="space-y-2">
            <Label>Group</Label>
            <Select
              value={form.scope_id ?? ''}
              onValueChange={(v) => setForm((f) => ({ ...f, scope_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.emoji ?? '📁'} {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <Label>Amount (₹)</Label>
            {suggestion && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, amount: suggestion.suggested }))
                }
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Sparkles className="h-3 w-3" />
                Use {formatINR(suggestion.suggested)}
              </button>
            )}
          </div>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={form.amount || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, amount: Number(e.target.value) }))
            }
            placeholder="e.g. 10000"
          />
          {suggestion ? (
            <p className="text-xs text-muted-foreground">{suggestion.basis}</p>
          ) : form.scope !== 'overall' && form.scope_id ? (
            <p className="text-xs text-muted-foreground">
              Not enough past data to suggest a number yet.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={create.isPending || update.isPending}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </SheetBody>
  );
}
