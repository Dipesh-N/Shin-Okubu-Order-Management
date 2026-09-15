-- ============================================================================
--  Okubu Momo — 07: Let admins remove mistakes
--
--  A typo item or a table added by accident should be removable. Anything
--  that has actually been used must not be, or past tickets and receipts
--  would lose the thing they point at.
--
--  The existing foreign keys already draw that line: order_items.menu_item_id
--  and orders.table_id have no ON DELETE rule, so Postgres refuses to delete
--  a row that is still referenced. These policies simply open the door for
--  admins; the database keeps enforcing the rule.
--
--  Sold-out stays a separate idea: is_available = false hides an item from
--  waiters while keeping every past order intact. That is still the right
--  tool for a dish you have run out of.
-- ============================================================================

drop policy if exists menu_items_admin_delete on public.menu_items;
create policy menu_items_admin_delete on public.menu_items
  for delete to authenticated using (public.is_admin());

drop policy if exists tables_admin_delete on public.tables;
create policy tables_admin_delete on public.tables
  for delete to authenticated using (public.is_admin());

grant delete on public.menu_items to authenticated;
grant delete on public.tables     to authenticated;
