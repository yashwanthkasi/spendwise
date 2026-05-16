import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { generateInsight, isInsightAvailable } from '@/services/insight';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

/**
 * Auto-loading AI summary at the top of Insights. Refreshes itself when the
 * selected month changes. Hidden entirely if no AI key is configured.
 */
export function AiPulse({
  txns,
  rangeLabel,
  filterDesc,
  signature,
  previousTxns,
  previousLabel,
}: {
  txns: TransactionWithRelations[];
  rangeLabel: string;
  filterDesc: string;
  signature: string;
  previousTxns?: TransactionWithRelations[];
  previousLabel?: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSig = useRef<string>('');
  const inFlight = useRef(false);

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const s = await generateInsight({
        txns,
        rangeLabel,
        filterDesc,
        previousTxns,
        previousLabel,
      });
      setSummary(s);
      if (!s) setError("AI didn't respond. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  // Auto-run on first mount + whenever the filter signature changes,
  // but only if we have data.
  useEffect(() => {
    if (lastSig.current === signature) return;
    lastSig.current = signature;
    setSummary(null);
    if (txns.length === 0) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, txns.length]);

  if (!isInsightAvailable()) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02]">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AI pulse · {rangeLabel}
          </div>
          <button
            onClick={run}
            disabled={loading || txns.length === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Regenerate"
            title="Regenerate"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {loading && !summary ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            </motion.div>
          ) : summary ? (
            <motion.p
              key="summary"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm leading-relaxed"
            >
              {summary}
            </motion.p>
          ) : txns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions for this period yet.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {error ?? 'Tap to generate a summary.'}
              </p>
              <Button size="sm" onClick={run} disabled={loading}>
                Generate
              </Button>
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
