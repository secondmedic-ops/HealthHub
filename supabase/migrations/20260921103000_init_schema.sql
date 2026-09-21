-- ============================================================================
-- SecondMedic HealthHub — initial Supabase schema
-- Generated from the actual frontend contract in src/types/api.ts and
-- src/api/endpoints.ts (tables, views and RLS behaviour the app already
-- expects). Paste this whole file into the Supabase SQL Editor and run it
-- once, top to bottom, on a fresh project.
-- ============================================================================

-- ---------- extensions ----------
create extension if not exists pgcrypto;

-- ---------- enums ----------
create type app_role as enum (
  'super_admin', 'accounts', 'manager', 'hub_lead',
  'staff', 'purchase_manager', 'field_staff'
);

create type snapshot_type as enum ('midday', 'closing');

-- ============================================================================
-- TABLES
-- ============================================================================

-- ---------- profiles (1 row per auth user) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  email       text,
  role        app_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever an admin creates an auth user.
-- Role defaults to 'staff' — promote via the Admin screen afterwards.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- hubs ----------
create table hubs (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null unique,
  name                        text not null,
  city                        text,
  opened_on                   date,
  monthly_revenue_target      numeric not null default 0,
  monthly_breakeven_target    numeric not null default 0,
  working_days_per_month      int not null default 26,
  is_active                   boolean not null default true
);

-- ---------- hub_staff (staff <-> hub mapping) ----------
create table hub_staff (
  staff_id    uuid not null references profiles(id) on delete cascade,
  hub_id      uuid not null references hubs(id) on delete cascade,
  is_primary  boolean not null default true,
  primary key (staff_id, hub_id)
);
create index idx_hub_staff_hub on hub_staff(hub_id);

-- ---------- manager_hubs (manager <-> hub mapping) ----------
create table manager_hubs (
  manager_id  uuid not null references profiles(id) on delete cascade,
  hub_id      uuid not null references hubs(id) on delete cascade,
  primary key (manager_id, hub_id)
);
create index idx_manager_hubs_hub on manager_hubs(hub_id);

-- ---------- daily_reports ----------
create table daily_reports (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid not null references hubs(id) on delete restrict,
  report_date   date not null,
  snapshot      snapshot_type not null,

  footfall            int not null default 0,
  total_bills         int not null default 0,
  new_customers       int not null default 0,

  cash_sale           numeric not null default 0,
  online_sale         numeric not null default 0,
  pathology_sale      numeric not null default 0,
  radiology_sale      numeric not null default 0,
  homecare_sale       numeric not null default 0,
  optical_sale        numeric not null default 0,
  opd_revenue         numeric not null default 0,

  opd_count               int not null default 0,
  doctor_visits           int not null default 0,
  abha_cards              int not null default 0,
  membership_cards        int not null default 0,
  home_deliveries         int not null default 0,
  reminder_calls          int not null default 0,
  reminder_conversions    int not null default 0,
  leaflets_distributed    int not null default 0,

  closing_stock_value   numeric,          -- closing only
  variance_reason       text,             -- closing only

  expected_closing_sale numeric,          -- midday only
  gap_action_plan       text,             -- midday only
  camp_plan_date        date,             -- midday only

  -- generated columns — never sent by the client, computed here
  pharmacy_sale           numeric generated always as (cash_sale + online_sale) stored,
  total_revenue           numeric generated always as (
                            cash_sale + online_sale + pathology_sale + radiology_sale +
                            homecare_sale + optical_sale + opd_revenue
                          ) stored,
  revenue_per_transaction numeric generated always as (
                            case when total_bills > 0 then
                              (cash_sale + online_sale + pathology_sale + radiology_sale +
                               homecare_sale + optical_sale + opd_revenue) / total_bills
                            else null end
                          ) stored,

  submitted_by  uuid references profiles(id),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint uq_daily_reports unique (hub_id, report_date, snapshot),
  constraint chk_not_future check (report_date <= current_date),
  constraint chk_midday_fields check (
    snapshot = 'midday' or (expected_closing_sale is null and gap_action_plan is null and camp_plan_date is null)
  ),
  constraint chk_closing_fields check (
    snapshot = 'closing' or (closing_stock_value is null and variance_reason is null)
  )
);
create index idx_daily_reports_hub_date on daily_reports(hub_id, report_date);

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_daily_reports_updated_at
  before update on daily_reports
  for each row execute function set_updated_at();

-- ---------- monthly_costs (accounts-only cost entry) ----------
create table monthly_costs (
  hub_id        uuid not null references hubs(id) on delete cascade,
  period_month  date not null,          -- always the 1st of the month, YYYY-MM-01
  direct_cost   numeric not null default 0,
  indirect_cost numeric not null default 0,
  entered_by    uuid references profiles(id),
  updated_at    timestamptz not null default now(),
  primary key (hub_id, period_month)
);

create trigger trg_monthly_costs_updated_at
  before update on monthly_costs
  for each row execute function set_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS (security definer — avoids RLS self-recursion on profiles)
-- ============================================================================

create function my_role() returns app_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create function my_hub_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select hub_id from hub_staff where staff_id = auth.uid()
  union
  select hub_id from manager_hubs where manager_id = auth.uid();
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table profiles enable row level security;
alter table hubs enable row level security;
alter table hub_staff enable row level security;
alter table manager_hubs enable row level security;
alter table daily_reports enable row level security;
alter table monthly_costs enable row level security;

-- profiles: see your own row, or every row if super_admin
create policy profiles_select on profiles for select
  using (id = auth.uid() or my_role() = 'super_admin');
create policy profiles_admin_write on profiles for update
  using (my_role() = 'super_admin');
create policy profiles_admin_insert on profiles for insert
  with check (my_role() = 'super_admin');

-- hubs: org-wide roles see everything, everyone else only their mapped hubs
create policy hubs_select on hubs for select
  using (
    my_role() in ('super_admin', 'accounts')
    or id in (select my_hub_ids())
  );
create policy hubs_admin_write on hubs for update
  using (my_role() = 'super_admin');
create policy hubs_admin_insert on hubs for insert
  with check (my_role() = 'super_admin');

-- hub_staff / manager_hubs: admin manages, people can see their own mapping
create policy hub_staff_select on hub_staff for select
  using (my_role() = 'super_admin' or staff_id = auth.uid());
create policy hub_staff_admin_write on hub_staff for all
  using (my_role() = 'super_admin') with check (my_role() = 'super_admin');

create policy manager_hubs_select on manager_hubs for select
  using (my_role() = 'super_admin' or manager_id = auth.uid());
create policy manager_hubs_admin_write on manager_hubs for all
  using (my_role() = 'super_admin') with check (my_role() = 'super_admin');

-- daily_reports: read your hubs (or all, for org-wide roles); write only your
-- own hub, only today/yesterday, only if you hold a reporting role.
-- super_admin is exempt from the date window (can backfill/correct).
create policy daily_reports_select on daily_reports for select
  using (
    my_role() in ('super_admin', 'accounts')
    or hub_id in (select my_hub_ids())
  );

create policy daily_reports_write on daily_reports for insert
  with check (
    my_role() = 'super_admin'
    or (
      my_role() in ('staff', 'hub_lead', 'manager')
      and hub_id in (select my_hub_ids())
      and report_date >= current_date - 1
      and report_date <= current_date
    )
  );

create policy daily_reports_update on daily_reports for update
  using (
    my_role() = 'super_admin'
    or (
      my_role() in ('staff', 'hub_lead', 'manager')
      and hub_id in (select my_hub_ids())
      and report_date >= current_date - 1
      and report_date <= current_date
    )
  );

-- monthly_costs: accounts + super_admin only, both to read and write
create policy monthly_costs_select on monthly_costs for select
  using (my_role() in ('accounts', 'super_admin'));
create policy monthly_costs_write on monthly_costs for all
  using (my_role() in ('accounts', 'super_admin'))
  with check (my_role() in ('accounts', 'super_admin'));

-- ============================================================================
-- VIEWS  (security_invoker so the *caller's* RLS applies, not the view owner's)
-- ============================================================================

create view v_daily_performance
  with (security_invoker = true) as
select
  dr.id,
  dr.hub_id,
  h.code as hub_code,
  h.name as hub_name,
  dr.report_date,
  dr.snapshot,
  dr.total_revenue,
  case when h.working_days_per_month > 0
       then h.monthly_revenue_target / h.working_days_per_month
       else 0 end as daily_target,
  dr.total_revenue - case when h.working_days_per_month > 0
                           then h.monthly_revenue_target / h.working_days_per_month
                           else 0 end as variance,
  case when h.monthly_revenue_target > 0 and h.working_days_per_month > 0
       then round(100 * dr.total_revenue /
            (h.monthly_revenue_target / h.working_days_per_month), 1)
       else null end as achievement_pct,
  dr.footfall,
  dr.total_bills,
  dr.revenue_per_transaction,
  dr.pharmacy_sale,
  dr.pathology_sale,
  dr.radiology_sale,
  dr.homecare_sale,
  dr.optical_sale,
  dr.opd_revenue,
  dr.closing_stock_value,
  dr.variance_reason
from daily_reports dr
join hubs h on h.id = dr.hub_id
where dr.snapshot = 'closing';

create view v_mtd_performance
  with (security_invoker = true) as
select
  dr.hub_id,
  h.code as hub_code,
  h.name as hub_name,
  date_trunc('month', dr.report_date)::date as period_month,
  sum(dr.pharmacy_sale)   as pharmacy_mtd,
  sum(dr.pathology_sale)  as pathology_mtd,
  sum(dr.radiology_sale)  as radiology_mtd,
  sum(dr.homecare_sale)   as homecare_mtd,
  sum(dr.optical_sale)    as optical_mtd,
  sum(dr.opd_revenue)     as opd_mtd,
  sum(dr.total_revenue)   as total_mtd,
  count(*)                as days_reported,
  h.monthly_revenue_target,
  h.monthly_revenue_target - sum(dr.total_revenue) as gap_to_target
from daily_reports dr
join hubs h on h.id = dr.hub_id
where dr.snapshot = 'closing'
group by dr.hub_id, h.code, h.name, date_trunc('month', dr.report_date), h.monthly_revenue_target;

create view v_hub_pnl
  with (security_invoker = true) as
select
  m.hub_id,
  m.hub_code,
  m.hub_name,
  m.period_month,
  m.total_mtd as actual_revenue,
  coalesce(mc.direct_cost, 0) as direct_cost,
  m.total_mtd - coalesce(mc.direct_cost, 0) as gross_profit,
  coalesce(mc.direct_cost, 0) + coalesce(mc.indirect_cost, 0) as total_cost,
  m.total_mtd - (coalesce(mc.direct_cost, 0) + coalesce(mc.indirect_cost, 0)) as net_profit
from v_mtd_performance m
left join monthly_costs mc
  on mc.hub_id = m.hub_id and mc.period_month = m.period_month;

-- ============================================================================
-- NEXT STEPS (do these in the Supabase dashboard, not in this file)
-- 1. Auth → Users → Add user → create your first login (email + password).
-- 2. SQL Editor → run:
--      update profiles set role = 'super_admin' where email = 'you@secondmedic.com';
-- 3. Insert your real hubs:
--      insert into hubs (code, name, city, monthly_revenue_target,
--                         monthly_breakeven_target, working_days_per_month)
--      values ('HUB01', 'Satna', 'Satna', 500000, 350000, 26);
-- 4. Map staff/managers to hubs via hub_staff / manager_hubs.
-- ============================================================================
