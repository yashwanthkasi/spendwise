# Spendwise

A mobile-first personal transaction tracker: type, speak, or use a form to record expenses, income, investments, loans, and transfers. Home, Transactions, Insights, and More keep everyday actions close and secondary tools organized.

## Run locally

Use Node.js **22.12 or newer**, then:

```sh
npm ci
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your project.
npm run dev
```

The browser only receives the public Supabase connection. AI credentials must **never** use the `VITE_` prefix. Without a connection the app shows setup guidance, rather than crashing.

Apply the database migrations and deploy the `capture` and `analyze` Supabase Edge Functions before using the rewritten client. **Existing installations must follow [the staged rollout guide](docs/ROLLOUT.md)** to back up data, rotate previously exposed AI keys, and reconcile recurring entries before enabling the scheduler.

## Product behavior

- Clear natural-language entries save automatically. Incomplete, contradictory, or ambiguous entries ask for clarification; no part of an uncertain batch is saved.
- Typed entry and final voice transcripts use the same server parser. Provider failures preserve the draft and offer the form. Browser speech support varies; text and form entry remain available.
- Saves use stable request IDs and an atomic database function. Repeat requests return the original transaction IDs.
- Transaction deletion is reversible. “Undo” restores the original row; related loan details remain intact.
- Reports use database aggregates, history uses a stable date/ID cursor, and exports fetch every matching page.
- Investments, transfers, and loans are separate from spending. “Income minus expenses” is not an account balance.
- AI selects useful observations from server-calculated facts; amounts and supporting links are rendered from those facts, never invented model prose.
- Budgets retain overall, type, category, and group scopes, weekly/monthly periods, history, and suggested amounts. Overlapping allowances are not added together.
- Recurring records are created by a server schedule, not browser activity. Old rules remain disabled until reconciliation. New schedules are marked ready, but require the deployed Cron job.
- Groups can be archived without changing past entries. Full loan settlement/reopen behavior is preserved.
- Import requires review and flags possible duplicates. CSV and PDF export contain the complete selected ledger; dates are labeled UTC.
- Location is opt-in and nonblocking. Microphone permission is requested only on a recording action.

## Verification

```sh
npm run test           # Pure validation + real PostgreSQL SQL/RLS tests via PGlite
npm run build          # Type checking and production bundle
npm run test:edge      # Deno type checking for both Edge Functions
npx playwright install chromium
npm run test:e2e       # Browser → local API → real SQL → UI
npm audit
```

Browser tests run a **local-only test harness** with fixture authentication and provider responses, backed by the actual migrations and PostgreSQL queries. No fixture user, data, auth bypass, or simulated backend is included in the application bundle. These tests do not substitute for live Supabase/provider validation.

For the real-model accuracy gate, configure `GEMINI_API_KEY` securely in the shell and run:

```sh
npm run test:ai
```

This reads `tests/ai-evaluation.json`, calls the configured model without inserting transactions, and fails below 95% exact required-field accuracy or on any unsafe automatic-save case. An unrun evaluation is **not** a passing result. Extend the corpus with real user corrections before release.

## Architecture

- React + TypeScript + Vite + Tailwind + Radix UI; React Query scopes cached data by account.
- `capture`: authenticated server parsing, field validation, clarification, and atomic commit.
- `analyze`: authenticated database statistics and constrained fact selection, with deterministic fallback.
- `transaction_page`, `transaction_summary`, `budget_report`: RLS-scoped read interfaces.
- `save_transactions`, `update_transaction`, `set_transactions_deleted`: atomic write interfaces.
- `process_recurring`: privileged scheduler-only function, rule locking and unique occurrence protection.

See [rollout and rollback](docs/ROLLOUT.md) and [verification notes](docs/VERIFICATION.md).
