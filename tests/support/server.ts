// Local-only Supabase contract harness. Uses the real SQL migrations and RLS;
// authentication and AI provider responses are fixtures, never production code.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  validatePayload,
  type Context,
} from "../../supabase/functions/_shared/validation";
const db = new PGlite();
const uid = "11111111-1111-4111-8111-111111111111";
await db.exec(
  `create schema auth; create role authenticated; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`,
);
for (const n of [
  "0001_init.sql",
  "0002_redesign_defaults.sql",
  "0003_budget_scope_text.sql",
  "0004_location.sql",
  "0005_reliable_tracking.sql",
])
  await db.exec(
    readFileSync(
      new URL("../../supabase/migrations/" + n, import.meta.url),
      "utf8",
    ),
  );
await db.exec(
  `insert into auth.users values('${uid}');update profiles set display_name='Yash' where id='${uid}'; grant usage on schema public to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated; set role authenticated;select set_config('request.jwt.claim.sub','${uid}',false);`,
);
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "test@spendwise.local",
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const token =
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: uid,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 86400,
    }),
  ).toString("base64url") +
  ".fixture";
const session = {
  access_token: token,
  refresh_token: "fixture-refresh",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  token_type: "bearer",
  user,
};
const rpcs: Record<string, string[]> = {
  budget_report: [],
  transaction_page: ["p_filters", "p_cursor", "p_size"],
  transaction_summary: ["p_filters"],
  save_transactions: ["p_request_id", "p_items"],
  update_transaction: ["p_id", "p_patch", "p_lending"],
  set_transactions_deleted: ["p_ids", "p_deleted"],
};
const tables = new Set([
  "profiles",
  "categories",
  "groups",
  "budgets",
  "recurring_rules",
  "transactions",
  "category_rules",
]);
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "*",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url!, "http://localhost");
    const path = url.pathname;
    const send = (value: unknown) => res.end(JSON.stringify(value));
    if (path === "/health") return send({ ok: true });
    if (path.startsWith("/auth/v1/token")) return send(session);
    if (path === "/auth/v1/user") return send(user);
    if (path === "/auth/v1/logout") return send({});
    if (path === "/functions/v1/analyze") {
      const { rows } = await db.query<{ s: any }>(
        "select transaction_summary($1) s",
        [JSON.stringify(body.filters)],
      );
      const s = rows[0].s;
      return send({
        revision: s.revision,
        observations: s.categories
          .slice(0, 3)
          .map((c: any) => ({
            id: c.id,
            label: c.name,
            amount: c.amount,
            filter: { ...body.filters, categoryId: c.id },
          })),
      });
    }
    if (path === "/functions/v1/capture") {
      if (body.text.includes("provider unavailable")) {
        res.statusCode = 503;
        return send({
          error:
            "Smart entry is temporarily unavailable. Your draft is safe; retry or use the form.",
        });
      }
      const cats = (await db.query<any>("select * from categories")).rows;
      const groups = (await db.query<any>("select * from groups")).rows;
      const ctx: Context = {
        categories: cats,
        groups,
        defaultGroupId: groups[0].id,
        timezone: "Asia/Kolkata",
        now: new Date().toISOString(),
      };
      const amount = Number(body.text.match(/\d+(?:\.\d+)?/)?.[0]);
      const payload = {
        complete: true,
        items: [
          {
            raw: body.text,
            amount,
            type: "expense",
            category_id: cats.find((c) => c.name === "Food").id,
            group_id: null,
            date_hint: "today",
            note: body.text,
            lending: null,
            ambiguous: /Ravi/.test(body.text),
            question: "Was this an expense or a loan?",
          },
        ],
      };
      const result = validatePayload(payload, ctx, body.text, body.source);
      if (result.questions.length)
        return send({ status: "clarify", ...result });
      if (body.source === "import")
        return send({ status: "review", items: result.items });
      const { rows } = await db.query<{ ids: string[] }>(
        "select save_transactions($1,$2) ids",
        [body.requestId, JSON.stringify(result.items)],
      );
      return send({ status: "saved", ids: rows[0].ids });
    }
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").at(-1)!;
      const keys = rpcs[name];
      if (!keys) throw new Error("Unknown RPC");
      const vals = keys.map((k) =>
        body[k] === null
          ? null
          : typeof body[k] === "object" && k !== "p_ids"
            ? JSON.stringify(body[k])
            : body[k],
      );
      const { rows } = await db.query<{ data: unknown }>(
        `select ${name}(${keys.map((_, i) => "$" + (i + 1)).join(",")}) data`,
        vals,
      );
      return send(rows[0].data);
    }
    if (path.startsWith("/rest/v1/")) {
      const table = path.split("/").at(-1)!;
      if (!tables.has(table)) throw new Error("Unknown table");
      const params: unknown[] = [];
      let where = "";
      for (const [k, v] of url.searchParams) {
        if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
        if (!/^[a-z_]+$/.test(k)) throw new Error("Invalid column");
        if (v.startsWith("eq.")) {
          params.push(v.slice(3));
          where += (where ? " and " : " where ") + `${k}=$${params.length}`;
        } else if (v.startsWith("in.(")) {
          params.push(v.slice(4, -1).split(","));
          where +=
            (where ? " and " : " where ") +
            `${k}=any($${params.length}::uuid[])`;
        }
      }
      let rows: unknown[];
      if (req.method === "GET") {
        const order = url.searchParams.get("order");
        const orderSql =
          order && /^[a-z_]+\.(asc|desc)$/.test(order)
            ? " order by " + order.replace(".", " ")
            : "";
        rows = (
          await db.query(`select * from ${table}${where}${orderSql}`, params)
        ).rows;
      } else if (req.method === "POST") {
        const keys = Object.keys(body);
        if (keys.some((k) => !/^[a-z_]+$/.test(k)))
          throw new Error("Invalid columns");
        const values = keys.map((k) =>
          typeof body[k] === "object" && body[k] !== null
            ? JSON.stringify(body[k])
            : body[k],
        );
        rows = (
          await db.query(
            `insert into ${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning *`,
            values,
          )
        ).rows;
      } else if (req.method === "PATCH") {
        const keys = Object.keys(body);
        if (keys.some((k) => !/^[a-z_]+$/.test(k)))
          throw new Error("Invalid columns");
        const sets = keys.map((k) => {
          params.push(
            typeof body[k] === "object" && body[k] !== null
              ? JSON.stringify(body[k])
              : body[k],
          );
          return `${k}=$${params.length}`;
        });
        rows = (
          await db.query(
            `update ${table} set ${sets.join(",")}${where} returning *`,
            params,
          )
        ).rows;
      } else if (req.method === "DELETE")
        rows = (
          await db.query(`delete from ${table}${where} returning *`, params)
        ).rows;
      else throw new Error("Unsupported method");
      return send(
        req.headers.accept?.includes("vnd.pgrst.object")
          ? (rows[0] ?? null)
          : rows,
      );
    }
    res.statusCode = 404;
    send({ error: "Not found" });
  } catch (e) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({ message: e instanceof Error ? e.message : "Error" }),
    );
  }
}).listen(54321, "127.0.0.1", () =>
  console.log(
    "Local SQL-backed test API ready on 54321 (fixture auth/AI only)",
  ),
);
