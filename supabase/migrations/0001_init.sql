-- SpendWise initial schema
-- Run against a fresh Supabase project: supabase db push, or paste into SQL editor.

-- ============================================================================
-- Enums
-- ============================================================================
create type transaction_type as enum ('expense', 'income', 'investment', 'lending', 'transfer');
create type group_kind as enum ('persistent', 'trip');
create type transaction_source as enum ('manual', 'text_nl', 'voice_nl', 'recurring', 'import');
create type lending_direction as enum ('lent', 'borrowed');
create type budget_scope as enum ('overall', 'type', 'category', 'group');
create type budget_period as enum ('monthly', 'weekly');
create type recurring_cadence as enum ('daily', 'weekly', 'monthly');

-- ============================================================================
-- profiles
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_group_id uuid,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- groups
-- ============================================================================
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  color text,
  kind group_kind not null default 'persistent',
  start_date date,
  end_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index groups_user_id_idx on public.groups(user_id);

alter table public.profiles
  add constraint profiles_default_group_id_fkey
  foreign key (default_group_id) references public.groups(id) on delete set null;

-- ============================================================================
-- categories
-- ============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type transaction_type not null,
  emoji text,
  color text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);
create index categories_user_id_idx on public.categories(user_id);

-- ============================================================================
-- transactions
-- ============================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  type transaction_type not null,
  category_id uuid references public.categories(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  occurred_at timestamptz not null default now(),
  note text,
  raw_input text,
  source transaction_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_id_occurred_at_idx
  on public.transactions(user_id, occurred_at desc);
create index transactions_user_id_type_idx on public.transactions(user_id, type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- lending_details
-- ============================================================================
create table public.lending_details (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  counterparty text not null,
  direction lending_direction not null,
  settled boolean not null default false,
  settled_at timestamptz,
  due_date date
);

-- ============================================================================
-- budgets
-- ============================================================================
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope budget_scope not null,
  scope_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  period budget_period not null default 'monthly',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index budgets_user_id_idx on public.budgets(user_id);

-- ============================================================================
-- recurring_rules
-- ============================================================================
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template jsonb not null,
  cadence recurring_cadence not null,
  day_of_period int,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_rules_user_id_next_run_idx
  on public.recurring_rules(user_id, next_run_at)
  where active;

-- ============================================================================
-- parse_logs
-- ============================================================================
create table public.parse_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_input text not null,
  parsed jsonb not null,
  accepted boolean not null default false,
  corrected jsonb,
  model text,
  created_at timestamptz not null default now()
);
create index parse_logs_user_id_idx on public.parse_logs(user_id, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.lending_details enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.parse_logs enable row level security;

-- profiles: user can see/update only their own row
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());
create policy profiles_self_insert on public.profiles
  for insert with check (id = auth.uid());

-- generic user_id-based policies
create policy groups_owner on public.groups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categories_owner on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy transactions_owner on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy budgets_owner on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recurring_rules_owner on public.recurring_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy parse_logs_owner on public.parse_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- lending_details: owned via the parent transaction
create policy lending_details_owner on public.lending_details
  for all
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Signup seed trigger: profile + default group + system categories
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  personal_group_id uuid;
begin
  -- default group
  insert into public.groups (user_id, name, emoji, color, kind)
  values (new.id, 'Personal', '🏠', '#6366f1', 'persistent')
  returning id into personal_group_id;

  -- profile
  insert into public.profiles (id, default_group_id)
  values (new.id, personal_group_id);

  -- system categories
  insert into public.categories (user_id, name, type, emoji, color, is_system)
  values
    (new.id, 'Food',          'expense',    '🍽️', '#ef4444', true),
    (new.id, 'Groceries',     'expense',    '🛒', '#f97316', true),
    (new.id, 'Rent',          'expense',    '🏠', '#a855f7', true),
    (new.id, 'Utilities',     'expense',    '💡', '#eab308', true),
    (new.id, 'Transport',     'expense',    '🚗', '#3b82f6', true),
    (new.id, 'Fuel',          'expense',    '⛽', '#64748b', true),
    (new.id, 'Eating Out',    'expense',    '🍔', '#f43f5e', true),
    (new.id, 'Shopping',      'expense',    '🛍️', '#ec4899', true),
    (new.id, 'Health',        'expense',    '🩺', '#10b981', true),
    (new.id, 'Entertainment', 'expense',    '🎬', '#8b5cf6', true),
    (new.id, 'Education',     'expense',    '📚', '#0ea5e9', true),
    (new.id, 'Subscriptions', 'expense',    '📺', '#7c3aed', true),
    (new.id, 'Travel',        'expense',    '✈️', '#06b6d4', true),
    (new.id, 'Gifts',         'expense',    '🎁', '#f472b6', true),
    (new.id, 'Salary',        'income',     '💼', '#22c55e', true),
    (new.id, 'Freelance',     'income',     '🧑‍💻', '#14b8a6', true),
    (new.id, 'Refund',        'income',     '↩️',  '#84cc16', true),
    (new.id, 'Interest',      'income',     '🏦', '#65a30d', true),
    (new.id, 'SIP',           'investment', '📈', '#059669', true),
    (new.id, 'Stocks',        'investment', '📊', '#0d9488', true),
    (new.id, 'Mutual Fund',   'investment', '📉', '#0891b2', true),
    (new.id, 'FD',            'investment', '🏦', '#475569', true),
    (new.id, 'Crypto',        'investment', '🪙', '#f59e0b', true),
    (new.id, 'Lent',          'lending',    '🤝', '#6366f1', true),
    (new.id, 'Borrowed',      'lending',    '📥', '#e11d48', true),
    (new.id, 'Transfer',      'transfer',   '🔁', '#94a3b8', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
