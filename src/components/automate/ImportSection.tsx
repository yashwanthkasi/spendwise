import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { TypePill } from '@/components/TypePill';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { useProfile } from '@/hooks/useProfile';
import {
  useCreateTransaction,
  type TransactionInput,
} from '@/hooks/useTransactions';
import { parseStatement } from '@/services/import';
import { isAIEnabled } from '@/services/parser/ai';
import type { ParsedTransaction } from '@/services/parser';
import { formatINR } from '@/lib/utils';

export function ImportSection() {
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const { data: profile } = useProfile();
  const create = useCreateTransaction();

  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rows, setRows] = useState<ParsedTransaction[]>([]);

  async function parse() {
    if (!text.trim()) return;
    if (!profile) {
      toast.error('Profile not ready');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseStatement(text, {
        categories,
        groups,
        defaultGroupId: profile.default_group_id,
        now: new Date(),
        timezone: profile.timezone,
      });
      setRows(parsed);
      if (parsed.length === 0) {
        toast.info('Nothing recognised.');
      } else {
        toast.success(
          `Parsed ${parsed.length} row${parsed.length === 1 ? '' : 's'}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setParsing(false);
    }
  }

  async function commit() {
    if (rows.length === 0) return;
    setCommitting(true);
    let inserted = 0;
    try {
      for (const r of rows) {
        const input: TransactionInput = {
          amount: r.amount,
          type: r.type,
          category_id: r.categoryId,
          group_id: r.groupId,
          occurred_at: r.occurredAt,
          note: r.note,
          raw_input: r.rawInput,
          source: 'import',
          lending: r.lending,
        };
        await create.mutateAsync(input);
        inserted++;
      }
      toast.success(`Imported ${inserted} row${inserted === 1 ? '' : 's'}`);
      setRows([]);
      setText('');
    } catch (err) {
      toast.error(
        `Failed after ${inserted}: ${err instanceof Error ? err.message : 'error'}`,
      );
    } finally {
      setCommitting(false);
    }
  }

  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paste a bank statement or any free-form list. Each line becomes a transaction.
      </p>

      {!isAIEnabled() && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          No AI key set — regex fallback only; may miss rows. Set{' '}
          <code className="rounded bg-muted px-1">VITE_GEMINI_API_KEY</code> or{' '}
          <code className="rounded bg-muted px-1">VITE_GROQ_API_KEY</code> in{' '}
          <code>.env</code>.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Statement text
        </div>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`05 Apr  UPI/ZOMATO/348299  -325.00
05 Apr  SALARY CREDITED  95000.00
06 Apr  UBER INDIA  -148.00
07 Apr  SIP-ICICI PRUDENTIAL  -10000.00`}
        />
        <div className="flex justify-end">
          <Button onClick={parse} disabled={!text.trim() || parsing}>
            <Sparkles className="h-4 w-4" />
            {parsing ? 'Parsing…' : 'Parse'}
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Review · {rows.length}
            </h3>
            <Button size="sm" onClick={commit} disabled={committing}>
              {committing ? 'Importing…' : `Import ${rows.length}`}
            </Button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <TypePill type={r.type} />
                      <span className="truncate text-sm font-medium">
                        {r.categoryName ?? 'Uncategorized'}
                      </span>
                      {r.groupName && (
                        <span className="truncate text-xs text-muted-foreground">
                          · {r.groupName}
                        </span>
                      )}
                      <span className="ml-auto text-sm font-semibold tabular-nums">
                        {formatINR(r.amount)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.rawInput}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                    Skip
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
