-- SpendWise — add location to transactions.
-- Nullable columns so EXISTING rows are left completely untouched. Only new
-- transactions capture GPS coordinates + a reverse-geocoded place label.
-- Safe to run on any DB. Idempotent (uses `if not exists`).

-- ============================================================================
-- 1. Location columns on transactions
-- ============================================================================
alter table public.transactions
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6),
  add column if not exists place_label text;

-- ============================================================================
-- 2. Index to support "spend by location" grouping / filtering
-- ============================================================================
create index if not exists transactions_user_id_place_label_idx
  on public.transactions(user_id, place_label);
