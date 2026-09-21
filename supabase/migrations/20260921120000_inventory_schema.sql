-- ============================================================================
-- SecondMedic HealthHub — medicine inventory schema
-- Purchase Manager buys stock centrally; stock lands at a hub; Field Staff
-- issues/consumes it there. Matches the "Insufficient stock" error the
-- frontend's friendlyError() already anticipates (src/api/endpoints.ts).
-- Run this AFTER 20260921103000_init_schema.sql.
-- ============================================================================

create table medicines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sku         text unique,
  unit        text not null default 'unit',   -- strip, bottle, box, etc.
  unit_price  numeric not null default 0,
  is_active   boolean not null default true
);

-- current stock on hand, per hub
create table hub_stock (
  hub_id      uuid not null references hubs(id) on delete cascade,
  medicine_id uuid not null references medicines(id) on delete cascade,
  quantity    numeric not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (hub_id, medicine_id),
  constraint chk_stock_nonneg check (quantity >= 0)
);

-- purchase manager buys stock in; lands in hub_stock via trigger below
create table stock_purchases (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid not null references hubs(id),
  medicine_id   uuid not null references medicines(id),
  quantity      numeric not null check (quantity > 0),
  unit_price    numeric not null default 0,
  total_cost    numeric generated always as (quantity * unit_price) stored,
  invoice_ref   text,
  purchased_by  uuid references profiles(id),
  purchase_date date not null default current_date,
  created_at    timestamptz not null default now()
);

-- field staff issues/consumes stock at a hub; drawn down from hub_stock via trigger below
create table stock_issues (
  id          uuid primary key default gen_random_uuid(),
  hub_id      uuid not null references hubs(id),
  medicine_id uuid not null references medicines(id),
  quantity    numeric not null check (quantity > 0),
  issued_by   uuid references profiles(id),
  issue_date  date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------- stock movement triggers (security definer: they write to
-- hub_stock on the user's behalf, bypassing hub_stock's own RLS, which stays
-- select-only for everyone below) ----------

create function apply_stock_purchase() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into hub_stock (hub_id, medicine_id, quantity, updated_at)
  values (new.hub_id, new.medicine_id, new.quantity, now())
  on conflict (hub_id, medicine_id)
  do update set quantity = hub_stock.quantity + new.quantity, updated_at = now();
  return new;
end;
$$;

create trigger trg_apply_stock_purchase
  after insert on stock_purchases
  for each row execute function apply_stock_purchase();

create function apply_stock_issue() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  current_qty numeric;
begin
  select quantity into current_qty from hub_stock
    where hub_id = new.hub_id and medicine_id = new.medicine_id
    for update;

  if current_qty is null or current_qty < new.quantity then
    raise exception 'Insufficient stock for this medicine at this hub'
      using errcode = '23514';
  end if;

  update hub_stock set quantity = quantity - new.quantity, updated_at = now()
    where hub_id = new.hub_id and medicine_id = new.medicine_id;
  return new;
end;
$$;

create trigger trg_apply_stock_issue
  before insert on stock_issues
  for each row execute function apply_stock_issue();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table medicines enable row level security;
alter table hub_stock enable row level security;
alter table stock_purchases enable row level security;
alter table stock_issues enable row level security;

-- medicines: any signed-in reporting/inventory role can read; only purchase
-- managers and super_admin manage the catalogue
create policy medicines_select on medicines for select
  using (my_role() in ('super_admin', 'purchase_manager', 'field_staff', 'manager', 'accounts'));
create policy medicines_write on medicines for all
  using (my_role() in ('super_admin', 'purchase_manager'))
  with check (my_role() in ('super_admin', 'purchase_manager'));

-- hub_stock: purchase_manager/super_admin see every hub (central purchasing);
-- everyone else only their mapped hubs. No direct writes — only the triggers
-- above (running security definer) change quantities.
create policy hub_stock_select on hub_stock for select
  using (
    my_role() in ('super_admin', 'purchase_manager')
    or hub_id in (select my_hub_ids())
  );

-- stock_purchases: purchase_manager/super_admin only, any hub
create policy stock_purchases_select on stock_purchases for select
  using (
    my_role() in ('super_admin', 'purchase_manager')
    or hub_id in (select my_hub_ids())
  );
create policy stock_purchases_insert on stock_purchases for insert
  with check (my_role() in ('super_admin', 'purchase_manager'));

-- stock_issues: field_staff/purchase_manager/super_admin, restricted to the
-- issuer's own mapped hub (super_admin/purchase_manager exempt)
create policy stock_issues_select on stock_issues for select
  using (
    my_role() in ('super_admin', 'purchase_manager')
    or hub_id in (select my_hub_ids())
  );
create policy stock_issues_insert on stock_issues for insert
  with check (
    my_role() in ('super_admin', 'purchase_manager')
    or (my_role() = 'field_staff' and hub_id in (select my_hub_ids()))
  );
