-- SpendWise — fix `budgets.scope_id` typing.
-- The column was originally `uuid`, but for `scope='type'` we need to store
-- a transaction_type enum value (e.g. 'expense') which is not a valid UUID.
-- For 'category' and 'group' scopes the value is still a UUID — stored as text.
-- Widening uuid → text is lossless, so existing rows are preserved.
--
-- Safe to run on any DB at any point. Idempotent (re-running on a `text`
-- column is a no-op for Postgres).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'scope_id'
      and data_type = 'uuid'
  ) then
    alter table public.budgets
      alter column scope_id type text using scope_id::text;
  end if;
end$$;
