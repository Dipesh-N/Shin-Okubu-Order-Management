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
