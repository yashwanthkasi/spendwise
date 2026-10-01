import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { useProfile } from "@/hooks/useProfile";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  endOfDay,
} from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useSummary, type Summary } from "@/hooks/useTransactions";
import { supabase } from "@/lib/supabase";
import { formatINR } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { MoneySummary } from "@/components/MoneySummary";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
type Observation = {
  id: string;
  label: string;
  detail?: string;
  amount: number;
  filter: Record<string, string>;
};
export default function Insights() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? "Asia/Kolkata";
  const now = toZonedTime(new Date(), timezone);
  const iso = (d: Date) => fromZonedTime(d, timezone).toISOString();
  const month = subMonths(now, offset);
  const from = iso(startOfMonth(month));
  const to = iso(offset === 0 ? endOfDay(now) : endOfMonth(month));
  const filters = { from, to };
  const summary = useSummary(filters);
  const previous = subMonths(month, 1);
  const priorEnd =
    offset === 0
      ? endOfDay(
          new Date(
            previous.getFullYear(),
            previous.getMonth(),
            Math.min(now.getDate(), endOfMonth(previous).getDate()),
          ),
        )
      : endOfMonth(previous);
  const prior = useSummary({
    from: iso(startOfMonth(previous)),
    to: iso(priorEnd),
  });
  const trend = useQueries({
    queries: Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(month, 5 - i);
      const f = {
        from: iso(startOfMonth(d)),
        to: iso(endOfMonth(d)),
      };
      return {
        queryKey: ["transactions", user?.id, "trend", f],
        enabled: !!user,
        queryFn: async () => {
          const { data, error } = await supabase.rpc("transaction_summary", {
            p_filters: f,
          });
          if (error) throw error;
          return {
            label: format(d, "MMM"),
            amount: (data as Summary).by_type.expense?.amount ?? 0,
          };
        },
      };
    }),
  });
  const analysis = useQuery({
    queryKey: [
      "transactions",
      user?.id,
      "analysis",
      filters,
      summary.data?.revision,
      prior.data?.revision,
    ],
    enabled: !!summary.data?.count,
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze", {
        body: {
          filters,
          previousFilters: {
            from: iso(startOfMonth(previous)),
            to: iso(priorEnd),
          },
        },
      });
      if (error) throw error;
      return data as { observations: Observation[]; engine?: string };
    },
  });
  const spent = summary.data?.by_type.expense?.amount ?? 0;
  const prevSpent = prior.data?.by_type.expense?.amount ?? 0;
  const observations: Observation[] =
    analysis.data?.observations ??
    summary.data?.categories.slice(0, 3).map((c) => ({
      id: `category:${c.id}`,
      label: c.name,
      amount: c.amount,
      filter: {
        from,
        to,
        type: "expense",
        ...(c.id ? { categoryId: c.id } : {}),
      },
    })) ??
    [];
  return (
    <div className="space-y-8">
      <PageHeader
        title="Insights"
        subtitle="Understand where your money goes."
      />
      <div className="flex items-center justify-between">
        <Button
          aria-label="Previous month"
          variant="ghost"
          size="icon"
          onClick={() => setOffset((o) => o + 1)}
        >
          <ChevronLeft size={18} />
        </Button>
        <h2 className="text-sm font-medium">
          {format(month, "MMMM yyyy")}
          {offset === 0 ? " · so far" : ""}
        </h2>
        <Button
          aria-label="Next month"
          disabled={offset === 0}
          variant="ghost"
          size="icon"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <QueryState
        loading={summary.isLoading}
        error={summary.error}
        retry={() => void summary.refetch()}
      />
      {summary.data && (
        <>
          <MoneySummary data={summary.data} />
          {prior.data && (
            <p className="text-sm text-muted-foreground">
              {prevSpent
                ? `${Math.abs(((spent - prevSpent) / prevSpent) * 100).toFixed(0)}% ${spent >= prevSpent ? "more" : "less"} spending than ${offset === 0 ? "the same period last month" : "last month"}.`
                : "No spending recorded in the previous comparison period."}
            </p>
          )}
          {!!summary.data.count && (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Sparkles size={17} className="text-primary" />
                Your money, explained
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {analysis.isFetching
                  ? "Finding useful patterns…"
                  : analysis.error || analysis.data?.engine === "recorded"
                    ? "Based on your recorded totals."
                    : "Observations backed by your transactions."}
              </p>
              <div className="mt-4 divide-y">
                {observations.map((o) => {
                  const p = new URLSearchParams({
                    range: "custom",
                    from,
                    to,
                    filter: "expense",
                  });
                  if (o.filter.categoryId) p.set("cat", o.filter.categoryId);
                  if (o.filter.groupId) p.set("group", o.filter.groupId);
                  return (
                    <Link
                      key={o.id}
                      to={`/transactions?${p}`}
                      className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span>
                        {o.label}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {o.detail ??
                            (spent
                              ? `${((o.amount / spent) * 100).toFixed(0)}% of spending`
                              : "No spending")}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatINR(o.amount)} →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
          <Breakdown
            title="Spending by category"
            rows={summary.data.categories}
            total={spent}
            from={from}
            to={to}
            filterKey="cat"
          />
          <section>
            <h2 className="mb-5 text-sm font-medium">
              Spending over six months
            </h2>
            <div className="flex h-36 items-end gap-3">
              {trend.map((q, i) => {
                const max = Math.max(
                  1,
                  ...trend.map((t) => t.data?.amount ?? 0),
                );
                return (
                  <div
                    key={i}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center"
                  >
                    <span className="truncate text-[10px] text-muted-foreground">
                      {q.error
                        ? "Unavailable"
                        : q.data
                          ? formatINR(q.data.amount)
                          : "…"}
                    </span>
                    <div
                      className="mx-auto w-full max-w-12 rounded-t bg-primary/70"
                      style={{
                        height: `${Math.max(2, ((q.data?.amount ?? 0) / max) * 85)}%`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {q.data?.label ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <details className="border-t pt-4">
            <summary className="cursor-pointer py-2 text-sm font-medium">
              Groups and places
            </summary>
            <div className="mt-4 space-y-7">
              <Breakdown
                title="Spending by group"
                rows={summary.data.groups}
                total={spent}
                from={from}
                to={to}
                filterKey="group"
              />
              <Breakdown
                title="Spending by location"
                rows={summary.data.locations}
                total={spent}
              />
            </div>
          </details>
          <details className="border-t pt-4">
            <summary className="cursor-pointer py-2 text-sm font-medium">
              Other money movements
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              {(["investment", "transfer", "lending"] as const).map((t) => (
                <p key={t} className="flex justify-between">
                  <span>
                    {t === "investment"
                      ? "Investment contributions"
                      : t === "transfer"
                        ? "Transfers"
                        : "Loans recorded"}
                  </span>
                  <span>
                    {formatINR(summary.data!.by_type[t]?.amount ?? 0)}
                  </span>
                </p>
              ))}
              <p className="text-xs text-muted-foreground">
                These movements are separate from spending. Investment
                contributions are not portfolio valuations.
              </p>
            </div>
          </details>
          {!summary.data.count && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Add transactions to see your patterns here.
            </p>
          )}
        </>
      )}
    </div>
  );
}
function Breakdown({
  title,
  rows,
  total,
  from,
  to,
  filterKey,
}: {
  title: string;
  rows: { id?: string | null; name: string; amount: number }[];
  total: number;
  from?: string;
  to?: string;
  filterKey?: string;
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      {rows.length ? (
        rows.map((r) => (
          <div key={r.id ?? r.name} className="mb-4">
            <div className="mb-2 flex justify-between gap-3 text-sm">
              {filterKey && r.id ? (
                <Link
                  to={`/transactions?${new URLSearchParams({ range: "custom", from: from!, to: to!, filter: "expense", [filterKey]: r.id })}`}
                >
                  {r.name}
                </Link>
              ) : (
                <span>{r.name}</span>
              )}
              <span className="tabular-nums">{formatINR(r.amount)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/65"
                style={{ width: `${total ? (r.amount / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No spending recorded.</p>
      )}
    </section>
  );
}
