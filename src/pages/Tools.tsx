import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { GroupsManager } from "@/components/settings/GroupsManager";
import { CategoriesManager } from "@/components/settings/CategoriesManager";
import { RecurringSection } from "@/components/automate/RecurringSection";
import { ImportSection } from "@/components/automate/ImportSection";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useSummary, fetchAllTransactions } from "@/hooks/useTransactions";
import { exportCSV, exportPDF } from "@/services/export";
import { formatINR } from "@/lib/utils";
export default function Tools() {
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const summary = useSummary({});
  const title =
    pathname === "/groups"
      ? "Groups"
      : pathname === "/categories"
        ? "Categories"
        : pathname === "/recurring"
          ? "Recurring transactions"
          : "Import & export";
  return (
    <div className="space-y-6">
      <Link to="/more" className="text-sm text-muted-foreground">
        ← More
      </Link>
      <PageHeader title={title} />
      {pathname === "/groups" ? (
        <>
          <GroupsManager />
          <section className="border-t pt-5">
            <h2 className="mb-3 text-sm font-medium">
              All-time spending by group
            </h2>
            {summary.data?.groups.map((g) => (
              <Link
                key={g.id ?? "none"}
                to={`/transactions?range=all${g.id ? `&group=${g.id}` : ""}`}
                className="flex min-h-12 items-center justify-between text-sm"
              >
                <span>{g.name}</span>
                <span>{formatINR(g.amount)} →</span>
              </Link>
            ))}
          </section>
        </>
      ) : pathname === "/categories" ? (
        <CategoriesManager />
      ) : pathname === "/recurring" ? (
        <RecurringSection />
      ) : (
        <>
          <ImportSection />
          <section className="space-y-4 border-t pt-6">
            <h2 className="text-sm font-medium">Export all transactions</h2>
            <p className="text-sm text-muted-foreground">
              Includes your complete history. Export a filtered selection from
              Transactions.
            </p>
            <div className="flex gap-3">
              {(["CSV", "PDF"] as const).map((kind) => (
                <Button
                  key={kind}
                  disabled={busy}
                  variant="outline"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const rows = await fetchAllTransactions();
                      await (kind === "CSV"
                        ? exportCSV(rows)
                        : exportPDF(rows));
                    } catch {
                      toast.error("Export failed. Please retry.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Preparing…" : kind}
                </Button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
