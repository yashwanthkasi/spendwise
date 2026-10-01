import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import { TransactionForm } from "./TransactionForm";
import { SheetBody } from "./ui/sheet";
import {
  useDeleteTransaction,
  useUpdateTransaction,
  setDeleted,
  type TransactionWithRelations,
} from "@/hooks/useTransactions";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
export function TransactionEditor({
  selected,
  onClose,
}: {
  selected: TransactionWithRelations | null;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [remember, setRemember] = useState(false);
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const qc = useQueryClient();
  const { user } = useAuth();
  const busy = useRef(false);
  return (
    <>
      <TransactionDetailSheet
        txn={selected}
        onClose={onClose}
        onEdit={(t) => {
          setEditing(t);
          setRemember(false);
          onClose();
        }}
        onDelete={async (t) => {
          if (busy.current) return;
          busy.current = true;
          try {
            await del.mutateAsync(t.id);
            onClose();
            toast.success("Transaction deleted", {
              action: {
                label: "Undo",
                onClick: () => {
                  void setDeleted([t.id], false)
                    .then(() =>
                      qc.invalidateQueries({ queryKey: ["transactions"] }),
                    )
                    .catch(() => toast.error("Unable to restore. Try again."));
                },
              },
            });
          } catch {
            toast.error("Could not delete. Please retry.");
          } finally {
            busy.current = false;
          }
        }}
        onToggleSettle={
          selected?.lending_details
            ? async (t) => {
                try {
                  await update.mutateAsync({
                    id: t.id,
                    patch: {},
                    lending: { settled: !t.lending_details!.settled },
                  });
                  onClose();
                } catch {
                  toast.error("Could not update settlement.");
                }
              }
            : undefined
        }
      />
      <SheetBody
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Edit transaction"
      >
        {editing && (
          <>
            <TransactionForm
              initial={editing}
              onSubmit={async (input) => {
                await update.mutateAsync({
                  id: editing.id,
                  patch: {
                    amount: input.amount,
                    type: input.type,
                    category_id: input.category_id,
                    group_id: input.group_id,
                    occurred_at: input.occurred_at,
                    note: input.note,
                  },
                  lending: input.lending ?? undefined,
                });
                if (
                  remember &&
                  input.category_id &&
                  editing.raw_input &&
                  user
                ) {
                  const { error } = await supabase
                    .from("category_rules")
                    .upsert(
                      {
                        user_id: user.id,
                        phrase: editing.raw_input
                          .toLowerCase()
                          .trim()
                          .slice(0, 160),
                        category_id: input.category_id,
                      },
                      { onConflict: "user_id,phrase" },
                    );
                  if (error)
                    toast.error(
                      "Transaction saved, but the category preference could not be remembered.",
                    );
                }
                setEditing(null);
                toast.success("Changes saved");
              }}
            />
            {editing.raw_input && (
              <label className="mt-5 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember this category for the same description
              </label>
            )}
          </>
        )}
      </SheetBody>
    </>
  );
}
