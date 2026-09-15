-- ============================================================================
--  Okubu Momo — 06: Menu categories
--
--  Categories used to be loose text on each item, which meant there was
--  nowhere to create one, no way to fix a typo across items, and the waiter's
--  tabs came out alphabetically (Drinks before Momo).
--
--  The name itself is the primary key and menu_items.category keeps pointing
--  at it by name, so no data migration is needed and nothing in the app has
--  to start juggling ids. ON UPDATE CASCADE means renaming a category here
--  renames it on every item automatically.
-- ============================================================================

create table if not exists public.menu_categories (
  name       text primary key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Adopt whatever categories the menu already uses, keeping today's
-- alphabetical order as the starting point.
insert into public.menu_categories (name, sort_order)
select c.category, (row_number() over (order by c.category))::int * 10
from (select distinct category from public.menu_items) c
on conflict (name) do nothing;

-- Link items to categories. Renames cascade; a category still in use cannot
-- be deleted out from under its items.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_items_category_fkey'
  ) then
    alter table public.menu_items
      add constraint menu_items_category_fkey
      foreign key (category) references public.menu_categories (name)
      on update cascade
      on delete restrict;
  end if;
end
$$;

alter table public.menu_categories enable row level security;

drop policy if exists menu_categories_select on public.menu_categories;
create policy menu_categories_select on public.menu_categories
  for select to authenticated using (true);

drop policy if exists menu_categories_admin_insert on public.menu_categories;
create policy menu_categories_admin_insert on public.menu_categories
  for insert to authenticated with check (public.is_admin());

drop policy if exists menu_categories_admin_update on public.menu_categories;
create policy menu_categories_admin_update on public.menu_categories
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists menu_categories_admin_delete on public.menu_categories;
create policy menu_categories_admin_delete on public.menu_categories
  for delete to authenticated using (public.is_admin());

revoke all on public.menu_categories from authenticated, anon;
grant select on public.menu_categories to authenticated;
grant insert, delete on public.menu_categories to authenticated;
grant update (name, sort_order) on public.menu_categories to authenticated;
