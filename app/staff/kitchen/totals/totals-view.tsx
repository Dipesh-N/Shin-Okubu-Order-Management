"use client";

import { fetchKitchenData } from "@/lib/queries";
import { useLiveData } from "@/lib/use-live-data";
import { LiveBadge } from "@/components/live-badge";

type Row = {
  name: string;
  total: number;
  waiting: number;
  cooking: number;
};

export function KitchenTotalsView() {
  const { data, error, live, reload } = useLiveData(fetchKitchenData);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={reload}
          className="mt-3 h-12 rounded-xl bg-slate-900 px-6 font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return <p className="p-6 text-center text-slate-400">Loading…</p>;

  // Everything not yet COMPLETED still has to be made, so both NEW and
  // COOKING tickets count towards the batch.
  const tally = new Map<string, Row>();
  for (const order of data.active) {
    for (const item of order.order_items) {
      // Drinks are not cooked, so they are not part of the batch.
      if (!item.to_kitchen) continue;
      const row = tally.get(item.item_name) ?? {
        name: item.item_name,
        total: 0,
        waiting: 0,
        cooking: 0,
      };
      row.total += item.qty;
      if (order.status === "NEW") row.waiting += item.qty;
      else row.cooking += item.qty;
      tally.set(item.item_name, row);
    }
  }

  // Biggest batch first — that is what you start.
  const rows = [...tally.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );

  const totalItems = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <>
      <LiveBadge live={live} />

      {rows.length === 0 ? (
        <p className="py-16 text-center text-xl text-slate-400">
          Nothing to cook right now.
        </p>
      ) : (
        <div className="p-3">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Still to make
            </span>
            <span className="text-sm text-slate-500">
              {totalItems} item{totalItems === 1 ? "" : "s"} ·{" "}
              {data.active.length} ticket{data.active.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* A grid rather than one long column: on an iPad this fits two to
              three times as many lines without shrinking the numbers. */}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2
                           shadow-sm ring-1 ring-slate-200"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {row.name}
                  </p>
                  {/* Which of them the kitchen has already started on. */}
                  {row.cooking > 0 && row.waiting > 0 && (
                    <p className="text-xs text-slate-500">
                      {row.waiting} waiting · {row.cooking} cooking
                    </p>
                  )}
                </div>

                <span className="text-3xl font-bold tabular-nums text-slate-900">
                  {row.total}
                </span>
              </div>
            ))}
          </div>

          <p className="px-1 pt-3 text-sm text-slate-400">
            Everything on the tickets that has not been marked complete.
          </p>
        </div>
      )}
    </>
  );
}
