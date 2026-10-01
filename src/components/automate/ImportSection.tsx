import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { capture } from "@/services/capture";
import {
  fetchAllTransactions,
  saveTransactions,
  type TransactionInput,
} from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SheetBody } from "@/components/ui/sheet";
import { TransactionForm } from "@/components/TransactionForm";
import { formatINR } from "@/lib/utils";
export function ImportSection() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<TransactionInput[]>([]);
  const [duplicates, setDuplicates] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [acceptDuplicates, setAcceptDuplicates] = useState(false);
  const request = useRef(crypto.randomUUID());
  const qc = useQueryClient();
  async function parse() {
    setBusy(true);
    setError("");
    try {
      const result = await capture(text, "import", crypto.randomUUID());
      if (result.status === "clarify") {
        setError(result.questions.join(" "));
        setRows([]);
        return;
      }
      if (result.status !== "review") return;
      const existing = await fetchAllTransactions();
      setRows(result.items);
      setDuplicates(
        result.items.flatMap((item, i) =>
          existing.some(
            (t) =>
              Number(t.amount) === item.amount &&
              t.type === item.type &&
              t.occurred_at.slice(0, 10) === item.occurred_at.slice(0, 10) &&
              t.note === item.note,
          )
            ? [i]
            : [],
        ),
      );
      setAcceptDuplicates(false);
      request.current = crypto.randomUUID();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read statement");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Import statement text</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Paste your statement with dates and descriptions. Review the entries
        before importing; balances and headings are excluded.
      </p>
      <label className="sr-only" htmlFor="statement">
        Statement text
      </label>
      <Textarea
        id="statement"
        rows={7}
        value={text}
        disabled={busy}
        onChange={(e) => {
          setText(e.target.value);
          setRows([]);
        }}
        placeholder="2026-04-05 Zomato debit 325.00"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy || !text.trim()} onClick={() => void parse()}>
        {busy ? "Working…" : "Review transactions"}
      </Button>
      {rows.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-medium">
            Review {rows.length} transactions
          </h3>
          {duplicates.length > 0 && (
            <label className="flex items-start gap-3 rounded-xl border p-4 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={acceptDuplicates}
                onChange={(e) => setAcceptDuplicates(e.target.checked)}
              />
              <span>
                {duplicates.length} possible duplicate
                {duplicates.length === 1 ? "" : "s"}. Import them anyway, or
                skip the marked rows below.
              </span>
            </label>
          )}
          <div className="divide-y">
            {rows.map((r, i) => (
              <div key={i} className="py-4">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">
                    {r.note}
                    {duplicates.includes(i) && (
                      <span className="block text-xs text-amber-800">
                        Possible duplicate
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {r.type} · {r.occurred_at.slice(0, 10)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatINR(r.amount)}
                  </span>
                </div>
                <div className="mt-1 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(i)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRows((rs) => rs.filter((_, j) => i !== j));
                      setDuplicates((ds) =>
                        ds
                          .filter((j) => j !== i)
                          .map((j) => (j > i ? j - 1 : j)),
                      );
                      request.current = crypto.randomUUID();
                    }}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            disabled={busy || (duplicates.length > 0 && !acceptDuplicates)}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await saveTransactions(rows, request.current);
                setRows([]);
                setText("");
                await qc.invalidateQueries({ queryKey: ["transactions"] });
                toast.success("Import complete");
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Import failed. No entries were saved.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : `Import ${rows.length} transactions`}
          </Button>
        </section>
      )}
      <SheetBody
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Edit imported transaction"
      >
        {editing !== null && (
          <TransactionForm
            key={editing}
            initialDraft={rows[editing]}
            onSubmit={async (input) => {
              setRows((rs) =>
                rs.map((r, i) => (i === editing ? { ...r, ...input } : r)),
              );
              request.current = crypto.randomUUID();
              setEditing(null);
            }}
          />
        )}
      </SheetBody>
    </div>
  );
}
