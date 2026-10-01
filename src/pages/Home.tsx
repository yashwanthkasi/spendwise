import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import {
  useTransactionFeed,
  useSummary,
  type TransactionWithRelations,
} from "@/hooks/useTransactions";
import { useRecurringRules } from "@/hooks/useRecurring";
import { useBudgets } from "@/hooks/useBudgets";
import { useOpenCapture } from "@/components/MobileShell";
import { TransactionList } from "@/components/TransactionList";
import { TransactionEditor } from "@/components/TransactionEditor";
import { QueryState } from "@/components/QueryState";
import { MoneySummary } from "@/components/MoneySummary";
import { rangeFromKey } from "@/lib/dateRange";
import { formatINR } from "@/lib/utils";
export default function Home() {
  const { data: profile } = useProfile();
  const open = useOpenCapture();
  const feed = useTransactionFeed();
  const month = rangeFromKey(
    "this-month",
    new Date(),
    profile?.timezone ?? "Asia/Kolkata",
  );
  const summary = useSummary({ from: month.from!, to: month.to! });
  const { data: rules = [] } = useRecurringRules();
  const { data: budgets = [] } = useBudgets();
  const [selected, setSelected] = useState<TransactionWithRelations | null>(
    null,
  );
  const overall = budgets.find(
    (b) => b.active && b.scope === "overall" && b.period === "monthly",
  );
  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Your everyday money
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile?.display_name
            ? `Hello, ${profile.display_name.split(" ")[0]}.`
            : "A clearer picture."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Small entries. Better understanding.
        </p>
      </header>
      <button
        onClick={open}
        className="flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">
            What did you spend today?
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Type or say “lunch 250 for Office”
          </span>
        </span>
        <ArrowUpRight size={18} className="text-primary" />
      </button>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">This month</h2>
          <Link to="/insights" className="text-xs text-primary">
            View insights →
          </Link>
        </div>
        <QueryState
          loading={summary.isLoading}
          error={summary.error}
          retry={() => void summary.refetch()}
        />
        {summary.data && <MoneySummary data={summary.data} />}
      </section>
      {overall && summary.data && (
        <Link
          to="/budgets"
          className="block rounded-xl bg-primary/5 p-4 text-sm"
        >
          {formatINR(
            Math.abs(
              overall.amount - (summary.data.by_type.expense?.amount ?? 0),
            ),
          )}{" "}
          {(summary.data.by_type.expense?.amount ?? 0) > overall.amount
            ? "over your monthly budget"
            : "left in your monthly budget"}{" "}
          <span className="float-right">→</span>
        </Link>
      )}
      {rules.some((r) => r.active) && (
        <Link to="/recurring" className="block text-sm text-muted-foreground">
          {rules.filter((r) => r.active).length} active recurring transaction
          {rules.filter((r) => r.active).length === 1 ? "" : "s"}{" "}
          <span className="float-right">Manage →</span>
        </Link>
      )}
      <section>
        <div className="mb-5 flex justify-between">
          <h2 className="text-sm font-medium">Recent transactions</h2>
          <Link to="/transactions" className="text-xs text-primary">
            See all →
          </Link>
        </div>
        <QueryState
          loading={feed.isLoading}
          error={feed.error}
          retry={() => void feed.refetch()}
        />
        {!feed.isLoading &&
          !feed.error &&
          (feed.data?.pages[0]?.length ? (
            <TransactionList
              txns={feed.data.pages[0].slice(0, 8)}
              onOpen={setSelected}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="font-medium">Your story starts here</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first transaction to start seeing your spending
                clearly.
              </p>
            </div>
          ))}
      </section>
      <TransactionEditor
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
