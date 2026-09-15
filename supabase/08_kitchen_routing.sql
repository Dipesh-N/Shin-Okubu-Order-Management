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
