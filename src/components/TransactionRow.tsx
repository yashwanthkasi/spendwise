import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import type { TransactionWithRelations } from "@/hooks/useTransactions";
import { formatINR } from "@/lib/utils";
export function TransactionRow({
  txn,
  onOpen,
}: {
  txn: TransactionWithRelations;
  onOpen?: (t: TransactionWithRelations) => void;
}) {
  const Icon =
    txn.type === "income"
      ? ArrowDownLeft
      : txn.type === "expense"
        ? ArrowUpRight
        : ArrowLeftRight;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(txn)}
      className="flex min-h-[76px] w-full items-center gap-3 border-b py-4 text-left last:border-0 hover:bg-muted/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {txn.note?.trim() || txn.category?.name || txn.type}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {txn.category?.name ?? txn.type}
          {txn.group ? ` · ${txn.group.name}` : ""}
          {txn.source === "recurring" ? " · Recurring" : ""}
        </span>
      </span>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${txn.type === "income" ? "text-primary" : ""}`}
      >
        {txn.type === "income" ? "+" : txn.type === "expense" ? "−" : ""}
        {formatINR(Number(txn.amount))}
      </span>
    </button>
  );
}
