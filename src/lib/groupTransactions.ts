import { format, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { TransactionWithRelations } from "@/hooks/useTransactions";

export interface DaySection {
  key: string;
  label: string;
  items: TransactionWithRelations[];
  /** Sum of expense amounts on this day (for the section header). */
  spent: number;
}

/**
 * Buckets transactions into per-day sections labelled Today / Yesterday / date.
 * Assumes the input is already sorted newest-first (as the query returns them),
 * so both the section order and the items within each section stay descending.
 */
export function groupByDay(
  txns: TransactionWithRelations[],
  timezone = "Asia/Kolkata",
): DaySection[] {
  const now = toZonedTime(new Date(), timezone);
  const map = new Map<string, TransactionWithRelations[]>();
  for (const t of txns) {
    const key = format(toZonedTime(t.occurred_at, timezone), "yyyy-MM-dd");
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(t);
  }

  const sections: DaySection[] = [];
  for (const [key, items] of map) {
    const d = toZonedTime(items[0].occurred_at, timezone);
    const label =
      key === format(now, "yyyy-MM-dd")
        ? "Today"
        : key === format(subDays(now, 1), "yyyy-MM-dd")
          ? "Yesterday"
          : format(d, "EEE, d MMM");
    const spent = items
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + Number(t.amount), 0);
    sections.push({ key, label, items, spent });
  }
  return sections;
}
