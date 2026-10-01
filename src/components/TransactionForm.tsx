import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { useProfile } from "@/hooks/useProfile";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";
import { useGroups } from "@/hooks/useGroups";
import type { LendingDirection, TransactionType } from "@/lib/db-types";
import { TYPE_META, TYPE_ORDER } from "@/lib/constants";
import type {
  TransactionInput,
  TransactionWithRelations,
} from "@/hooks/useTransactions";

function toLocalInput(iso: string, timezone: string) {
  return formatInTimeZone(iso, timezone, "yyyy-MM-dd'T'HH:mm");
}
function fromLocalInput(value: string, timezone: string) {
  return fromZonedTime(value, timezone).toISOString();
}

export interface TransactionFormProps {
  initial?: TransactionWithRelations | null;
  initialDraft?: Partial<TransactionInput>;
  draftKey?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
}

export function TransactionForm({
  initial,
  initialDraft: suppliedDraft,
  draftKey,
  submitLabel = "Save",
  onCancel,
  onSubmit,
}: TransactionFormProps) {
  const [initialDraft] = useState<Partial<TransactionInput> | undefined>(() => {
    if (draftKey) {
      try {
        const saved = sessionStorage.getItem(draftKey);
        if (saved) return JSON.parse(saved);
      } catch {
        /* unavailable */
      }
    }
    return suppliedDraft;
  });
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? "Asia/Kolkata";
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useGroups({includeArchived:true});

  const [type, setType] = useState<TransactionType>(
    initial?.type ?? initialDraft?.type ?? "expense",
  );
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount) : (initialDraft?.amount?.toString() ?? ""),
  );
  const [categoryId, setCategoryId] = useState<string>(
    initial?.category_id ?? initialDraft?.category_id ?? "",
  );
  const [groupId, setGroupId] = useState<string>(
    initial?.group_id ??
      initialDraft?.group_id ??
      profile?.default_group_id ??
      "",
  );
  const [occurredAt, setOccurredAt] = useState<string>(
    toLocalInput(
      initial?.occurred_at ??
        initialDraft?.occurred_at ??
        new Date().toISOString(),
      timezone,
    ),
  );
  const [note, setNote] = useState<string>(
    initial?.note ?? initialDraft?.note ?? "",
  );
  const [counterparty, setCounterparty] = useState<string>(
    initial?.lending_details?.counterparty ??
      initialDraft?.lending?.counterparty ??
      "",
  );
  const [direction, setDirection] = useState<LendingDirection>(
    initial?.lending_details?.direction ??
      initialDraft?.lending?.direction ??
      "lent",
  );
  const [dueDate, setDueDate] = useState<string>(
    initial?.lending_details?.due_date ?? initialDraft?.lending?.due_date ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!draftKey) return;
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          type,
          amount: Number(amount) || undefined,
          category_id: categoryId || null,
          group_id: groupId || null,
          occurred_at: fromLocalInput(occurredAt, timezone),
          note,
          lending:
            type === "lending"
              ? { counterparty, direction, due_date: dueDate || null }
              : null,
        }),
      );
    } catch {
      /* incomplete date or unavailable storage */
    }
  }, [
    draftKey,
    type,
    amount,
    categoryId,
    groupId,
    occurredAt,
    timezone,
    note,
    counterparty,
    direction,
    dueDate,
  ]);

  useEffect(() => {
    const validCategory = categories.find(
      (c) => c.id === categoryId && c.type === type,
    );
    if (categories.length && !validCategory) setCategoryId("");
  }, [type, categories, categoryId]);

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    if (type === "lending" && !counterparty.trim()) {
      toast.error("Counterparty is required for lending");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        amount: amt,
        type,
        category_id: categoryId || null,
        group_id: groupId || null,
        occurred_at: fromLocalInput(occurredAt, timezone),
        note: note.trim() || null,
        lending:
          type === "lending"
            ? {
                counterparty: counterparty.trim(),
                direction,
                due_date: dueDate || null,
              }
            : null,
      });
      if (draftKey) {
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* unavailable */
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not save. Your entries are still here.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as TransactionType)}
          >
            <SelectTrigger aria-label="Type">
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
            aria-label="Amount (₹)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={categoryId || "none"}
            onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
          >
            <SelectTrigger aria-label="Category">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji ?? "🏷️"} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Group</Label>
          <Select
            value={groupId || "none"}
            onValueChange={(v) => setGroupId(v === "none" ? "" : v)}
          >
            <SelectTrigger aria-label="Group">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {groups.filter(g=>!g.archived||g.id===groupId).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.emoji ?? "📁"} {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Date & time</Label>
        <Input
          aria-label="Date and time"
          required
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      {type === "lending" && (
        <div className="grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
          <div className="space-y-2">
            <Label>Counterparty</Label>
            <Input
              aria-label="Counterparty"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Ravi"
            />
          </div>
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as LendingDirection)}
            >
              <SelectTrigger aria-label="Direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lent">I lent them</SelectItem>
                <SelectItem value="borrowed">I borrowed from them</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Due date (optional)</Label>
            <Input
              aria-label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Note</Label>
        <Textarea
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
