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
