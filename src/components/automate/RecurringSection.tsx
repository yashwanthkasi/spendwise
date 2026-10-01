import { useState } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SheetBody } from "@/components/ui/sheet";
import { TransactionForm } from "@/components/TransactionForm";
import { QueryState } from "@/components/QueryState";
import {
  useRecurringRules,
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
} from "@/hooks/useRecurring";
import { useProfile } from "@/hooks/useProfile";
import type { RecurringRule, RecurringCadence } from "@/lib/db-types";
import type { TransactionInput } from "@/hooks/useTransactions";
import { formatINR } from "@/lib/utils";
export function RecurringSection() {
  const rules = useRecurringRules();
  const { data: profile } = useProfile();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [cadence, setCadence] = useState<RecurringCadence>("monthly");
  const [date, setDate] = useState("");
  const timezone = profile?.timezone ?? "Asia/Kolkata";
  function edit(rule: RecurringRule | null) {
    setEditing(rule);
    setCadence(rule?.cadence ?? "monthly");
    setDate(
      formatInTimeZone(rule?.next_run_at ?? new Date(), timezone, "yyyy-MM-dd"),
    );
    setOpen(true);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-sm text-muted-foreground">
          Recorded automatically on the scheduled date, even when the app is
          closed.
        </p>
        <Button onClick={() => edit(null)}>New recurring</Button>
      </div>
      <QueryState
        loading={rules.isLoading}
        error={rules.error}
        retry={() => void rules.refetch()}
      />
      {!rules.isLoading && !rules.error && !rules.data?.length && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Add rent, salary, or a subscription to get started.
        </p>
      )}
      <div className="divide-y">
        {rules.data?.map((r) => {
          const t = r.template as unknown as TransactionInput;
          return (
            <article key={r.id} className="py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-medium">
                    {t.note || "Recurring transaction"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.cadence} ·{" "}
                    {r.active
                      ? `Next ${formatInTimeZone(r.next_run_at, r.timezone ?? timezone, "d MMM yyyy")}`
                      : "Paused"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {formatINR(t.amount)}
                </span>
              </div>
              {!r.scheduler_enabled && (
                <p className="mt-2 text-xs text-amber-800">
                  Existing schedule awaiting deployment reconciliation. No
                  automatic entries will be added until it is enabled.
                </p>
              )}
              {r.scheduler_error && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  This schedule needs attention. Edit its details and retry.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => edit(r)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update.mutate(
                      { id: r.id, patch: { active: !r.active } },
                      {
                        onError: () => toast.error("Could not change schedule"),
                      },
                    )
                  }
                >
                  {r.active ? "Pause" : "Resume"}
                </Button>
                <Link
                  className="inline-flex min-h-11 items-center px-3 text-sm text-primary"
                  to={`/transactions?range=all&rule=${r.id}`}
                >
                  History
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this schedule? Its transactions will remain.",
                      )
                    )
                      del.mutate(r.id, {
                        onError: () => toast.error("Could not delete schedule"),
                      });
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <SheetBody
        open={open}
        onOpenChange={setOpen}
        title={
          editing ? "Edit recurring transaction" : "New recurring transaction"
        }
        description="The amount below will be recorded automatically. A schedule does not make a payment."
      >
        <div className="mb-5 grid grid-cols-2 gap-3">
          <label className="text-sm">
            Repeats
            <select
              className="mt-2 w-full rounded-lg border bg-card p-3"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as RecurringCadence)}
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
          <label className="text-sm">
            Next occurrence
            <input
              className="mt-2 min-h-12 w-full rounded-lg border bg-card p-2"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <TransactionForm
          key={editing?.id ?? "new"}
          initialDraft={
            editing?.template as Partial<TransactionInput> | undefined
          }
          submitLabel={editing ? "Save schedule" : "Create schedule"}
          onSubmit={async (input) => {
            if (!date) throw new Error("Choose the next occurrence date");
            const { occurred_at: _date, ...template } = input;
            const next = fromZonedTime(
              date + "T09:00:00",
              timezone,
            ).toISOString();
            const patch = {
              template: template as unknown as Record<string, unknown>,
              cadence,
              next_run_at: next,
              day_of_period: Number(date.slice(-2)),
              timezone,
            };
            if (editing) await update.mutateAsync({ id: editing.id, patch });
            else
              await create.mutateAsync({
                ...patch,
                active: true,
                scheduler_enabled: true,
              });
            setOpen(false);
            toast.success("Schedule saved");
          }}
        />
      </SheetBody>
    </div>
  );
}
