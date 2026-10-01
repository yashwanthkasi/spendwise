import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const userA = "11111111-1111-4111-8111-111111111111",
  userB = "22222222-2222-4222-8222-222222222222";
const item = {
  amount: 250,
  type: "expense",
  category_id: null,
  group_id: null,
  occurred_at: "2026-01-15T12:00:00Z",
  note: "Lunch",
};
async function asUser(id = userA) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function save(items: unknown[], request = crypto.randomUUID()) {
  const r = await db.query<{ ids: string[] }>(
    "select public.save_transactions($1::uuid,$2::jsonb) ids",
    [request, JSON.stringify(items)],
  );
  return r.rows[0].ids;
}
beforeAll(async () => {
  await db.exec(
    `create schema auth; create role authenticated; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  for (const name of [
    "0001_init.sql",
    "0002_redesign_defaults.sql",
    "0003_budget_scope_text.sql",
    "0004_location.sql",
    "0005_reliable_tracking.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    `insert into auth.users values('${userA}'),('${userB}'); grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;`,
  );
  await asUser();
});
afterAll(() => db.close());
describe("database contracts", () => {
  it("saves and retries exactly once; rejects a changed payload under the same ID", async () => {
    const key = crypto.randomUUID();
    const ids = await save([item], key);
    expect(await save([item], key)).toEqual(ids);
    await expect(save([{ ...item, amount: 999 }], key)).rejects.toThrow(
      "different content",
    );
  });
  it("rolls the entire batch back when a lending item is invalid", async () => {
    const key = crypto.randomUUID();
    await expect(
      save([item, { ...item, type: "lending" }], key),
    ).rejects.toThrow();
    const r = await db.query(
      "select * from capture_requests where request_id=$1",
      [key],
    );
    expect(r.rows).toHaveLength(0);
  });
  it("updates lending atomically and supports type changes", async () => {
    const [id] = await save([
      {
        ...item,
        type: "lending",
        lending: { counterparty: "Ravi", direction: "lent" },
      },
    ]);
    await db.query("select update_transaction($1,$2,$3)", [
      id,
      "{}",
      JSON.stringify({ settled: true }),
    ]);
    let r = await db.query<{ settled: boolean }>(
      "select settled from lending_details where transaction_id=$1",
      [id],
    );
    expect(r.rows[0].settled).toBe(true);
    await db.query("select update_transaction($1,$2,null)", [
      id,
      JSON.stringify({ type: "expense" }),
    ]);
    r = await db.query(
      "select * from lending_details where transaction_id=$1",
      [id],
    );
    expect(r.rows).toHaveLength(0);
  });
  it("isolates users and rejects cross-account category references", async () => {
    const [id] = await save([item]);
    await asUser(userB);
    expect(
      (await db.query("select * from transactions where id=$1", [id])).rows,
    ).toHaveLength(0);
    const cat = (
      await db.query<{ id: string }>(
        "select id from categories where name='Food' limit 1",
      )
    ).rows[0].id;
    await asUser(userA);
    await expect(save([{ ...item, category_id: cat }])).rejects.toThrow(
      "Invalid category",
    );
  });
  it("paginates identical timestamps without gaps and aggregates beyond 5000 rows", async () => {
    await db.exec(
      `insert into transactions(user_id,amount,type,occurred_at,note) select '${userA}',1.25,'expense','2026-06-01T12:00:00Z','large-history' from generate_series(1,5103);`,
    );
    const filters = JSON.stringify({ search: "large-history" });
    const seen = new Set<string>();
    let cursor: unknown = null;
    for (;;) {
      const r = await db.query<{ page: { id: string; occurred_at: string }[] }>(
        "select transaction_page($1,$2,500) page",
        [filters, JSON.stringify(cursor)],
      );
      const page = r.rows[0].page;
      if (!page.length) break;
      for (const row of page) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
      cursor = page.at(-1);
      if (page.length < 500) break;
    }
    expect(seen.size).toBe(5103);
    const r = await db.query<{
      summary: { count: number; by_type: { expense: { amount: number } } };
    }>("select transaction_summary($1) summary", [filters]);
    expect(r.rows[0].summary.count).toBe(5103);
    expect(r.rows[0].summary.by_type.expense.amount).toBe(6378.75);
  });
  it("soft delete and undo preserve transaction IDs", async () => {
    const [id] = await save([item]);
    await db.query("select set_transactions_deleted($1,true)", [[id]]);
    expect(
      (
        await db.query<{ d: string }>(
          "select deleted_at d from transactions where id=$1",
          [id],
        )
      ).rows[0].d,
    ).toBeTruthy();
    await db.query("select set_transactions_deleted($1,false)", [[id]]);
    expect(
      (
        await db.query<{ d: null }>(
          "select deleted_at d from transactions where id=$1",
          [id],
        )
      ).rows[0].d,
    ).toBeNull();
  });
  it("blocks browser execution of the scheduler", async () => {
    await expect(db.query("select process_recurring()")).rejects.toThrow(
      "permission denied",
    );
  });
  it("keeps month-end anchor and prevents duplicate recurring occurrences", async () => {
    await db.exec("reset role");
    const { rows } = await db.query<{ id: string }>(
      `insert into recurring_rules(user_id,template,cadence,day_of_period,next_run_at,timezone,scheduler_enabled) values($1,$2,'monthly',31,'2026-01-31T03:30:00Z','Asia/Kolkata',true) returning id`,
      [userA, JSON.stringify(item)],
    );
    const id = rows[0].id;
    await db.query("select process_recurring('2026-03-31T10:00:00Z')");
    await db.query("select process_recurring('2026-03-31T10:00:00Z')");
    const r = await db.query<{ date: string }>(
      "select to_char(scheduled_at at time zone 'Asia/Kolkata','YYYY-MM-DD') date from recurring_occurrences where rule_id=$1 order by scheduled_at",
      [id],
    );
    expect(r.rows.map((x) => x.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    await asUser();
  });
  it("prevents old browser recurring inserts while permitting edits to generated entries",async()=>{
    await asUser();
    await expect(db.query("insert into transactions(user_id,amount,type,occurred_at,source) values($1,100,'expense',now(),'recurring')",[userA])).rejects.toThrow();
    const row=(await db.query<{id:string}>("select id from transactions where source='recurring' limit 1")).rows[0];
    await db.query('select update_transaction($1,$2,null)',[row.id,JSON.stringify({note:'Updated rent'})]);
  });
  it("keeps overlapping budgets separate and uses complete expense totals",async()=>{
    const id=(await db.query<{id:string}>("insert into budgets(user_id,scope,amount,period) values($1,'overall',10000,'monthly') returning id",[userA])).rows[0].id;
    await save([{...item,occurred_at:new Date().toISOString(),amount:123.45},{...item,type:'income',occurred_at:new Date().toISOString(),amount:1000}]);
    const report=(await db.query<{r:{id:string;period_offset:number;spent:number}[]}>('select budget_report() r')).rows[0].r;
    expect(report.filter(r=>r.id===id)).toHaveLength(6);
    expect(report.find(r=>r.id===id&&r.period_offset===0)?.spent).toBe(123.45);
  });

});
