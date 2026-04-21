-- SpendWise — mobile redesign additions.
-- Safe to run on a database that already has 0001_init.sql applied.
-- Idempotent: re-running should be a no-op.

-- ============================================================================
-- 1. Add a description column to categories
-- ============================================================================
alter table public.categories
  add column if not exists description text;

-- ============================================================================
-- 2. Backfill descriptions for all existing system categories
-- ============================================================================
update public.categories set description = case name
  when 'Food'          then 'Daily meals — rice, dal, roti. e.g., "rice 400".'
  when 'Groceries'     then 'Kitchen shopping — vegetables, milk, staples. e.g., "groceries 2500".'
  when 'Rent'          then 'Monthly house or flat rent. e.g., "rent 20000".'
  when 'Utilities'     then 'Electricity, water, gas, internet bills. e.g., "electricity 1500".'
  when 'Transport'     then 'Uber, Ola, metro, bus, auto. e.g., "uber 250".'
  when 'Fuel'          then 'Petrol, diesel, CNG. e.g., "petrol 1500".'
  when 'Eating Out'    then 'Restaurants, cafés, Zomato, Swiggy. e.g., "zomato 450".'
  when 'Shopping'      then 'Clothes, gadgets, general retail. e.g., "amazon 1200".'
  when 'Health'        then 'Doctor visits, medicine, hospital. e.g., "medicine 300".'
  when 'Entertainment' then 'Movies, streaming, concerts. e.g., "netflix 649".'
  when 'Education'     then 'Courses, books, exam fees. e.g., "udemy 500".'
  when 'Subscriptions' then 'Recurring apps & services. e.g., "spotify 119".'
  when 'Travel'        then 'Flights, hotels, holiday trips. e.g., "flight 8500".'
  when 'Gifts'         then 'Presents for people. e.g., "birthday gift 1500".'
  when 'Salary'        then 'Monthly paycheck from employer. e.g., "salary 95000".'
  when 'Freelance'     then 'Client income, invoice payments. e.g., "invoice 25000".'
  when 'Refund'        then 'Money returned to you. e.g., "refund 999".'
  when 'Interest'      then 'Savings or FD interest earned. e.g., "interest 1200".'
  when 'SIP'           then 'Systematic Investment Plan into mutual funds. e.g., "SIP 10000".'
  when 'Stocks'        then 'Buying equity / shares. e.g., "stocks 5000".'
  when 'Mutual Fund'   then 'One-time mutual fund investment. e.g., "MF 50000".'
  when 'FD'            then 'Fixed Deposit with a bank. e.g., "FD 100000".'
  when 'Crypto'        then 'Bitcoin, Ethereum, etc. e.g., "bitcoin 5000".'
  when 'Lent'          then 'Money you gave to someone to pay back. e.g., "lent Ravi 2000".'
  when 'Borrowed'      then 'Money you took from someone. e.g., "borrowed 500 from Aarav".'
  when 'Transfer'      then 'Money moving between your own accounts. e.g., "bank to wallet 1000".'
  else description
end
where is_system = true;

-- ============================================================================
-- 3. Backfill extra default groups for existing users
--    ("Office" and "Travel" on top of the original "Personal")
-- ============================================================================
insert into public.groups (user_id, name, emoji, color, kind)
select u.id, 'Office', '🏢', '#0ea5e9', 'persistent'
from auth.users u
where not exists (
  select 1 from public.groups g
  where g.user_id = u.id and g.name = 'Office'
);

insert into public.groups (user_id, name, emoji, color, kind)
select u.id, 'Travel', '✈️', '#06b6d4', 'persistent'
from auth.users u
where not exists (
  select 1 from public.groups g
  where g.user_id = u.id and g.name = 'Travel'
);

-- ============================================================================
-- 4. Replace handle_new_user so new signups get all three default groups
--    AND descriptions on every seeded category.
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
  -- default groups
  insert into public.groups (user_id, name, emoji, color, kind)
  values (new.id, 'Personal', '🏠', '#6366f1', 'persistent')
  returning id into personal_group_id;

  insert into public.groups (user_id, name, emoji, color, kind)
  values
    (new.id, 'Office', '🏢', '#0ea5e9', 'persistent'),
    (new.id, 'Travel', '✈️', '#06b6d4', 'persistent');

  -- profile
  insert into public.profiles (id, default_group_id)
  values (new.id, personal_group_id);

  -- system categories (with descriptions)
  insert into public.categories (user_id, name, type, emoji, color, is_system, description)
  values
    (new.id, 'Food',          'expense',    '🍽️', '#ef4444', true, 'Daily meals — rice, dal, roti. e.g., "rice 400".'),
    (new.id, 'Groceries',     'expense',    '🛒', '#f97316', true, 'Kitchen shopping — vegetables, milk, staples. e.g., "groceries 2500".'),
    (new.id, 'Rent',          'expense',    '🏠', '#a855f7', true, 'Monthly house or flat rent. e.g., "rent 20000".'),
    (new.id, 'Utilities',     'expense',    '💡', '#eab308', true, 'Electricity, water, gas, internet bills. e.g., "electricity 1500".'),
    (new.id, 'Transport',     'expense',    '🚗', '#3b82f6', true, 'Uber, Ola, metro, bus, auto. e.g., "uber 250".'),
    (new.id, 'Fuel',          'expense',    '⛽', '#64748b', true, 'Petrol, diesel, CNG. e.g., "petrol 1500".'),
    (new.id, 'Eating Out',    'expense',    '🍔', '#f43f5e', true, 'Restaurants, cafés, Zomato, Swiggy. e.g., "zomato 450".'),
    (new.id, 'Shopping',      'expense',    '🛍️', '#ec4899', true, 'Clothes, gadgets, general retail. e.g., "amazon 1200".'),
    (new.id, 'Health',        'expense',    '🩺', '#10b981', true, 'Doctor visits, medicine, hospital. e.g., "medicine 300".'),
    (new.id, 'Entertainment', 'expense',    '🎬', '#8b5cf6', true, 'Movies, streaming, concerts. e.g., "netflix 649".'),
    (new.id, 'Education',     'expense',    '📚', '#0ea5e9', true, 'Courses, books, exam fees. e.g., "udemy 500".'),
    (new.id, 'Subscriptions', 'expense',    '📺', '#7c3aed', true, 'Recurring apps & services. e.g., "spotify 119".'),
    (new.id, 'Travel',        'expense',    '✈️', '#06b6d4', true, 'Flights, hotels, holiday trips. e.g., "flight 8500".'),
    (new.id, 'Gifts',         'expense',    '🎁', '#f472b6', true, 'Presents for people. e.g., "birthday gift 1500".'),
    (new.id, 'Salary',        'income',     '💼', '#22c55e', true, 'Monthly paycheck from employer. e.g., "salary 95000".'),
    (new.id, 'Freelance',     'income',     '🧑‍💻', '#14b8a6', true, 'Client income, invoice payments. e.g., "invoice 25000".'),
    (new.id, 'Refund',        'income',     '↩️',  '#84cc16', true, 'Money returned to you. e.g., "refund 999".'),
    (new.id, 'Interest',      'income',     '🏦', '#65a30d', true, 'Savings or FD interest earned. e.g., "interest 1200".'),
    (new.id, 'SIP',           'investment', '📈', '#059669', true, 'Systematic Investment Plan into mutual funds. e.g., "SIP 10000".'),
    (new.id, 'Stocks',        'investment', '📊', '#0d9488', true, 'Buying equity / shares. e.g., "stocks 5000".'),
    (new.id, 'Mutual Fund',   'investment', '📉', '#0891b2', true, 'One-time mutual fund investment. e.g., "MF 50000".'),
    (new.id, 'FD',            'investment', '🏦', '#475569', true, 'Fixed Deposit with a bank. e.g., "FD 100000".'),
    (new.id, 'Crypto',        'investment', '🪙', '#f59e0b', true, 'Bitcoin, Ethereum, etc. e.g., "bitcoin 5000".'),
    (new.id, 'Lent',          'lending',    '🤝', '#6366f1', true, 'Money you gave to someone to pay back. e.g., "lent Ravi 2000".'),
    (new.id, 'Borrowed',      'lending',    '📥', '#e11d48', true, 'Money you took from someone. e.g., "borrowed 500 from Aarav".'),
    (new.id, 'Transfer',      'transfer',   '🔁', '#94a3b8', true, 'Money moving between your own accounts. e.g., "bank to wallet 1000".');

  return new;
end;
$$;
