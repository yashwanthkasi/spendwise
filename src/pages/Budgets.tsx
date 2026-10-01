import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import {
  useBudgets,
  useUpdateBudget,
  useDeleteBudget,
} from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useGroups } from "@/hooks/useGroups";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import type { Budget } from "@/lib/db-types";
import { describeBudgetLabel } from "@/lib/budgetCalc";
import { formatINR } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SheetBody } from "@/components/ui/sheet";
import { BudgetSheet } from "@/components/budgets/BudgetSheet";
type Period = {
  id: string;
  period_offset: number;
  period_start: string;
  period_end: string;
  spent: number;
};
export default function Budgets() {
  const budgets = useBudgets();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: cats = [] } = useCategories();
  const { data: groups = [] } = useGroups({ includeArchived: true });
  const update = useUpdateBudget();
  const del = useDeleteBudget();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [selected, setSelected] = useState<Budget | null>(null);
  const report = useQuery({
    queryKey: ["transactions", user?.id, "budgets", budgets.data],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("budget_report");
      if (error) throw error;
      return data as Period[];
    },
  });
  const timezone = profile?.timezone ?? "Asia/Kolkata";
  return (
    <div className="space-y-6">
      <Link to="/more" className="text-sm text-muted-foreground">
        ← More
      </Link>
      <PageHeader
        title="Budgets"
        subtitle="A little intention goes a long way."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New budget
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        Each budget tracks its own scope. Overlapping budgets stay separate.
      </p>
      <QueryState
        loading={budgets.isLoading || report.isLoading}
        error={budgets.error || report.error}
        retry={() => {
          void budgets.refetch();
          void report.refetch();
        }}
      />
      {!budgets.isLoading && !budgets.error && !budgets.data?.length && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">Make a plan for this month</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with one spending limit. Add category or group limits when you
            need them.
          </p>
        </div>
      )}
      {report.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.data?.map((b) => {
            const current = report.data.find(
              (r) => r.id === b.id && r.period_offset === 0,
            );
            const spent = current?.spent ?? 0;
            const remaining = Number(b.amount) - spent;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="space-y-4 rounded-xl border bg-card p-5 text-left"
              >
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium">
                    {describeBudgetLabel(b, cats, groups)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {b.active ? b.period : "Paused"}
                  </span>
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {formatINR(spent)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    of {formatINR(Number(b.amount))}
                  </span>
                </p>
                <Progress
                  value={spent}
                  max={Number(b.amount)}
                  barClassName={remaining < 0 ? "bg-destructive" : undefined}
                />
                <p
                  className={`text-xs ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {formatINR(Math.abs(remaining))}{" "}
                  {remaining < 0 ? "over budget" : "remaining"}
                </p>
                <p className="text-xs text-primary">View history & manage →</p>
              </button>
            );
          })}
        </div>
      )}
      <BudgetSheet open={open} onOpenChange={setOpen} editing={editing} />
      <SheetBody
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={
          selected ? describeBudgetLabel(selected, cats, groups) : "Budget"
        }
      >
        {selected && (
          <div className="space-y-5">
            <h3 className="text-sm font-medium">Six-period history</h3>
            <div className="divide-y">
              {report.data
                ?.filter((r) => r.id === selected.id)
                .map((r) => (
                  <div
                    key={r.period_offset}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <span>
                      {formatInTimeZone(
                        r.period_start,
                        timezone,
                        selected.period === "weekly"
                          ? "d MMM yyyy"
                          : "MMMM yyyy",
                      )}
                    </span>
                    <span
                      className={
                        r.spent > Number(selected.amount)
                          ? "text-destructive"
                          : ""
                      }
                    >
                      {formatINR(r.spent)}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setEditing(selected);
                  setSelected(null);
                  setOpen(true);
                }}
              >
                Edit budget
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await update.mutateAsync({
                      id: selected.id,
                      patch: { active: !selected.active },
                    });
                    setSelected(null);
                  } catch {
                    toast.error("Could not update budget");
                  }
                }}
              >
                {selected.active ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (
                    !confirm(
                      "Delete this budget? Your transactions will remain.",
                    )
                  )
                    return;
                  try {
                    await del.mutateAsync(selected.id);
                    setSelected(null);
                  } catch {
                    toast.error("Could not delete budget");
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </SheetBody>
    </div>
  );
}
