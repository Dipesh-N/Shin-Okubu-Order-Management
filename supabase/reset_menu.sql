-- ============================================================================
--  Okubu Momo — RESET (destructive, run once)
--
--  Clears the seeded test data so the real menu can be entered.
--
--  DELETES : every order, order line, payment, menu item and category
--  KEEPS   : tables 1-8, your login accounts, and all schema/policies
--
--  Orders are deleted first because old receipts point at menu items; the
--  database would otherwise refuse to remove a dish that had been ordered.
--
--  There is no undo. Only run this while the data is still test data.
-- ============================================================================

begin;

-- order_items references itself through replaced_by (the correction trail),
-- so clear those links before removing the rows.
update public.order_items set replaced_by = null;
delete from public.order_items;

-- orders points at payments, so orders must go first.
delete from public.orders;
delete from public.payments;

-- Now nothing references the menu.
delete from public.menu_items;
delete from public.menu_categories;

-- Ticket numbers start from 1 again for the real service.
alter table public.orders alter column ticket_no restart with 1;

commit;

-- Should print four zeros.
select
  (select count(*) from public.menu_items)      as menu_items,
  (select count(*) from public.menu_categories) as categories,
  (select count(*) from public.orders)          as orders,
  (select count(*) from public.payments)        as payments,
  (select count(*) from public.tables)          as tables_kept;
