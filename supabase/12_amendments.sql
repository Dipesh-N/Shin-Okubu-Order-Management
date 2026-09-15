-- ============================================================================
--  Okubu Momo — 12: Correcting a line after it has been sent
--
--  A waiter taps the wrong dish or the wrong number and only notices once the
--  ticket is on its way. Overwriting the line would hide the mistake from the
--  kitchen, who may already be cooking the old quantity.
--
--  So a correction never edits in place. The original line is VOIDED and kept,
--  and a replacement line is inserted next to it. Every screen then shows the
--  mistake struck through with the correction beside it, and the kitchen can
--  see at a glance that something changed.
--
--  Only live (non-voided) lines count towards the bill and the kitchen.
-- ============================================================================

alter table public.order_items
  add column if not exists voided_at   timestamptz,
  add column if not exists replaced_by uuid references public.order_items (id);

-- Almost every read wants live lines only.
create index if not exists order_items_live_idx
  on public.order_items (order_id) where voided_at is null;

-- ---------------------------------------------------------------------------
--  amend_order_item(line, dish, qty) -> the replacement line (null if removed)
--
--  p_qty <= 0 removes the line outright, leaving it struck through.
--  p_menu_item_id null (or unchanged) means "same dish, different quantity".
-- ---------------------------------------------------------------------------
create or replace function public.amend_order_item(
  p_item_id      uuid,
  p_menu_item_id uuid,
  p_qty          integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_order_id   uuid;
  v_paid       boolean;
  v_voided     timestamptz;
  v_menu_id    uuid;
  v_name       text;
  v_price      integer;
  v_to_kitchen boolean;
  v_new_id     uuid;
begin
  if v_uid is null then
    raise exception 'You are signed out. Please log in again.';
  end if;

  select oi.order_id, oi.voided_at, oi.menu_item_id, oi.item_name,
         oi.unit_price, oi.to_kitchen, o.payment_id is not null
    into v_order_id, v_voided, v_menu_id, v_name, v_price, v_to_kitchen, v_paid
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_item_id;

  if v_order_id is null then
    raise exception 'That line is no longer on this order.';
  end if;

  if v_voided is not null then
    raise exception 'That line has already been changed.';
  end if;

  -- Changing a settled bill would mean giving change back or charging more,
  -- which this app deliberately does not do.
  if v_paid then
    raise exception 'This order has already been paid for, so it cannot be changed.';
  end if;

  if p_qty is not null and p_qty > 0 then
    if p_menu_item_id is not null and p_menu_item_id <> v_menu_id then
      -- A different dish: take today's price and today's kitchen routing.
      select m.name, m.price, coalesce(c.needs_kitchen, true)
        into v_name, v_price, v_to_kitchen
      from public.menu_items m
      left join public.menu_categories c on c.name = m.category
      where m.id = p_menu_item_id and m.is_available;

      if v_name is null then
        raise exception 'That item is not available.';
      end if;
      v_menu_id := p_menu_item_id;
    end if;
    -- Same dish: keep the price the customer was already quoted, even if the
    -- menu price has changed since the order was taken.

    insert into public.order_items
      (order_id, menu_item_id, item_name, unit_price, qty, to_kitchen)
    values
      (v_order_id, v_menu_id, v_name, v_price, p_qty, v_to_kitchen)
    returning id into v_new_id;
  end if;

  update public.order_items
  set voided_at = now(), replaced_by = v_new_id
  where id = p_item_id;

  -- If the correction leaves nothing for the kitchen (everything removed, or
  -- swapped to drinks), the ticket has nothing left to wait for.
  if not exists (
    select 1 from public.order_items
    where order_id = v_order_id and to_kitchen and voided_at is null
  ) then
    update public.orders
    set status = 'COMPLETED', completed_at = coalesce(completed_at, now())
    where id = v_order_id and status <> 'COMPLETED';
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.amend_order_item(uuid, uuid, integer) from public, anon;
grant execute on function public.amend_order_item(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
--  The bill must never include a voided line.
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
  where oi.order_id = any (v_order_ids)
    and oi.voided_at is null;          -- corrections must not be charged for

  insert into public.payments (table_id, total, method, paid_by)
  values (p_table_id, v_total, p_method, v_uid)
  returning id into v_payment_id;

  -- Money only. Cooking status is the kitchen's business.
  update public.orders
  set payment_id = v_payment_id
  where id = any (v_order_ids);

  return query select v_payment_id, v_total;
end;
$$;

revoke all on function public.settle_table(uuid, text) from public, anon;
grant execute on function public.settle_table(uuid, text) to authenticated;
