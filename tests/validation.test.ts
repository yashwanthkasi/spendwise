import { describe, it, expect } from "vitest";
import {
  validatePayload,
  resolveDate,
  localDate,
  type Context,
} from "../supabase/functions/_shared/validation";
const ctx: Context = {
  categories: [
    { id: "food", name: "Food", type: "expense" },
    { id: "salary", name: "Salary", type: "income" },
    { id: "transport", name: "Transport", type: "expense" },
  ],
  groups: [{ id: "office", name: "Office", archived: false }],
  defaultGroupId: null,
  timezone: "Asia/Kolkata",
  now: "2026-09-30T20:00:00Z",
};
const item = {
  raw: "lunch 250",
  amount: 250,
  type: "expense",
  category_id: "food",
  group_id: null,
  date_hint: "today",
  note: "lunch",
  lending: null,
  ambiguous: false,
};
function check(changes: Record<string, unknown> = {}, text = "lunch 250") {
  return validatePayload(
    { complete: true, questions: [], items: [{ ...item, ...changes }] },
    ctx,
    text,
  );
}
describe("capture validation", () => {
  it("accepts a complete entry independently of model confidence", () => {
    expect(check({ confidence: 0 }).items[0]).toMatchObject({
      amount: 250,
      type: "expense",
      category_id: "food",
    });
    expect(check().questions).toEqual([]);
  });
  it.each([null, -1, 0, NaN, 1.001, "250", 1e12])(
    "rejects invalid amount %s",
    (amount) => expect(check({ amount }).questions.length).toBeGreaterThan(0),
  );
  it("does not boost uncertain intent because a category matches", () => {
    expect(
      check({ ambiguous: true, question: "Was this a loan?" }).questions,
    ).toContain("Was this a loan?");
  });
  it("requires valid user-owned group and category IDs", () => {
    expect(check({ group_id: "unknown" }).questions.length).toBeGreaterThan(0);
    expect(check({ category_id: "salary" }).questions.length).toBeGreaterThan(
      0,
    );
  });
  it("rejects fabricated source fragments and malformed objects", () => {
    expect(check({ raw: "invented" }).items).toHaveLength(0);
    expect(
      validatePayload({ items: [null], complete: true }, ctx, "hello").questions
        .length,
    ).toBeGreaterThan(0);
  });
  it.each(["did not pay", "might pay", "will pay", "owe Ravi", "set up rent"])(
    "clarifies non-completed instruction %s",
    (raw) => {
      expect(check({ raw }, raw).questions.length).toBeGreaterThan(0);
    },
  );
  it("flags a partially parsed batch", () => {
    expect(
      validatePayload({ complete: false, items: [item] }, ctx, item.raw)
        .questions.length,
    ).toBeGreaterThan(0);
  });
  it("requires loan counterparty and direction", () => {
    expect(
      check({ type: "lending", category_id: null, lending: null }).questions
        .length,
    ).toBeGreaterThan(0);
  });
  it("resolves relative dates in the profile timezone, with longest phrase first", () => {
    expect(localDate(ctx.now, ctx.timezone)).toBe("2026-10-01");
    expect(resolveDate("day before yesterday", ctx)).toBe(
      "2026-09-29T06:30:00.000Z",
    );
    expect(resolveDate("yesterday", ctx)).toBe("2026-09-30T06:30:00.000Z");
  });
  it("rejects unsupported and invalid dates", () => {
    expect(resolveDate("last Friday", ctx)).toBeNull();
    expect(resolveDate("2026-02-31", ctx)).toBeNull();
  });
  it("accepts shared context across a multi-entry result", () => {
    const input = "Yesterday lunch 250 and Uber 120 for Office";
    const result = validatePayload(
      {
        complete: true,
        items: [
          {
            ...item,
            raw: "lunch 250",
            date_hint: "yesterday",
            group_id: "office",
          },
          {
            ...item,
            raw: "Uber 120",
            amount: 120,
            category_id: "transport",
            date_hint: "yesterday",
            group_id: "office",
          },
        ],
      },
      ctx,
      input,
    );
    expect(result.questions).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].occurred_at).toBe(result.items[1].occurred_at);
  });
});
