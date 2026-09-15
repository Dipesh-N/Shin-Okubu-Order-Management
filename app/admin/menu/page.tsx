import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatYen } from "@/lib/money";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { setMenuItemAvailable } from "@/app/admin/actions";
import { AddMenuItemForm, EditMenuItemPanel } from "./menu-forms";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "Menu · Admin" };

export default async function AdminMenuPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [itemsRes, categoriesRes] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, name, price, category, is_available, sort_order, created_at")
      .order("sort_order")
      .order("name"),
    supabase
      .from("menu_categories")
      .select("name, sort_order, needs_kitchen, created_at")
      .order("sort_order"),
  ]);

  const error = itemsRes.error ?? categoriesRes.error;
  if (error) {
    return (
      <p className="rounded-2xl bg-white p-4 text-red-700 ring-1 ring-slate-200">
        Could not load the menu: {error.message}
      </p>
    );
  }

  const items = (itemsRes.data ?? []) as MenuItem[];
  const categoryRows = (categoriesRes.data ?? []) as MenuCategory[];
  const categories = categoryRows.map((c) => c.name);

  const counts: Record<string, number> = {};
  for (const c of categories) counts[c] = 0;
  for (const i of items) counts[i.category] = (counts[i.category] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <CategoryManager categories={categoryRows} counts={counts} />
      <AddMenuItemForm categories={categories} />

      {categoryRows.map((category) => {
        const rows = items.filter((i) => i.category === category.name);
        if (rows.length === 0) return null;

        return (
          <section key={category.name}>
            <h2 className="px-1 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              {category.name}
            </h2>

            {/* One card per category with dividers, rather than a card per
                item — fifteen items should not be fifteen screens. */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              {rows.map((item, i) => (
                <div
                  key={item.id}
                  className={i > 0 ? "border-t border-slate-100" : ""}
                >
                  {/* CSS-only disclosure: the checkbox is the peer, so the
                      panel below can span the whole row rather than being
                      trapped inside a flex cell. No JavaScript needed. */}
                  <input
                    type="checkbox"
                    id={`edit-${item.id}`}
                    className="peer sr-only"
                  />

                  {/* Stacks on a phone so long dish names are never
                      truncated to "Chicken Mom…". */}
                  <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold ${
                          item.is_available
                            ? "text-slate-900"
                            : "text-slate-400 line-through"
                        }`}
                      >
                        {item.name}
                      </p>
                      {!item.is_available && (
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Sold out
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                    <span
                      className={`flex-1 tabular-nums sm:flex-none ${
                        item.is_available ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {formatYen(item.price)}
                    </span>

                    {/* The daily action: one tap, never behind a menu. */}
                    <form action={setMenuItemAvailable}>
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="hidden"
                        name="available"
                        value={String(!item.is_available)}
                      />
                      <button
                        type="submit"
                        className={`h-11 whitespace-nowrap rounded-xl px-3 text-sm font-semibold ${
                          item.is_available
                            ? "bg-slate-100 text-slate-700 active:bg-slate-200"
                            : "bg-green-600 text-white active:bg-green-700"
                        }`}
                      >
                        {item.is_available ? "Sold out" : "Back on"}
                      </button>
                    </form>

                    <label
                      htmlFor={`edit-${item.id}`}
                      className="flex h-11 cursor-pointer items-center rounded-xl px-3 text-sm
                                 font-semibold text-slate-500 select-none active:bg-slate-100
                                 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-900"
                    >
                      Edit
                    </label>
                    </div>
                  </div>

                  <div className="hidden px-3 pb-3 peer-checked:block">
                    <EditMenuItemPanel item={item} categories={categories} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {items.length === 0 && (
        <p className="rounded-2xl bg-white py-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          No menu items yet. Add your first one above.
        </p>
      )}
    </div>
  );
}
