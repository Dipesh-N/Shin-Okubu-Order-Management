-- ============================================================
--  Okubu Momo — complete setup, generated from 01..05.
--  Do not edit: change the numbered files and run build-run-all.sh.
--  Paste this whole file into the Supabase SQL Editor and Run.
-- ============================================================



-- ============================================================================
--  Okubu Momo — 01: Tables
--  Run this first in the Supabase SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  profiles — one row per Supabase Auth user. The role decides everything.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- Every new Auth user automatically gets a profile, defaulting to staff.
-- Promote someone to admin with:
--   update public.profiles set role = 'admin' where id = '<user-uuid>';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
--  menu_items — never deleted, only switched unavailable (= "sold out").
-- ---------------------------------------------------------------------------
create table if not exists public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  name         text    not null,
  price        integer not null check (price >= 0),  -- whole yen
  category     text    not null default 'Food',
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists menu_items_browse_idx
  on public.menu_items (category, sort_order, name);

-- ---------------------------------------------------------------------------
--  tables — just the number given to customers.
-- ---------------------------------------------------------------------------
create table if not exists public.tables (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  payments — one row per settled bill (which may cover several tickets).
--  `total` is always computed by settle_table(), never sent by the client.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id       uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id),
  total    integer not null check (total >= 0),
  method   text    not null check (method in ('cash', 'card', 'other')),
  paid_by  uuid    references public.profiles (id),
  paid_at  timestamptz not null default now()
);

create index if not exists payments_paid_at_idx on public.payments (paid_at desc);

-- ---------------------------------------------------------------------------
--  orders — ONE KITCHEN TICKET. Pressing "Send to kitchen" creates one.
--  A second round for the same table is simply another ticket, which keeps
--  the status field meaningful and lets the kitchen see exactly what is new.
--
--  payment_id IS NULL  ⇒  unpaid  ⇒  the table counts as OCCUPIED.
--  Table state is derived from this, never stored, so it cannot go stale.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  ticket_no    bigint generated always as identity,   -- short number for the kitchen
  table_id     uuid not null references public.tables (id),
  status       text not null default 'NEW' check (status in ('NEW', 'COOKING', 'COMPLETED')),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  payment_id   uuid references public.payments (id)
);

-- Hall View: "which tickets are still on the bill for this table?"
create index if not exists orders_unpaid_idx
  on public.orders (table_id) where payment_id is null;

-- Kitchen View: the active queue, oldest first.
create index if not exists orders_kitchen_idx
  on public.orders (created_at) where status <> 'COMPLETED';

create index if not exists orders_payment_idx on public.orders (payment_id);

-- ---------------------------------------------------------------------------
--  order_items — name and price are SNAPSHOTS.
--  Changing tomorrow's price must not rewrite yesterday's receipts.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid    not null references public.orders (id) on delete cascade,
  menu_item_id uuid    references public.menu_items (id),
  item_name    text    not null,
  unit_price   integer not null check (unit_price >= 0),
  qty          integer not null check (qty > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);


-- ============================================================================
--  Okubu Momo — 02: Row Level Security
--
--  The browser only ever holds the anon key, so these policies are the real
--  security boundary. The service_role key is never used by this app.
-- ============================================================================

-- Role lookup used by the policies below.
-- SECURITY DEFINER matters: without it, a policy on `profiles` that itself
-- reads `profiles` recurses infinitely. search_path is pinned to '' so the
-- elevated function cannot be tricked into resolving a different schema.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles    enable row level security;
alter table public.menu_items  enable row level security;
alter table public.tables      enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.payments    enable row level security;

-- ---------------------------------------------------------------------------
--  profiles — you see yourself; admins see everyone. Nobody self-promotes.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
--  menu_items / tables — everyone reads, only admin writes.
--  No delete policy anywhere: menu history must stay intact.
-- ---------------------------------------------------------------------------
drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items
  for select to authenticated using (true);

drop policy if exists menu_items_admin_insert on public.menu_items;
create policy menu_items_admin_insert on public.menu_items
  for insert to authenticated with check (public.is_admin());

drop policy if exists menu_items_admin_update on public.menu_items;
create policy menu_items_admin_update on public.menu_items
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists tables_select on public.tables;
create policy tables_select on public.tables
  for select to authenticated using (true);

drop policy if exists tables_admin_insert on public.tables;
create policy tables_admin_insert on public.tables
  for insert to authenticated with check (public.is_admin());

drop policy if exists tables_admin_update on public.tables;
create policy tables_admin_update on public.tables
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
--  orders / order_items — shared operational data. Any signed-in staff member
--  reads them (Realtime delivers rows through these same policies).
--
--  Writes are intentionally narrow:
--    • INSERT goes through place_order()  — so prices cannot be forged.
--    • DELETE goes through cancel_order() — so only untouched tickets vanish.
--  Direct UPDATE is allowed only to move the status forward on an unpaid
--  ticket, which is what the Kitchen View buttons do.
-- ---------------------------------------------------------------------------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated using (true);

drop policy if exists orders_status_update on public.orders;
create policy orders_status_update on public.orders
  for update to authenticated
  using (payment_id is null)
  with check (payment_id is null);

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
--  payments — staff take payment (through settle_table) but cannot browse
--  the takings. Sales history is admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists payments_admin_select on public.payments;
create policy payments_admin_select on public.payments
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
--  Column-level grants.
--
--  RLS decides which ROWS are reachable, but it cannot restrict which COLUMNS
--  an UPDATE may touch. Without this, the orders_status_update policy above
--  would also let a waiter move a ticket to a different table or rewrite who
--  created it. Grants are the right tool for that, so narrow them here.
--
--  Supabase grants `authenticated` full DML on new public tables by default,
--  so each of these must be revoked first.
-- ---------------------------------------------------------------------------
revoke all on public.orders      from authenticated, anon;
revoke all on public.order_items from authenticated, anon;
revoke all on public.payments    from authenticated, anon;
revoke all on public.menu_items  from authenticated, anon;
revoke all on public.tables      from authenticated, anon;
revoke all on public.profiles    from authenticated, anon;

grant select on public.profiles   to authenticated;
grant update (full_name)          on public.profiles to authenticated;

grant select on public.menu_items to authenticated;
grant insert, update (name, price, category, is_available, sort_order)
  on public.menu_items to authenticated;   -- narrowed further by is_admin()

grant select on public.tables to authenticated;
grant insert, update (label, is_active)
  on public.tables to authenticated;       -- narrowed further by is_admin()

-- Kitchen buttons may move a ticket's status and nothing else.
grant select on public.orders to authenticated;
grant update (status, completed_at) on public.orders to authenticated;

grant select on public.order_items to authenticated;

-- No direct insert/update on payments: settle_table() owns that entirely.
grant select on public.payments to authenticated;


-- ============================================================================
--  Okubu Momo — 03: Operations
--
--  Three things must be atomic and must not trust the tablet:
--    place_order()   — the DB looks up prices, so they cannot be forged
--    settle_table()  — the DB sums the bill, so the total cannot be wrong
--    cancel_order()  — only a ticket the kitchen has not touched
--
--  All are SECURITY DEFINER, so each one re-checks the caller itself.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  place_order(table, items) -> new ticket id
--
--  p_items looks like: [{"menu_item_id": "uuid", "qty": 2}, ...]
--  Only the id and quantity are sent. Price and name are read from the menu
--  at this instant and snapshotted onto the line.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p_table_id uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_order_id uuid;
  v_inserted integer;
  v_requested integer;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'This order is empty.';
  end if;
  v_requested := jsonb_array_length(p_items);

  if not exists (
    select 1 from public.tables where id = p_table_id and is_active
  ) then
    raise exception 'That table is not in service.';
  end if;

  insert into public.orders (table_id, created_by)
  values (p_table_id, v_uid)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name, unit_price, qty)
  select
    v_order_id,
    m.id,
    m.name,                      -- snapshot
    m.price,                     -- snapshot
    (e ->> 'qty')::integer
  from jsonb_array_elements(p_items) as e
  join public.menu_items m on m.id = (e ->> 'menu_item_id')::uuid
  where m.is_available
    and (e ->> 'qty')::integer > 0;

  get diagnostics v_inserted = row_count;

  -- A row went missing: something was sold out or removed while the waiter was
  -- tapping. Abort the whole ticket rather than silently serving a short order.
  if v_inserted <> v_requested then
    raise exception 'Something on this order just became unavailable. Please check the menu and send it again.';
  end if;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
--  settle_table(table, method) -> the payment and its total
--
--  Covers every unpaid ticket on the table in one payment, which is what
--  "customer pays and leaves" actually means. Once stamped, the table has no
--  unpaid tickets left and so becomes AVAILABLE again automatically.
-- ---------------------------------------------------------------------------
create or replace function public.settle_table(p_table_id uuid, p_method text)
returns table (payment_id uuid, total integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_order_ids  uuid[];
  v_total      integer;
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  if p_method not in ('cash', 'card', 'other') then
    raise exception 'Unknown payment method: %', p_method;
  end if;

  -- Lock the unpaid tickets so two waiters settling the same table at the same
  -- moment cannot produce two payments. (FOR UPDATE cannot sit alongside an
  -- aggregate, hence the subquery.)
  select array_agg(id) into v_order_ids
  from (
    select o.id
    from public.orders o
    where o.table_id = p_table_id
      and o.payment_id is null
    order by o.id
    for update
  ) locked;

  if v_order_ids is null then
    raise exception 'There is nothing to pay for on this table.';
  end if;

  select coalesce(sum(oi.unit_price * oi.qty), 0) into v_total
  from public.order_items oi
  where oi.order_id = any (v_order_ids);

  insert into public.payments (table_id, total, method, paid_by)
  values (p_table_id, v_total, p_method, v_uid)
  returning id into v_payment_id;

  update public.orders
  set payment_id = v_payment_id
  where id = any (v_order_ids);

  return query select v_payment_id, v_total;
end;
$$;

-- ---------------------------------------------------------------------------
--  cancel_order(ticket)
--
--  A mis-tapped ticket the kitchen has not started is deleted outright rather
--  than parked in a CANCELLED state: nothing was cooked and nothing is owed,
--  so it has no meaning in sales history and no screen needs to filter it.
--  This is why the status list stays at exactly three values.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if (select auth.uid()) is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  delete from public.orders
  where id = p_order_id
    and status = 'NEW'          -- kitchen has not started
    and payment_id is null;     -- and it is not already paid for

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Too late to cancel — the kitchen has already started this order.';
  end if;
end;
$$;

-- Only signed-in users may call these. `anon` gets nothing.
revoke all on function public.place_order(uuid, jsonb)   from public, anon;
revoke all on function public.settle_table(uuid, text)    from public, anon;
revoke all on function public.cancel_order(uuid)          from public, anon;
revoke all on function public.is_admin()                  from public, anon;

grant execute on function public.place_order(uuid, jsonb) to authenticated;
grant execute on function public.settle_table(uuid, text)  to authenticated;
grant execute on function public.cancel_order(uuid)        to authenticated;
grant execute on function public.is_admin()                to authenticated;


-- ============================================================================
--  Okubu Momo — 04: Realtime
--
--  Publishing these two tables is what makes the kitchen iPad update by
--  itself when a waiter sends an order, and the Hall View light up when the
--  kitchen marks food ready.
--
--  Realtime respects Row Level Security, so a client is only told about rows
--  its policies already allow it to read.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end
$$;


-- ============================================================================
--  Okubu Momo — 05: Starting data (optional)
--
--  Safe to re-run, and safe to edit later from the admin screens.
-- ============================================================================

insert into public.tables (label)
select v.label from (values
  ('1'), ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8')
) as v(label)
on conflict (label) do nothing;

insert into public.menu_items (name, price, category, sort_order)
select v.name, v.price, v.category, v.ord from (values
  ('Chicken Momo (Steamed)', 650, 'Momo',   1),
  ('Chicken Momo (Fried)',   700, 'Momo',   2),
  ('Buff Momo (Steamed)',    650, 'Momo',   3),
  ('Veg Momo (Steamed)',     600, 'Momo',   4),
  ('Cheese Momo',            750, 'Momo',   5),
  ('Jhol Momo',              800, 'Momo',   6),
  ('French Fries',           450, 'Sides',  1),
  ('Chicken Chowmein',       700, 'Sides',  2),
  ('Thukpa',                 750, 'Sides',  3),
  ('Coke',                   200, 'Drinks', 1),
  ('Iced Tea',               250, 'Drinks', 2),
  ('Green Tea',              180, 'Drinks', 3),
  ('Beer',                   500, 'Drinks', 4)
) as v(name, price, category, ord)
where not exists (
  select 1 from public.menu_items m where m.name = v.name
);


-- ============================================================================
--  Okubu Momo — 06: Menu categories
--
--  Categories used to be loose text on each item, which meant there was
--  nowhere to create one, no way to fix a typo across items, and the waiter's
--  tabs came out alphabetically (Drinks before Momo).
--
--  The name itself is the primary key and menu_items.category keeps pointing
--  at it by name, so no data migration is needed and nothing in the app has
--  to start juggling ids. ON UPDATE CASCADE means renaming a category here
--  renames it on every item automatically.
-- ============================================================================

create table if not exists public.menu_categories (
  name       text primary key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Adopt whatever categories the menu already uses, keeping today's
-- alphabetical order as the starting point.
insert into public.menu_categories (name, sort_order)
select c.category, (row_number() over (order by c.category))::int * 10
from (select distinct category from public.menu_items) c
on conflict (name) do nothing;

-- Link items to categories. Renames cascade; a category still in use cannot
-- be deleted out from under its items.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_items_category_fkey'
  ) then
    alter table public.menu_items
      add constraint menu_items_category_fkey
      foreign key (category) references public.menu_categories (name)
      on update cascade
      on delete restrict;
  end if;
end
$$;

alter table public.menu_categories enable row level security;

drop policy if exists menu_categories_select on public.menu_categories;
create policy menu_categories_select on public.menu_categories
  for select to authenticated using (true);

drop policy if exists menu_categories_admin_insert on public.menu_categories;
create policy menu_categories_admin_insert on public.menu_categories
  for insert to authenticated with check (public.is_admin());

drop policy if exists menu_categories_admin_update on public.menu_categories;
create policy menu_categories_admin_update on public.menu_categories
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists menu_categories_admin_delete on public.menu_categories;
create policy menu_categories_admin_delete on public.menu_categories
  for delete to authenticated using (public.is_admin());

revoke all on public.menu_categories from authenticated, anon;
grant select on public.menu_categories to authenticated;
grant insert, delete on public.menu_categories to authenticated;
grant update (name, sort_order) on public.menu_categories to authenticated;


-- ============================================================================
--  Okubu Momo — 07: Let admins remove mistakes
--
--  A typo item or a table added by accident should be removable. Anything
--  that has actually been used must not be, or past tickets and receipts
--  would lose the thing they point at.
--
--  The existing foreign keys already draw that line: order_items.menu_item_id
--  and orders.table_id have no ON DELETE rule, so Postgres refuses to delete
--  a row that is still referenced. These policies simply open the door for
--  admins; the database keeps enforcing the rule.
--
--  Sold-out stays a separate idea: is_available = false hides an item from
--  waiters while keeping every past order intact. That is still the right
--  tool for a dish you have run out of.
-- ============================================================================

drop policy if exists menu_items_admin_delete on public.menu_items;
create policy menu_items_admin_delete on public.menu_items
  for delete to authenticated using (public.is_admin());

drop policy if exists tables_admin_delete on public.tables;
create policy tables_admin_delete on public.tables
  for delete to authenticated using (public.is_admin());

grant delete on public.menu_items to authenticated;
grant delete on public.tables     to authenticated;


-- ============================================================================
--  Okubu Momo — 08: Which items actually go to the kitchen
--
--  Drinks are poured by the waiter, not cooked, so they should not appear on
--  the kitchen screen. This is a property of the category, not of each item,
--  so the owner sets it once per category.
--
--  The flag is snapshotted onto each order line at the moment the order is
--  taken, for the same reason name and price are: changing the setting later
--  must not rewrite what the kitchen was asked to make.
-- ============================================================================

alter table public.menu_categories
  add column if not exists needs_kitchen boolean not null default true;

alter table public.order_items
  add column if not exists to_kitchen boolean not null default true;

-- Drinks do not need cooking. Everything else keeps the safe default (true),
-- and the owner can change any of them under Admin -> Menu -> Categories.
update public.menu_categories
set needs_kitchen = false
where lower(name) in ('drinks', 'drink', 'beverages', 'beverage', 'cold drinks');

-- Bring existing order lines in line with their category.
update public.order_items oi
set to_kitchen = c.needs_kitchen
from public.menu_items m
join public.menu_categories c on c.name = m.category
where oi.menu_item_id = m.id
  and oi.to_kitchen is distinct from c.needs_kitchen;

-- The earlier column grant did not know about this column.
grant update (name, sort_order, needs_kitchen)
  on public.menu_categories to authenticated;

-- ---------------------------------------------------------------------------
--  place_order: stamp each line, and finish a ticket that has nothing to cook.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p_table_id uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_order_id  uuid;
  v_inserted  integer;
  v_requested integer;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'This order is empty.';
  end if;
  v_requested := jsonb_array_length(p_items);

  if not exists (
    select 1 from public.tables where id = p_table_id and is_active
  ) then
    raise exception 'That table is not in service.';
  end if;

  insert into public.orders (table_id, created_by)
  values (p_table_id, v_uid)
  returning id into v_order_id;

  insert into public.order_items
    (order_id, menu_item_id, item_name, unit_price, qty, to_kitchen)
  select
    v_order_id,
    m.id,
    m.name,                                 -- snapshot
    m.price,                                -- snapshot
    (e ->> 'qty')::integer,
    coalesce(c.needs_kitchen, true)         -- snapshot
  from jsonb_array_elements(p_items) as e
  join public.menu_items m on m.id = (e ->> 'menu_item_id')::uuid
  left join public.menu_categories c on c.name = m.category
  where m.is_available
    and (e ->> 'qty')::integer > 0;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_requested then
    raise exception 'Something on this order just became unavailable. Please check the menu and send it again.';
  end if;

  -- A drinks-only round has nothing for the kitchen to do. Leaving it NEW
  -- would strand it: no cook would ever see it, so no one would ever mark it
  -- done, and the waiter's table would stay red forever. It is complete the
  -- moment it is taken.
  if not exists (
    select 1 from public.order_items
    where order_id = v_order_id and to_kitchen
  ) then
    update public.orders
    set status = 'COMPLETED', completed_at = now()
    where id = v_order_id;
  end if;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
--  cancel_order: a ticket the kitchen never saw is still cancellable.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if (select auth.uid()) is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  delete from public.orders o
  where o.id = p_order_id
    and o.payment_id is null              -- not already paid for
    and (
      o.status = 'NEW'                    -- kitchen has not started, or
      or not exists (                     -- nothing was ever sent to them
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.to_kitchen
      )
    );

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Too late to cancel — the kitchen has already started this order.';
  end if;
end;
$$;

revoke all on function public.place_order(uuid, jsonb) from public, anon;
revoke all on function public.cancel_order(uuid)        from public, anon;
grant execute on function public.place_order(uuid, jsonb) to authenticated;
grant execute on function public.cancel_order(uuid)        to authenticated;


-- ============================================================================
--  Okubu Momo — 09: Paying a table closes its tickets
--
--  BUG THIS FIXES
--  settle_table stamped payment_id on every unpaid ticket, including any that
--  were still NEW or COOKING. Row Level Security then (correctly) refuses to
--  edit a paid order — so the kitchen's "Start cooking" button updated zero
--  rows. A zero-row UPDATE is not an error, so nothing was reported: the
--  button appeared dead and the ticket sat in the queue forever.
--
--  Paying is the end of the round, so settling now finishes those tickets too
--  and nothing is left in a state no one can move out of.
-- ============================================================================

create or replace function public.settle_table(p_table_id uuid, p_method text)
returns table (payment_id uuid, total integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_order_ids  uuid[];
  v_total      integer;
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  if p_method not in ('cash', 'card', 'other') then
    raise exception 'Unknown payment method: %', p_method;
  end if;

  -- Lock the unpaid tickets so two waiters settling the same table at the
  -- same moment cannot produce two payments. (FOR UPDATE cannot sit alongside
  -- an aggregate, hence the subquery.)
  select array_agg(id) into v_order_ids
  from (
    select o.id
    from public.orders o
    where o.table_id = p_table_id
      and o.payment_id is null
    order by o.id
    for update
  ) locked;

  if v_order_ids is null then
    raise exception 'There is nothing to pay for on this table.';
  end if;

  select coalesce(sum(oi.unit_price * oi.qty), 0) into v_total
  from public.order_items oi
  where oi.order_id = any (v_order_ids);

  insert into public.payments (table_id, total, method, paid_by)
  values (p_table_id, v_total, p_method, v_uid)
  returning id into v_payment_id;

  -- Close the tickets as well as charging for them. Without the status
  -- change, a ticket still NEW at payment time becomes uneditable and
  -- strands on the kitchen screen.
  update public.orders
  set payment_id   = v_payment_id,
      status       = 'COMPLETED',
      completed_at = coalesce(completed_at, now())
  where id = any (v_order_ids);

  return query select v_payment_id, v_total;
end;
$$;

revoke all on function public.settle_table(uuid, text) from public, anon;
grant execute on function public.settle_table(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
--  Heal tickets already stranded by the old behaviour.
-- ---------------------------------------------------------------------------
update public.orders
set status = 'COMPLETED', completed_at = coalesce(completed_at, now())
where payment_id is not null
  and status <> 'COMPLETED';


-- ============================================================================
--  Okubu Momo — 10: Takeout tickets
--
--  Takeout is a property of the TICKET, not of the table and not of each
--  item. A customer sitting at a table can order food to eat there and, later,
--  food to take home: that is two tickets on one table, and the kitchen plates
--  one and packs the other. Both stay on the same bill, so the customer pays
--  once at the end.
--
--  For a walk-in who never sits down, add a table called "Takeaway" under
--  Admin -> Tables and use it like any other table.
-- ============================================================================

alter table public.orders
  add column if not exists is_takeout boolean not null default false;

-- The kitchen wants packing jobs to stand out in the queue.
create index if not exists orders_takeout_idx
  on public.orders (is_takeout) where is_takeout;

-- ---------------------------------------------------------------------------
--  place_order gains the flag.
--
--  Replaced rather than overloaded: two functions differing only by an extra
--  argument would both remain callable and PostgREST would have to guess.
--  The default keeps a two-argument call working.
-- ---------------------------------------------------------------------------
drop function if exists public.place_order(uuid, jsonb);

create or replace function public.place_order(
  p_table_id   uuid,
  p_items      jsonb,
  p_is_takeout boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_order_id  uuid;
  v_inserted  integer;
  v_requested integer;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'This order is empty.';
  end if;
  v_requested := jsonb_array_length(p_items);

  if not exists (
    select 1 from public.tables where id = p_table_id and is_active
  ) then
    raise exception 'That table is not in service.';
  end if;

  insert into public.orders (table_id, created_by, is_takeout)
  values (p_table_id, v_uid, coalesce(p_is_takeout, false))
  returning id into v_order_id;

  insert into public.order_items
    (order_id, menu_item_id, item_name, unit_price, qty, to_kitchen)
  select
    v_order_id,
    m.id,
    m.name,                                 -- snapshot
    m.price,                                -- snapshot
    (e ->> 'qty')::integer,
    coalesce(c.needs_kitchen, true)         -- snapshot
  from jsonb_array_elements(p_items) as e
  join public.menu_items m on m.id = (e ->> 'menu_item_id')::uuid
  left join public.menu_categories c on c.name = m.category
  where m.is_available
    and (e ->> 'qty')::integer > 0;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_requested then
    raise exception 'Something on this order just became unavailable. Please check the menu and send it again.';
  end if;

  -- A drinks-only round has nothing for the kitchen to do, so it is complete
  -- the moment it is taken; leaving it NEW would strand it on a screen no one
  -- is looking at.
  if not exists (
    select 1 from public.order_items
    where order_id = v_order_id and to_kitchen
  ) then
    update public.orders
    set status = 'COMPLETED', completed_at = now()
    where id = v_order_id;
  end if;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, jsonb, boolean) from public, anon;
grant execute on function public.place_order(uuid, jsonb, boolean) to authenticated;


-- ============================================================================
--  Okubu Momo — 11: Paying and cooking are independent
--
--  WHAT WAS WRONG
--  Migration 09 treated payment as the end of a ticket: settling a table
--  forced its tickets to COMPLETED, and Row Level Security refused any edit
--  to a paid order. That assumed customers always pay after eating.
--
--  Takeout breaks that assumption. The customer pays at the counter first and
--  then waits for the food, so a paid ticket still has to be cooked — and the
--  kitchen still has to be able to press Start cooking and Complete on it.
--
--  A ticket now has two independent facts:
--      cooking:  NEW -> COOKING -> COMPLETED
--      money:    unpaid -> paid
--  Either can happen first. A ticket is finished when both are done.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Settling charges for tickets. It no longer cooks them.
-- ---------------------------------------------------------------------------
create or replace function public.settle_table(p_table_id uuid, p_method text)
returns table (payment_id uuid, total integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_order_ids  uuid[];
  v_total      integer;
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  if p_method not in ('cash', 'card', 'other') then
    raise exception 'Unknown payment method: %', p_method;
  end if;

  -- Lock the unpaid tickets so two waiters settling the same table at the
  -- same moment cannot produce two payments.
  select array_agg(id) into v_order_ids
  from (
    select o.id
    from public.orders o
    where o.table_id = p_table_id
      and o.payment_id is null
    order by o.id
    for update
  ) locked;

  if v_order_ids is null then
    raise exception 'There is nothing to pay for on this table.';
  end if;

  select coalesce(sum(oi.unit_price * oi.qty), 0) into v_total
  from public.order_items oi
  where oi.order_id = any (v_order_ids);

  insert into public.payments (table_id, total, method, paid_by)
  values (p_table_id, v_total, p_method, v_uid)
  returning id into v_payment_id;

  -- Only the money changes here. Status is the kitchen's business: a ticket
  -- paid up front must stay in their queue until they have actually cooked it.
  update public.orders
  set payment_id = v_payment_id
  where id = any (v_order_ids);

  return query select v_payment_id, v_total;
end;
$$;

revoke all on function public.settle_table(uuid, text) from public, anon;
grant execute on function public.settle_table(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
--  The kitchen can move a ticket's status whether or not it has been paid for.
--
--  This is the policy that made "Start cooking" silently do nothing on a paid
--  ticket. Column grants (status, completed_at only) still stop anyone
--  re-pointing a ticket at another table or unpicking a payment, so widening
--  the row check gives away nothing.
-- ---------------------------------------------------------------------------
drop policy if exists orders_status_update on public.orders;
create policy orders_status_update on public.orders
  for update to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
--  Cancelling still requires that no money has changed hands.
--  (Unchanged — refunds are not something this app does.)
-- ---------------------------------------------------------------------------
