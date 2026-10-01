import { it, expect } from "vitest";
import { rangeFromKey, rangeFromParams } from "../src/lib/dateRange";
import {
  amountEvidence,
  normalizedDescription,
} from "../supabase/functions/_shared/validation";
it("month boundary respects account timezone even on another device", () => {
  const range = rangeFromKey(
    "this-month",
    new Date("2026-09-30T20:00:00Z"),
    "Asia/Kolkata",
  );
  expect(range.from).toBe("2026-09-30T18:30:00.000Z");
  expect(range.to).toBe("2026-10-31T18:29:59.999Z");
});
it("insight drill-down retains exact UTC range without shifting a day", () => {
  const p = new URLSearchParams({
    range: "custom",
    from: "2026-09-30T18:30:00.000Z",
    to: "2026-10-31T18:29:59.999Z",
  });
  expect(rangeFromParams(p, "Asia/Kolkata").from).toBe(p.get("from"));
});
it("malformed bookmarked dates do not crash the app", () => {
  expect(() =>
    rangeFromParams(
      new URLSearchParams({
        range: "custom",
        from: "not-a-date",
        to: "nonsense",
      }),
      "Asia/Kolkata",
    ),
  ).not.toThrow();
});
it("amount evidence handles Indian notation and excludes ISO dates", () => {
  expect(
    amountEvidence("2026-09-15 petrol 1,250.50; salary 95k; bonus 1 lakh"),
  ).toEqual([1250.5, 95000, 100000]);
});
it("remembered categories ignore amounts in repeated descriptions", () => {
  expect(normalizedDescription("coffee 150")).toBe(
    normalizedDescription("coffee 200"),
  );
});
