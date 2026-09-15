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
