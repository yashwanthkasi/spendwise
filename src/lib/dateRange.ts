import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  format,
} from "date-fns";

export type DateRangeKey =
  "this-month" | "last-month" | "7d" | "30d" | "this-year" | "all" | "custom";

export interface DateRange {
  key: DateRangeKey;
  from: string | null; // ISO
  to: string | null;
  label: string;
}

export const DATE_PRESETS: Array<{ key: DateRangeKey; label: string }> = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "this-year", label: "This year" },
  { key: "all", label: "All time" },
];

export function rangeFromKey(
  key: DateRangeKey,
  now = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): DateRange {
  now = toZonedTime(now, timezone);
  const iso = (d: Date) => fromZonedTime(d, timezone).toISOString();
  const today = endOfDay(now);
  switch (key) {
    case "this-month":
      return {
        key,
        from: iso(startOfMonth(now)),
        to: iso(endOfMonth(now)),
        label: "This month",
      };
    case "last-month": {
      const lm = subMonths(now, 1);
      return {
        key,
        from: iso(startOfMonth(lm)),
        to: iso(endOfMonth(lm)),
        label: "Last month",
      };
    }
    case "7d":
      return {
        key,
        from: iso(startOfDay(subDays(today, 6))),
        to: iso(today),
        label: "Last 7 days",
      };
    case "30d":
      return {
        key,
        from: iso(startOfDay(subDays(today, 29))),
        to: iso(today),
        label: "Last 30 days",
      };
    case "this-year":
      return {
        key,
        from: iso(startOfYear(now)),
        to: iso(endOfYear(now)),
        label: "This year",
      };
    case "all":
      return { key, from: null, to: null, label: "All time" };
    case "custom":
      return { key, from: null, to: null, label: "Custom" };
  }
}

export function customRange(
  fromYmd: string,
  toYmd: string,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): DateRange {
  let from = fromYmd;
  let to = toYmd;
  if (from > to) [from, to] = [to, from];
  return {
    key: "custom",
    from: fromZonedTime(from + "T00:00:00", timezone).toISOString(),
    to: fromZonedTime(to + "T23:59:59.999", timezone).toISOString(),
    label: `${format(new Date(from), "d MMM")} → ${format(new Date(to), "d MMM yyyy")}`,
  };
}

export function rangeFromParams(
  params: URLSearchParams,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): DateRange {
  const k = params.get("range") as DateRangeKey | null;
  if (k === "custom") {
    const from = params.get("from");
    const to = params.get("to");
    if (from && to) {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
      if (dateOnly.test(from) && dateOnly.test(to)) {
        try {
          return customRange(from, to, timezone);
        } catch {
          /* malformed bookmark */
        }
      } else if (
        Number.isFinite(Date.parse(from)) &&
        Number.isFinite(Date.parse(to))
      ) {
        const start = new Date(from).toISOString(),
          end = new Date(to).toISOString();
        return {
          key: "custom",
          from: start < end ? start : end,
          to: start < end ? end : start,
          label: `${formatInTimeZone(start, timezone, "d MMM")} → ${formatInTimeZone(end, timezone, "d MMM yyyy")}`,
        };
      }
    }
  }
  if (
    k === "this-month" ||
    k === "last-month" ||
    k === "7d" ||
    k === "30d" ||
    k === "this-year" ||
    k === "all"
  ) {
    return rangeFromKey(k, new Date(), timezone);
  }
  return rangeFromKey("this-month", new Date(), timezone);
}
