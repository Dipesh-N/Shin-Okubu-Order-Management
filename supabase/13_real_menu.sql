-- ============================================================================
--  Okubu Momo — the real menu
--
--  Taken from the printed card. Every item is ¥500, as the card says.
--
--  Run AFTER reset_menu.sql. Safe to re-run: categories key on their name and
--  items are only inserted when a dish of that name does not already exist.
--
--  Category order below is the order waiters see the tabs in — momo first,
--  since that is what the shop is for. Change it any time with the up/down
--  buttons under Admin -> Menu -> Categories.
--
--  needs_kitchen is true for every category: there are no drinks on this card.
-- ============================================================================

insert into public.menu_categories (name, sort_order, needs_kitchen)
values
  ('Momo',      10, true),
  ('Chowmin',   20, true),
  ('Khaja',     30, true),
  ('Khana Set', 40, true),
  ('Fry Items', 50, true),
  ('Sekuwa',    60, true),
  ('Bhutan',    70, true)
on conflict (name) do nothing;

insert into public.menu_items (name, price, category, sort_order)
select v.name, v.price, v.category, v.ord
from (values
  -- MOMO
  ('Chicken Momo',      500, 'Momo',      10),
  ('Veg Momo',          500, 'Momo',      20),
  ('Mutton Momo',       500, 'Momo',      30),
  ('Fry Momo',          500, 'Momo',      40),
  ('AB Momo',           500, 'Momo',      50),
  ('Jhol Momo',         500, 'Momo',      60),

  -- CHOWMIN
  ('Momo + Chowmin',    500, 'Chowmin',   10),
  ('Chicken Chowmin',   500, 'Chowmin',   20),
  ('Veg Chowmin',       500, 'Chowmin',   30),

  -- KHAJA
  ('Panipuri',          500, 'Khaja',     10),
  ('Chatpat Dry',       500, 'Khaja',     20),
  ('Ghilo Chatpat',     500, 'Khaja',     30),
  ('Aloo Stick',        500, 'Khaja',     40),
  ('Samosa Chatni',     500, 'Khaja',     50),
  ('Sefali',            500, 'Khaja',     60),
  ('Fry Ice',           500, 'Khaja',     70),

  -- KHANA SET  (the card notes these are made to order and take longer)
  ('Dal Bhat',          500, 'Khana Set', 10),
  ('Roti Tarkari',      500, 'Khana Set', 20),

  -- FRY ITEMS
  ('Chicken Leg Fry',   500, 'Fry Items', 10),
  ('Chicken Wings Fry', 500, 'Fry Items', 20),
  ('Chicken Sausage',   500, 'Fry Items', 30),
  ('Chicken Nugget Fry',500, 'Fry Items', 40),

  -- SEKUWA
  ('Mutton Sekuwa',     500, 'Sekuwa',    10),
  ('Chicken Sekuwa',    500, 'Sekuwa',    20),
  ('Pork Sekuwa',       500, 'Sekuwa',    30),

  -- BHUTAN
  ('Bhutan',            500, 'Bhutan',    10)
) as v(name, price, category, ord)
where not exists (
  select 1 from public.menu_items m where m.name = v.name
);

-- 7 categories, 26 items, all ¥500.
select
  (select count(*) from public.menu_categories) as categories,
  (select count(*) from public.menu_items)      as items,
  (select count(*) from public.menu_items where price <> 500) as not_500;
