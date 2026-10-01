import { formatINR } from "@/lib/utils";
import type { Summary } from "@/hooks/useTransactions";
export function MoneySummary({ data }: { data: Summary }) {
  const spent = data.by_type.expense?.amount ?? 0;
  const income = data.by_type.income?.amount ?? 0;
  return (
    <div className="grid grid-cols-2 gap-5 border-y py-5">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Spent</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
          {formatINR(spent)}
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Received</p>
        <p className="text-2xl font-semibold tracking-tight text-primary tabular-nums sm:text-3xl">
          {formatINR(income)}
        </p>
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        Income minus expenses{" "}
        <span className="ml-2 font-medium text-foreground">
          {formatINR(income - spent)}
        </span>
      </p>
    </div>
  );
}
