import { FormEvent, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Play, Pause, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SheetBody } from '@/components/ui/sheet';
import { TypePill } from '@/components/TypePill';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurringRules,
  useUpdateRecurring,
  type RecurringInput,
} from '@/hooks/useRecurring';
import { runDueRecurring } from '@/services/recurring';
import type { RecurringCadence, TransactionType } from '@/lib/db-types';
import { TYPE_META, TYPE_ORDER } from '@/lib/constants';
import { formatINR } from '@/lib/utils';

interface FormState {
  amount: number;
  type: TransactionType;
  category_id: string;
  group_id: string;
  note: string;
  cadence: RecurringCadence;
  start_date: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const DEFAULT_FORM: FormState = {
  amount: 0,
  type: 'expense',
  category_id: '',
  group_id: '',
  note: '',
  cadence: 'monthly',
  start_date: todayISO(),
};

export function RecurringSection() {
  const { data: rules = [], isLoading } = useRecurringRules();
  const { data: cats = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  useEffect(() => {
    const validCategory = cats.find(
      (c) => c.id === form.category_id && c.type === form.type,
    );
    if (!validCategory) setForm((f) => ({ ...f, category_id: '' }));
  }, [form.type, cats, form.category_id]);

  const filteredCats = cats.filter((c) => c.type === form.type);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!(form.amount > 0)) {
      toast.error('Amount must be positive');
      return;
    }
    const input: RecurringInput = {
      template: {
        amount: form.amount,
        type: form.type,
        category_id: form.category_id || null,
        group_id: form.group_id || null,
        note: form.note.trim() || null,
      },
      cadence: form.cadence,
      next_run_at: new Date(form.start_date).toISOString(),
      active: true,
    };
    try {
      await create.mutateAsync(input);
      toast.success('Rule added');
      setOpen(false);
      setForm(DEFAULT_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function runNow() {
    const n = await runDueRecurring();
    if (n > 0) {
      toast.success(`Inserted ${n} transaction${n === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['recurring_rules'] });
    } else {
      toast.info('Nothing is due right now');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Rules fire on app load. Missed runs catch up automatically.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runNow}>
            Run due
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recurring rules. Great for rent, SIP, salary.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rules.map((r) => {
            const tpl = r.template as {
              amount: number;
              type: TransactionType;
              category_id: string | null;
              group_id: string | null;
              note: string | null;
            };
            const cat = cats.find((c) => c.id === tpl.category_id);
            const grp = groups.find((g) => g.id === tpl.group_id);
            return (
              <Card key={r.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <TypePill type={tpl.type} />
                        <span className="text-base font-semibold tabular-nums">
                          {formatINR(tpl.amount)}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {cat ? `${cat.emoji ?? '🏷️'} ${cat.name}` : 'No category'}
                        {grp ? ` · ${grp.emoji ?? '📁'} ${grp.name}` : ''}
                        {tpl.note ? ` · ${tpl.note}` : ''}
                      </div>
                      <div className="text-xs">
                        {r.cadence} · next{' '}
                        <span className="font-medium">
                          {format(new Date(r.next_run_at), 'MMM d')}
                        </span>
                        {!r.active && (
                          <span className="ml-1 text-muted-foreground">(paused)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          update.mutate({ id: r.id, patch: { active: !r.active } })
                        }
                      >
                        {r.active ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => del.mutate(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SheetBody open={open} onOpenChange={setOpen} title="New recurring rule">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as TransactionType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_META[t].emoji} {TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category_id || 'none'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category_id: v === 'none' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji ?? '🏷️'} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={form.group_id || 'none'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, group_id: v === 'none' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.emoji ?? '📁'} {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cadence</Label>
              <Select
                value={form.cadence}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, cadence: v as RecurringCadence }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next run</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Flat rent, HDFC SIP"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </SheetBody>
    </div>
  );
}
