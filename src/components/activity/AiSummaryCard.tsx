import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  generateInsight,
  isInsightAvailable,
} from '@/services/insight';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

export function AiSummaryCard({
  txns,
  rangeLabel,
  filterDesc,
  signature,
}: {
  txns: TransactionWithRelations[];
  rangeLabel: string;
  filterDesc: string;
  signature: string; // changes when filters change -> invalidate cache
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSig = useRef<string>('');

  // Reset summary whenever filters change (signature changes).
  useEffect(() => {
    if (lastSig.current !== signature) {
      setSummary(null);
      setError(null);
      setOpen(false);
      lastSig.current = signature;
    }
  }, [signature]);

  if (!isInsightAvailable()) return null;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const s = await generateInsight({ txns, rangeLabel, filterDesc });
      if (!s) setError('Got no response from the AI. Try again.');
      setSummary(s);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  const noData = txns.length === 0;

  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/[0.04]">
      <CardContent className="p-3">
        <AnimatePresence mode="wait" initial={false}>
          {open && summary ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI summary
              </div>
              <p className="text-sm leading-relaxed">{summary}</p>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-7 text-xs"
                >
                  Hide
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={run}
                  disabled={loading}
                  className="h-7 gap-1.5 text-xs"
                >
                  <RefreshCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
                  Regenerate
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Summarize this view</div>
                <div className="text-xs text-muted-foreground">
                  {noData
                    ? 'Nothing to summarize yet — add some transactions.'
                    : `${txns.length} transaction${txns.length === 1 ? '' : 's'} in ${rangeLabel.toLowerCase()}.`}
                </div>
                {error && (
                  <div className="mt-1 text-xs text-destructive">{error}</div>
                )}
              </div>
              <Button
                size="sm"
                onClick={run}
                disabled={loading || noData}
                className="shrink-0 gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Summarize
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
