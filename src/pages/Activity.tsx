import { formatInTimeZone } from "date-fns-tz";
import { useProfile } from "@/hooks/useProfile";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import { toast } from "sonner";
import {
  useTransactionFeed,
  useSummary,
  fetchAllTransactions,
  fetchPage,
  type TransactionWithRelations,
} from "@/hooks/useTransactions";
import { useGroups } from "@/hooks/useGroups";
import { useCategories } from "@/hooks/useCategories";
import { PageHeader } from "@/components/PageHeader";
import { TransactionList } from "@/components/TransactionList";
import { TransactionEditor } from "@/components/TransactionEditor";
import { QueryState } from "@/components/QueryState";
import { SheetBody } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneySummary } from "@/components/MoneySummary";
import { rangeFromParams, DATE_PRESETS } from "@/lib/dateRange";
import type { TransactionType } from "@/lib/db-types";
import { TYPE_ORDER, TYPE_META } from "@/lib/constants";
import { exportCSV } from "@/services/export";
export default function Activity() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionWithRelations | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const { data: groups = [] } = useGroups({ includeArchived: true });
  const { data: cats = [] } = useCategories();
  const { data: profile } = useProfile();
  const range = rangeFromParams(params, profile?.timezone ?? "Asia/Kolkata");
  const filters = {
    type: (params.get("filter") ?? "all") as TransactionType | "all",
    groupId: params.get("group") ?? "all",
    categoryId: params.get("cat") ?? "all",
    search: params.get("q") ?? "",
    from: range.from ?? undefined,
    to: range.to ?? undefined,
    ruleId: params.get("rule") ?? undefined,
  };
  const feed = useTransactionFeed(filters);
  const summary = useSummary(filters);
  const txns = feed.data?.pages.flat() ?? [];
  function change(key: string, value: string) {
    setParams(
      (p) => {
        if (value && value !== "all") p.set(key, value);
        else if (key === "range") p.set(key, "all");
        else p.delete(key);
        p.delete("selected");
        return p;
      },
      { replace: true },
    );
  }
  useEffect(() => {
    const id = params.get("selected");
    if (!id) return;
    let cancelled = false;
    void fetchPage({ id }, null, 1)
      .then((rows) => {
        if (!cancelled) setSelected(rows.find((t) => t.id === id) ?? null);
      })
      .catch(() => toast.error("Unable to open transaction"));
    return () => {
      cancelled = true;
    };
  }, [params]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Everything in one place."
        action={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Export filtered transactions"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportCSV(await fetchAllTransactions(filters));
              } catch {
                toast.error("Export failed. Please retry.");
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={18} />
          </Button>
        }
      />
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="absolute left-3 top-3.5 text-muted-foreground"
          />
          <Input
            aria-label="Search transactions"
            className="h-11 pl-10"
            placeholder="Search your transactions"
            value={filters.search}
            onChange={(e) => change("q", e.target.value)}
          />
        </div>
        <Button
          aria-label="Filter transactions"
          variant="outline"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={18} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-full border bg-card px-4 text-xs"
          onClick={() => setFiltersOpen(true)}
        >
          {range.label} ↓
        </button>
        {filters.type !== "all" && (
          <button
            className="rounded-full bg-primary/10 px-4 text-xs text-primary"
            onClick={() => change("filter", "all")}
          >
            {TYPE_META[filters.type]?.label} ×
          </button>
        )}
        {(filters.groupId !== "all" ||
          filters.categoryId !== "all" ||
          filters.ruleId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setParams({ range: params.get("range") ?? "this-month" })
            }
          >
            Clear filters
          </Button>
        )}
      </div>
      <QueryState error={summary.error} retry={() => void summary.refetch()} />
      {summary.data && (
        <>
          <MoneySummary data={summary.data} />
          <p className="text-xs text-muted-foreground">
            {summary.data.count} transactions
            {filters.type === "investment"
              ? " · Contributions, not portfolio value"
              : ""}
          </p>
        </>
      )}
      <QueryState
        loading={feed.isLoading}
        error={feed.error}
        retry={() => void feed.refetch()}
      />
      {!feed.isLoading &&
        !feed.error &&
        (txns.length ? (
          <TransactionList txns={txns} onOpen={setSelected} />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No transactions match this view.
          </p>
        ))}
      {feed.hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          disabled={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
      <SheetBody
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filter transactions"
      >
        <div className="space-y-5">
          <label className="block text-sm">
            Period
            <select
              className="mt-2 w-full rounded-lg border bg-card p-3"
              value={params.get("range") ?? "this-month"}
              onChange={(e) => change("range", e.target.value)}
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom dates</option>
            </select>
          </label>
          {params.get("range") === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                From
                <input
                  className="mt-2 w-full rounded-lg border p-2"
                  type="date"
                  value={
                    range.from
                      ? formatInTimeZone(
                          range.from,
                          profile?.timezone ?? "Asia/Kolkata",
                          "yyyy-MM-dd",
                        )
                      : ""
                  }
                  onChange={(e) => change("from", e.target.value)}
                />
              </label>
              <label className="text-sm">
                To
                <input
                  className="mt-2 w-full rounded-lg border p-2"
                  type="date"
                  value={
                    range.to
                      ? formatInTimeZone(
                          range.to,
                          profile?.timezone ?? "Asia/Kolkata",
                          "yyyy-MM-dd",
                        )
                      : ""
                  }
                  onChange={(e) => change("to", e.target.value)}
                />
              </label>
            </div>
          )}
          <label className="block text-sm">
            Type
            <select
              className="mt-2 w-full rounded-lg border bg-card p-3"
              value={filters.type}
              onChange={(e) => change("filter", e.target.value)}
            >
              <option value="all">All types</option>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Group
            <select
              className="mt-2 w-full rounded-lg border bg-card p-3"
              value={filters.groupId}
              onChange={(e) => change("group", e.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Category
            <select
              className="mt-2 w-full rounded-lg border bg-card p-3"
              value={filters.categoryId}
              onChange={(e) => change("cat", e.target.value)}
            >
              <option value="all">All categories</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button className="w-full" onClick={() => setFiltersOpen(false)}>
            Show transactions
          </Button>
        </div>
      </SheetBody>
      <TransactionEditor
        selected={selected}
        onClose={() => {
          setSelected(null);
          if (params.has("selected")) change("selected", "");
        }}
      />
    </div>
  );
}
