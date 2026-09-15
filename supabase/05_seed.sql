-- ============================================================================
--  Okubu Momo — 05: Starting data (optional)
--
--  Safe to re-run, and safe to edit later from the admin screens.
-- ============================================================================

insert into public.tables (label)
select v.label from (values
  ('1'), ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8')
) as v(label)
on conflict (label) do nothing;

insert into public.menu_items (name, price, category, sort_order)
select v.name, v.price, v.category, v.ord from (values
  ('Chicken Momo (Steamed)', 650, 'Momo',   1),
  ('Chicken Momo (Fried)',   700, 'Momo',   2),
  ('Buff Momo (Steamed)',    650, 'Momo',   3),
  ('Veg Momo (Steamed)',     600, 'Momo',   4),
  ('Cheese Momo',            750, 'Momo',   5),
  ('Jhol Momo',              800, 'Momo',   6),
  ('French Fries',           450, 'Sides',  1),
  ('Chicken Chowmein',       700, 'Sides',  2),
  ('Thukpa',                 750, 'Sides',  3),
  ('Coke',                   200, 'Drinks', 1),
  ('Iced Tea',               250, 'Drinks', 2),
  ('Green Tea',              180, 'Drinks', 3),
  ('Beer',                   500, 'Drinks', 4)
) as v(name, price, category, ord)
where not exists (
  select 1 from public.menu_items m where m.name = v.name
);
