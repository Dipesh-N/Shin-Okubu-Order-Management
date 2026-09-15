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
