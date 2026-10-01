-- Additive: existing records and identifiers are preserved. Scheduler activation
-- is deliberately separate; see docs/ROLLOUT.md before enabling it.
alter table public.transactions add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists location_enabled boolean not null default false;
alter table public.recurring_rules add column if not exists timezone text not null default 'Asia/Kolkata';
alter table public.recurring_rules add column if not exists scheduler_enabled boolean not null default false;
alter table public.recurring_rules add column if not exists scheduler_error text;
update public.recurring_rules r set timezone = p.timezone from public.profiles p where p.id = r.user_id;
update public.recurring_rules set day_of_period = extract(day from next_run_at at time zone timezone) where cadence = 'monthly' and day_of_period is null;

create table public.capture_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, payload jsonb not null, transaction_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(), primary key(user_id, request_id)
);
create table public.category_rules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 phrase text not null check(length(trim(phrase)) between 1 and 160),
 category_id uuid not null references public.categories(id) on delete cascade,
 created_at timestamptz not null default now(), unique(user_id, phrase)
);
create table public.recurring_occurrences (
 rule_id uuid not null references public.recurring_rules(id) on delete cascade,
 scheduled_at timestamptz not null, transaction_id uuid references public.transactions(id) on delete set null,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(rule_id, scheduled_at)
);
alter table public.capture_requests enable row level security;
alter table public.category_rules enable row level security;
alter table public.recurring_occurrences enable row level security;
create policy capture_owner on public.capture_requests for all using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy correction_owner on public.category_rules for all using(user_id = auth.uid()) with check(user_id = auth.uid() and exists(select 1 from public.categories where id = category_id and user_id = auth.uid()));
create policy occurrence_owner on public.recurring_occurrences for select using(user_id = auth.uid());
create index transactions_live_cursor on public.transactions(user_id, occurred_at desc, id desc) where deleted_at is null;

-- Enforce ownership of referenced objects even for direct REST clients.
create function public.validate_transaction_links() returns trigger language plpgsql set search_path = public as $$
begin
 if new.amount <= 0 and (TG_OP='INSERT' or new.amount is distinct from old.amount) then raise exception 'Amount must be positive'; end if;
 if new.category_id is not null and not exists(select 1 from categories where id = new.category_id and user_id = new.user_id and type = new.type) then raise exception 'Invalid category'; end if;
 if new.group_id is not null and not exists(select 1 from groups where id = new.group_id and user_id = new.user_id) then raise exception 'Invalid group'; end if;
 return new;
end $$;
create trigger validate_transaction_links before insert or update of amount, type, category_id, group_id on public.transactions for each row execute function public.validate_transaction_links();

create function public.save_transactions(p_request_id uuid, p_items jsonb) returns uuid[]
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid(); old capture_requests; item jsonb; tid uuid; ids uuid[] := '{}';
begin
 if uid is null then raise exception 'Not signed in'; end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 500 then raise exception 'Provide 1–500 transactions'; end if;
 -- Serialize retries for the same user/request before checking the payload.
 perform pg_advisory_xact_lock(hashtextextended(uid::text || p_request_id::text, 0));
 select * into old from capture_requests where user_id = uid and request_id = p_request_id;
 if found then
  if old.payload <> p_items then raise exception 'Request ID already used for different content'; end if;
  return old.transaction_ids;
 end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if (item->>'amount')::numeric <= 0 or (item->>'amount')::numeric <> round((item->>'amount')::numeric, 2) then raise exception 'Enter a positive amount with at most two decimal places'; end if;
  insert into transactions(user_id,amount,type,category_id,group_id,occurred_at,note,raw_input,source,latitude,longitude,place_label)
  values(uid,(item->>'amount')::numeric,(item->>'type')::transaction_type,nullif(item->>'category_id','')::uuid,nullif(item->>'group_id','')::uuid,
   (item->>'occurred_at')::timestamptz,nullif(item->>'note',''),item->>'raw_input',coalesce(item->>'source','manual')::transaction_source,
   (item->>'latitude')::double precision,(item->>'longitude')::double precision,item->>'place_label') returning id into tid;
  if item->>'type' = 'lending' then
   if coalesce(trim(item->'lending'->>'counterparty'),'') = '' then raise exception 'Who is the loan with?'; end if;
   insert into lending_details(transaction_id,counterparty,direction,settled,settled_at,due_date)
   values(tid,item->'lending'->>'counterparty',(item->'lending'->>'direction')::lending_direction,false,null,(item->'lending'->>'due_date')::date);
  end if;
  ids := array_append(ids,tid);
 end loop;
 insert into capture_requests(user_id,request_id,payload,transaction_ids) values(uid,p_request_id,p_items,ids);
 return ids;
end $$;

create function public.update_transaction(p_id uuid, p_patch jsonb, p_lending jsonb default null) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare t transactions; merged jsonb;
begin
 select * into t from transactions where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Transaction not found'; end if;
 merged := to_jsonb(t) || (p_patch - 'id' - 'user_id' - 'created_at');
 update transactions set amount=(merged->>'amount')::numeric,type=(merged->>'type')::transaction_type,
 category_id=(merged->>'category_id')::uuid,group_id=(merged->>'group_id')::uuid,
 occurred_at=(merged->>'occurred_at')::timestamptz,note=merged->>'note',deleted_at=(merged->>'deleted_at')::timestamptz
 where id=p_id returning * into t;
 if t.type <> 'lending' then delete from lending_details where transaction_id=p_id;
 elsif p_lending is not null then
  merged := coalesce((select to_jsonb(l) from lending_details l where transaction_id=p_id),'{}'::jsonb) || p_lending;
  if coalesce(trim(merged->>'counterparty'),'') = '' then raise exception 'Who is the loan with?'; end if;
  insert into lending_details(transaction_id,counterparty,direction,settled,settled_at,due_date)
  values(p_id,merged->>'counterparty',(merged->>'direction')::lending_direction,coalesce((merged->>'settled')::boolean,false),
   case when coalesce((merged->>'settled')::boolean,false) then coalesce((merged->>'settled_at')::timestamptz,now()) else null end,(merged->>'due_date')::date)
  on conflict(transaction_id) do update set counterparty=excluded.counterparty,direction=excluded.direction,settled=excluded.settled,settled_at=excluded.settled_at,due_date=excluded.due_date;
 elsif not exists(select 1 from lending_details where transaction_id=p_id) then raise exception 'Loan details required';
 end if;
 return to_jsonb(t);
end $$;

-- All list/report paths use the same filtering, under the caller's RLS policies.
create function public.filtered_transactions(p_filters jsonb default '{}') returns setof public.transactions
language sql stable security invoker set search_path = public as $$
 select t.* from transactions t
 where t.user_id=auth.uid() and t.deleted_at is null
 and (p_filters->>'id' is null or t.id=(p_filters->>'id')::uuid)
 and (coalesce(p_filters->>'type','all')='all' or t.type::text=p_filters->>'type')
 and (coalesce(p_filters->>'groupId','all')='all' or t.group_id=(p_filters->>'groupId')::uuid)
 and (coalesce(p_filters->>'categoryId','all')='all' or t.category_id=(p_filters->>'categoryId')::uuid)
 and (p_filters->>'from' is null or t.occurred_at >= (p_filters->>'from')::timestamptz)
 and (p_filters->>'to' is null or t.occurred_at <= (p_filters->>'to')::timestamptz)
 and (p_filters->>'ruleId' is null or exists(select 1 from recurring_occurrences o where o.transaction_id=t.id and o.rule_id=(p_filters->>'ruleId')::uuid))
 and (coalesce(p_filters->>'search','')='' or concat_ws(' ',t.note,t.raw_input,(select name from categories where id=t.category_id),(select counterparty from lending_details where transaction_id=t.id)) ilike '%' || replace(replace(replace(p_filters->>'search','\','\\'),'%','\%'),'_','\_') || '%');
$$;
create function public.transaction_page(p_filters jsonb default '{}', p_cursor jsonb default null, p_size int default 50) returns jsonb
language sql stable security invoker set search_path = public as $$
 with page as (
 select t.* from filtered_transactions(p_filters) t where p_cursor is null or p_cursor='null'::jsonb or (t.occurred_at,t.id)<((p_cursor->>'occurred_at')::timestamptz,(p_cursor->>'id')::uuid)
 order by t.occurred_at desc,t.id desc limit least(greatest(p_size,1),500)
 ) select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('category',(select to_jsonb(c) from categories c where c.id=p.category_id),'group',(select to_jsonb(g) from groups g where g.id=p.group_id),'lending_details',(select to_jsonb(l) from lending_details l where l.transaction_id=p.id)) order by occurred_at desc,id desc),'[]') from page p;
$$;
create function public.transaction_summary(p_filters jsonb default '{}') returns jsonb
language sql stable security invoker set search_path = public as $$
 with rows as (select * from filtered_transactions(p_filters)),
 types as (select type,sum(amount) amount,count(*) count from rows group by type),
 cats as (select category_id id,sum(amount) amount,count(*) count from rows where type='expense' group by category_id),
 grps as (select group_id id,sum(amount) amount,count(*) count from rows where type='expense' group by group_id),
 places as (select place_label name,sum(amount) amount,count(*) count from rows where type='expense' and place_label is not null group by place_label)
 select jsonb_build_object('count',(select count(*) from rows),
 'by_type',coalesce((select jsonb_object_agg(type,jsonb_build_object('amount',amount,'count',count)) from types),'{}'),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',coalesce((select name from categories where categories.id=cats.id),'Uncategorized'),'amount',amount,'count',count) order by amount desc) from cats),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',coalesce((select name from groups where groups.id=grps.id),'No group'),'amount',amount,'count',count) order by amount desc) from grps),'[]'),
 'locations',coalesce((select jsonb_agg(to_jsonb(places) order by amount desc) from places),'[]'),
 'lent',coalesce((select sum(r.amount) from rows r join lending_details l on l.transaction_id=r.id where l.direction='lent' and not l.settled),0),
 'borrowed',coalesce((select sum(r.amount) from rows r join lending_details l on l.transaction_id=r.id where l.direction='borrowed' and not l.settled),0),
 'revision',md5(coalesce((select string_agg(id::text || updated_at::text,',' order by id) from rows),'')));
$$;

-- Cron worker runs as its owner, never as a browser RPC. SKIP LOCKED and the
-- occurrence key make overlapping runs safe. Each rule gets its own rollback.
create function public.process_recurring(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public as $$
declare r recurring_rules; due timestamptz; local_due timestamp; next_month timestamp; tid uuid; added integer:=0; loops integer; before_rule integer;
begin
 for r in select * from recurring_rules where active and scheduler_enabled and next_run_at<=p_now for update skip locked loop
  begin
   before_rule:=added;
   due:=r.next_run_at; loops:=0;
   while due<=p_now and loops<100 loop
    if not exists(select 1 from recurring_occurrences where rule_id=r.id and scheduled_at=due) then
     insert into transactions(user_id,amount,type,category_id,group_id,occurred_at,note,source)
     values(r.user_id,(r.template->>'amount')::numeric,(r.template->>'type')::transaction_type,(r.template->>'category_id')::uuid,(r.template->>'group_id')::uuid,due,r.template->>'note','recurring') returning id into tid;
     if r.template->>'type'='lending' then
      if coalesce(trim(r.template->'lending'->>'counterparty'),'')='' then raise exception 'Loan details required'; end if;
      insert into lending_details(transaction_id,counterparty,direction,settled) values(tid,r.template->'lending'->>'counterparty',(r.template->'lending'->>'direction')::lending_direction,false);
     end if;
     insert into recurring_occurrences values(r.id,due,tid,r.user_id);
     added:=added+1;
    end if;
    local_due:=due at time zone r.timezone;
    if r.cadence='monthly' then
     next_month:=date_trunc('month',local_due)+interval '1 month';
     local_due:=next_month + (least(coalesce(r.day_of_period,extract(day from local_due)::int),extract(day from next_month+interval '1 month - 1 day')::int)-1)*interval '1 day' + local_due::time;
    else local_due:=local_due+case when r.cadence='daily' then interval '1 day' else interval '7 days' end;
    end if;
    due:=local_due at time zone r.timezone; loops:=loops+1;
   end loop;
   update recurring_rules set next_run_at=due,last_run_at=p_now,scheduler_error=null where id=r.id;
  exception when others then
   added:=before_rule;
   update recurring_rules set scheduler_error=SQLERRM where id=r.id;
  end;
 end loop;
 return added;
end $$;
revoke all on function public.process_recurring(timestamptz) from public;
-- Only authenticated users may call user-facing RPCs.
revoke all on function public.save_transactions(uuid,jsonb),public.update_transaction(uuid,jsonb,jsonb),public.filtered_transactions(jsonb),public.transaction_page(jsonb,jsonb,int),public.transaction_summary(jsonb) from public;
grant execute on function public.save_transactions(uuid,jsonb),public.update_transaction(uuid,jsonb,jsonb),public.filtered_transactions(jsonb),public.transaction_page(jsonb,jsonb,int),public.transaction_summary(jsonb) to authenticated;
create function public.set_transactions_deleted(p_ids uuid[],p_deleted boolean) returns void language sql security invoker set search_path=public as $$
 update transactions set deleted_at=case when p_deleted then now() else null end where user_id=auth.uid() and id=any(p_ids);
$$;
revoke all on function public.set_transactions_deleted(uuid[],boolean) from public;
grant execute on function public.set_transactions_deleted(uuid[],boolean) to authenticated;
-- Retired browser versions must not race the server scheduler. Users can still
-- edit/delete generated entries, but only the worker can insert recurring rows.
drop policy transactions_owner on public.transactions;
create policy transactions_select on public.transactions for select using(user_id=auth.uid());
create policy transactions_insert on public.transactions for insert with check(user_id=auth.uid() and source <> 'recurring');
create policy transactions_update on public.transactions for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy transactions_delete on public.transactions for delete using(user_id=auth.uid());
-- Budget totals are computed across the complete ledger in the account timezone.
create function public.budget_report() returns jsonb language sql stable security invoker set search_path=public as $$
 with windows as (
 select b.*, -n as period_offset,
  (date_trunc(case when b.period='weekly' then 'week' else 'month' end,now() at time zone p.timezone) - n*case when b.period='weekly' then interval '1 week' else interval '1 month' end) at time zone p.timezone as period_start,
  (date_trunc(case when b.period='weekly' then 'week' else 'month' end,now() at time zone p.timezone) + (1-n)*case when b.period='weekly' then interval '1 week' else interval '1 month' end) at time zone p.timezone as period_end
 from budgets b join profiles p on p.id=b.user_id cross join generate_series(0,5) n where b.user_id=auth.uid()
 ), totals as (
 select w.id,w.period_offset,w.period_start,w.period_end,coalesce(sum(t.amount),0) spent
 from windows w left join transactions t on t.user_id=auth.uid() and t.deleted_at is null and t.occurred_at>=w.period_start and t.occurred_at<w.period_end
 and case w.scope when 'overall' then t.type='expense' when 'type' then t.type::text=w.scope_id when 'category' then t.category_id::text=w.scope_id when 'group' then t.group_id::text=w.scope_id and t.type='expense' end
 group by w.id,w.period_offset,w.period_start,w.period_end
 ) select coalesce(jsonb_agg(to_jsonb(totals) order by id,period_offset desc),'[]') from totals;
$$;
revoke all on function public.budget_report() from public;
grant execute on function public.budget_report() to authenticated;
