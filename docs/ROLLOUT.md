# Staged rollout and rollback

The implementation is additive. It does not replace the Supabase project, delete existing rows, reseed users, or reclassify old transactions. Production operations below require project access and have not been performed by the local build.

## 1. Baseline and backup

1. Record the current application deployment/version and project reference.
2. Take a provider database backup and a separate encrypted logical dump. Verify restoration on an isolated staging database. A CSV export is not a database backup.
3. Run the following read-only baseline before migration, saving results in a restricted location:

```sql
select user_id, type, count(*) as rows, sum(amount) as amount
from public.transactions group by user_id, type order by user_id, type;
select 'profiles' as relation, count(*) from public.profiles
union all select 'groups', count(*) from public.groups
union all select 'categories', count(*) from public.categories
union all select 'budgets', count(*) from public.budgets
union all select 'recurring_rules', count(*) from public.recurring_rules
union all select 'lending_details', count(*) from public.lending_details;
select id, user_id, next_run_at, last_run_at, active, template
from public.recurring_rules order by user_id, next_run_at;
```

Do not commit dumps, tokens, user records, or exported baseline results to Git.

## 2. Staging migration and services

- Apply migrations in order, including `0005_reliable_tracking.sql`, to the restored staging database.
- Re-run baseline queries. Counts, amounts, IDs, timestamps, relationships, and ownership must match before new transactions are recorded.
- The new `deleted_at` column starts null; pre-existing rows remain visible. Legacy enum values and tables remain intact.
- Run SQL tests and browser tests; then verify an actual staging account against hosted Supabase rather than the local fixture API.
- Move AI provider credentials to Edge Function secrets (`GEMINI_API_KEY`, optional `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`). Rotate every key previously distributed as `VITE_GEMINI_API_KEY` or `VITE_GROQ_API_KEY`; deleting it from source does not revoke deployed copies.
- Deploy both functions with JWT verification enabled. Keep the service-role key out of the client. The capture function operates with the caller's JWT/RLS.
- Run `npm run test:ai` with the real provider. Require ≥95% exact required-field accuracy and zero unsafe saves in the ambiguous test set. Do not enable production capture until this passes.
- Verify that all active profiles have valid IANA timezones and a usable default group. Archive groups without deleting their records.

## 3. Reconcile existing recurring rules

The migration intentionally sets `scheduler_enabled=false` on existing rules. It does not guess which historical entries came from which rule.

1. For each existing active rule, compare `next_run_at`, `last_run_at`, cadence, intended day of month, and old transactions with `source='recurring'`.
2. Associate only unambiguous historical matches with `recurring_occurrences` using `(rule_id, scheduled_at, transaction_id, user_id)`. When two rules have the same template/time, resolve the match manually. Do not delete or merge transactions automatically.
3. Set each rule's `next_run_at` to its first genuinely unrecorded occurrence, preserving its timezone and monthly anchor. For legacy rules already drifted to February 28, explicitly restore the intended anchor if it was January 31; this cannot be inferred from the drifted date alone.
4. Confirm `day_of_period` is 1–31 for monthly rules. Confirm lending templates have a counterparty and direction.
5. Enable only reconciled rules by ID. New rules created through the rewritten UI are marked ready automatically.
6. Enable Supabase Cron and schedule the worker once:

```sql
-- Run as the database owner, after reconciliation. Do not grant this RPC to clients.
select cron.schedule('spendwise-recurring', '* * * * *',
  'select public.process_recurring(now());');
```

The worker preserves the local schedule time, clamps short months, then restores the intended day in later months. It catches up at most 100 occurrences per rule per run. A failed rule rolls back its entries and stores `scheduler_error`; other rules continue. The occurrence key prevents retries recreating entries, including ones later soft-deleted by the user.

The new insert policy prevents old browser releases from inserting `source='recurring'`, eliminating races with the retired app-load runner. User edits and deletions of generated entries still work.

## 4. Production cutover

- Repeat backup and baseline checks on production. Apply the verified migration; deploy functions and server secrets.
- Verify the live schema version, JWT/RLS restrictions, parser health, export totals, and scheduler on a controlled account.
- Release the static client to the existing hosting project. Use the supplied `vercel.json` SPA fallback so direct links survive reloads.
- Verify login, all five transaction types, clarification, failed-save recovery, undo, budgets, archived groups, import/export, and mobile keyboard behavior on an actual phone.
- Check the production browser bundle for provider secrets. The only client credentials should be the public Supabase connection.
- Reconcile/enable the old rules, then activate the single Cron job. Monitor the first daily/weekly/month-end cycle.

## Monitoring

Use Supabase function logs for error rates/latency without logging raw personal descriptions or credentials. Inspect `cron.job_run_details`, plus:

```sql
select id, user_id, next_run_at, scheduler_error
from public.recurring_rules
where active and scheduler_enabled
  and (scheduler_error is not null or next_run_at < now() - interval '5 minutes');
```

Monitor clarification frequency, provider failures, atomic-write failures, oldest overdue recurrence, and export/report reconciliation. Investigate repeated clarification by extending the evaluation corpus, not by lowering validation thresholds.

## Rollback

Retain the previous static deployment, but **do not undo the additive database migration** or lose new records. Disable the Cron job before restoring a previous client. Keep the protection against old browser recurring inserts; use the verified server worker or pause recurrence while investigating. The old client does not understand soft deletion, so it may show deleted rows: prefer a patched rollback client that filters `deleted_at is null`. Do not re-expose revoked AI keys. Restore from backup only as a separately reviewed disaster-recovery action, never as a routine code rollback.
