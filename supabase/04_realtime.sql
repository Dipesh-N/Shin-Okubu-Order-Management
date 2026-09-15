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
