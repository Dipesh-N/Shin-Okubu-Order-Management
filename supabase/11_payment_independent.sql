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
