import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { compareLabels } from "@/lib/queries";
import type { RestaurantTable } from "@/lib/types";
import { setTableActive } from "@/app/admin/actions";
import { AddTableForm, EditTablePanel } from "./table-forms";

export const metadata = { title: "Tables · Admin" };

export default async function AdminTablesPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .select("id, label, is_active, created_at");

  if (error) {
    return (
      <p className="rounded-2xl bg-white p-4 text-red-700 ring-1 ring-slate-200">
        Could not load tables: {error.message}
      </p>
    );
  }

  const tables = ((data ?? []) as RestaurantTable[]).sort((a, b) =>
    compareLabels(a.label, b.label),
  );

  return (
    <div className="space-y-4">
      <AddTableForm />

      {tables.length === 0 ? (
        <p className="rounded-2xl bg-white py-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          No tables yet. Add your first one above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {tables.map((table, i) => (
            <div
              key={table.id}
              className={i > 0 ? "border-t border-slate-100" : ""}
            >
              <input
                type="checkbox"
                id={`edit-table-${table.id}`}
                className="peer sr-only"
              />

              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* A fixed-width number keeps every row's text aligned. */}
                <span
                  className={`w-10 shrink-0 text-center text-xl font-bold tabular-nums ${
                    table.is_active ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {table.label}
                </span>

                <span className="flex-1 text-sm text-slate-400">
                  {table.is_active ? "" : "Disabled"}
                </span>

                <form action={setTableActive}>
                  <input type="hidden" name="id" value={table.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!table.is_active)}
                  />
                  <button
                    type="submit"
                    className={`h-11 whitespace-nowrap rounded-xl px-3 text-sm font-semibold ${
                      table.is_active
                        ? "bg-slate-100 text-slate-700 active:bg-slate-200"
                        : "bg-green-600 text-white active:bg-green-700"
                    }`}
                  >
                    {table.is_active ? "Disable" : "Enable"}
                  </button>
                </form>

                <label
                  htmlFor={`edit-table-${table.id}`}
                  className="flex h-11 cursor-pointer items-center rounded-xl px-3 text-sm
                             font-semibold text-slate-500 select-none active:bg-slate-100
                             peer-focus-visible:ring-2 peer-focus-visible:ring-slate-900"
                >
                  Edit
                </label>
              </div>

              <div className="hidden px-3 pb-3 peer-checked:block">
                <EditTablePanel table={table} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
