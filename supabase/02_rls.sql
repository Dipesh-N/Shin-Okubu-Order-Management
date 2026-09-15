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
