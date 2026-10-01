# Verification record

This record describes the checks run for the Spendwise rewrite. Local checks use the actual Supabase migrations through a PostgreSQL-compatible PGlite harness; they do not access production data.

## Completed checks

- `npm run lint` — TypeScript project check passed.
- `npm run build` — production Vite bundle passed.
- `npm run test` — unit, validation, database, RLS, pagination, soft-delete, budget, and recurring tests passed (36 tests).
- `npm run test:edge` — both authenticated Edge Functions passed Deno type checking.
- `npm run test:e2e` — 11 browser flows passed at mobile and desktop widths.
- `npm audit --omit=dev` — no runtime vulnerabilities reported.

The browser suite covers the four navigation destinations, all five transaction types, natural-language capture and clarification, edit/delete/undo, saved drafts, filters, complete CSV export, PDF export, budgets, group archiving, import review, and recurring-rule controls.

## Release gates still requiring project access

- `npm run test:ai` has not been run because no provider key was supplied. It must reach 95% exact required-field accuracy and must reject the unsafe-save cases in `tests/ai-evaluation.json` before enabling automatic capture.
- Live Supabase migration, Edge Function deployment, Cron activation, backup, and recurring-entry reconciliation have not been run because this workspace has no production project credentials. Follow `docs/ROLLOUT.md` in a staging project first.
- Production acceptance still needs authenticated cross-account checks, real voice/browser permission checks, and baseline-total comparison against the existing installation.

